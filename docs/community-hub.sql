-- Community hub: private tables, bounded RPCs, private Storage and immutable ownership.
create table community_private.hub_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid references auth.users on delete cascade not null,
 display_name text not null, title text not null check(length(title) between 3 and 160), body text not null check(length(body) between 1 and 12000),
 category text not null check(category in ('Discussion','Creations','Looking for group','Guides')),
 published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), staff_edited boolean not null default false
);
create index hub_posts_feed on community_private.hub_posts(created_at desc,id) where published;
create index hub_posts_author on community_private.hub_posts(author_id);
create index hub_posts_search on community_private.hub_posts using gin(to_tsvector('english',title||' '||body)) where published;
create table community_private.hub_comments (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references community_private.hub_posts on delete cascade,
 author_id uuid references auth.users on delete cascade not null, display_name text not null,
 parent_id uuid references community_private.hub_comments on delete set null, body text not null check(length(body) between 1 and 3000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), staff_edited boolean not null default false
);
create index hub_comments_post on community_private.hub_comments(post_id,created_at,id);
create index hub_comments_author on community_private.hub_comments(author_id);
create index hub_comments_parent on community_private.hub_comments(parent_id);
create table community_private.hub_votes (post_id uuid references community_private.hub_posts on delete cascade, user_id uuid references auth.users on delete cascade, value smallint not null check(value in (-1,1)), primary key(post_id,user_id));
create index hub_votes_user on community_private.hub_votes(user_id);
-- File manifests survive post removal until the Storage API confirms physical deletion.
create table community_private.hub_files (
 path text primary key, post_id uuid references community_private.hub_posts on delete set null, owner_id uuid references auth.users on delete set null,
 filename text not null, mime text not null, bytes bigint not null check(bytes between 1 and 8388608), description text not null,
 created_at timestamptz not null default now()
);
create index hub_files_post on community_private.hub_files(post_id);
create index hub_files_owner on community_private.hub_files(owner_id);
create table community_private.hub_activity(user_id uuid primary key references auth.users on delete cascade, last_write timestamptz not null);
create table community_private.hub_moderation(id bigint generated always as identity primary key, actor_id uuid references auth.users on delete set null, target_id uuid not null, action text not null, created_at timestamptz default now());
create index hub_moderation_actor on community_private.hub_moderation(actor_id);
alter table community_private.hub_posts enable row level security;
alter table community_private.hub_comments enable row level security;
alter table community_private.hub_votes enable row level security;
alter table community_private.hub_files enable row level security;
alter table community_private.hub_activity enable row level security;
alter table community_private.hub_moderation enable row level security;
revoke all on community_private.hub_posts,community_private.hub_comments,community_private.hub_votes,community_private.hub_files,community_private.hub_activity,community_private.hub_moderation from public,anon,authenticated;

create function community_private.hub_api(action text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare actor uuid:=auth.uid(); staff boolean:=community_private.is_staff(); pid uuid; cid uuid; parent uuid; p community_private.hub_posts; c community_private.hub_comments; f jsonb; result jsonb; who text; previous timestamptz; n int; offst int; search text; file_path text;
begin
 if action in ('feed','post','comments') then
  offst:=greatest(0,least(coalesce((payload->>'offset')::int,0),10000));
  search:=left(btrim(coalesce(payload->>'search','')),200);
  if action='feed' then
   select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (
    select p.id,p.author_id,p.display_name,p.title,p.body,p.category,p.created_at,p.updated_at,p.staff_edited,
     coalesce((select sum(v.value) from community_private.hub_votes v where v.post_id=p.id),0) score,
     (select count(*) from community_private.hub_comments c where c.post_id=p.id) comments,
     coalesce((select value from community_private.hub_votes v where v.post_id=p.id and v.user_id=actor),0) my_vote,
     (select count(*) from community_private.hub_files f where f.post_id=p.id) attachments
    from community_private.hub_posts p where p.published and (search='' or to_tsvector('english',p.title||' '||p.body) @@ websearch_to_tsquery('english',search) or p.title ilike '%'||replace(replace(replace(search,'\','\\'),'%','\%'),'_','\_')||'%')
     and (coalesce(payload->>'category','')='' or p.category=payload->>'category')
    order by p.created_at desc,p.id limit 20 offset offst
   ) x; return result;
  end if;
  pid:=(payload->>'id')::uuid;
  select * into p from community_private.hub_posts where id=pid and published;
  if not found then raise exception 'Post not found'; end if;
  if action='post' then
   return to_jsonb(p)||jsonb_build_object('score',coalesce((select sum(value) from community_private.hub_votes where post_id=pid),0),'my_vote',coalesce((select value from community_private.hub_votes where post_id=pid and user_id=actor),0),'files',coalesce((select jsonb_agg(jsonb_build_object('path',path,'filename',filename,'mime',mime,'bytes',bytes,'description',description)) from community_private.hub_files where post_id=pid),'[]'::jsonb));
  end if;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into result from (select c.*, (select display_name from community_private.hub_comments parent where parent.id=c.parent_id) reply_to from community_private.hub_comments c where post_id=pid order by created_at,id limit 50 offset offst) x;
  return result;
 end if;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Discord sign-in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,42));
 select left(coalesce(nullif(identity_data->>'global_name',''),nullif(identity_data->>'full_name',''),nullif(identity_data->>'name',''),'Community member'),80) into who from auth.identities where user_id=actor and provider='discord' limit 1;
 if action='cleanup' then
  -- Retry failed deletions and abandoned uploads on the next signed-in visit.
  delete from community_private.hub_posts where author_id=actor and not published and created_at<now()-interval '1 day';
  return coalesce((select jsonb_agg(path) from (select path from community_private.hub_files where post_id is null and (owner_id=actor or staff) limit 100) x),'[]'::jsonb);
 end if;
 if action='cleanup_done' then
  delete from community_private.hub_files f where post_id is null and (owner_id=actor or staff) and not exists(select 1 from storage.objects o where o.bucket_id='community-files' and o.name=f.path);
  return 'true'::jsonb;
 end if;
 if action not in ('delete_post','delete_comment','cancel_draft') and not (action='vote' and (payload->>'value')::int=0) then
  if (community_private.agreement_status()->>'accepted')::boolean is not true then raise exception 'Review the current account agreement before participating' using errcode='42501'; end if;
 end if;
 if action in ('create','edit_post','comment','edit_comment','vote') then
  insert into community_private.hub_activity values(actor,'epoch') on conflict do nothing;
  select last_write into previous from community_private.hub_activity where user_id=actor for update;
  if previous>now()-(case when action='vote' then interval '1 second' else interval '10 seconds' end) then raise exception 'Please wait briefly before posting again'; end if;
  update community_private.hub_activity set last_write=now() where user_id=actor;
 end if;
 if action='create' then
  if (select count(*) from community_private.hub_posts where author_id=actor and created_at>now()-interval '1 day')>=30 then raise exception 'Daily post limit reached'; end if;
  if jsonb_typeof(coalesce(payload->'files','[]'::jsonb))<>'array' or jsonb_array_length(coalesce(payload->'files','[]'::jsonb))>4 then raise exception 'Maximum four attachments'; end if;
  if (select count(*) from community_private.hub_files where owner_id=actor)+jsonb_array_length(coalesce(payload->'files','[]'::jsonb))>12 then raise exception 'Your attachment allowance is full (12 files). Delete old posts or contact staff'; end if;
  insert into community_private.hub_posts(author_id,display_name,title,body,category) values(actor,who,btrim(payload->>'title'),btrim(payload->>'body'),payload->>'category') returning * into p;
  for f in select value from jsonb_array_elements(coalesce(payload->'files','[]'::jsonb)) loop
   if f->>'mime' not in ('image/png','image/jpeg','image/webp','application/pdf','text/plain','application/zip') or length(coalesce(f->>'filename','')) not between 1 and 180 or length(coalesce(f->>'description',''))>500 or (f->>'mime' like 'image/%' and length(btrim(coalesce(f->>'description','')))=0) then raise exception 'Unsupported file or missing image description'; end if;
   file_path:=actor::text||'/'||p.id::text||'/'||gen_random_uuid()::text;
   insert into community_private.hub_files(path,post_id,owner_id,filename,mime,bytes,description) values(file_path,p.id,actor,f->>'filename',f->>'mime',(f->>'bytes')::bigint,coalesce(f->>'description',''));
  end loop;
  return jsonb_build_object('id',p.id,'files',coalesce((select jsonb_agg(jsonb_build_object('path',path,'filename',filename)) from community_private.hub_files where post_id=p.id),'[]'::jsonb));
 end if;
 if action in ('publish','edit_post','delete_post','cancel_draft','vote','comment') then
  pid:=(payload->>'id')::uuid;
  select * into p from community_private.hub_posts where id=pid for update;
  if not found or (not p.published and p.author_id<>actor) then raise exception 'Post not found'; end if;
  if action in ('publish','edit_post','delete_post','cancel_draft') then
   if p.author_id<>actor and not staff then raise exception 'Not authorized' using errcode='42501'; end if;
   if action='publish' then
    if p.published then return to_jsonb(p.id); end if;
    if exists(select 1 from community_private.hub_files f where f.post_id=pid and not exists(select 1 from storage.objects o where o.bucket_id='community-files' and o.name=f.path and (o.metadata->>'size')::bigint=f.bytes and o.metadata->>'mimetype'=f.mime)) then raise exception 'Finish uploading all attachments before publishing'; end if;
    update community_private.hub_posts set published=true where id=pid;
   elsif action='edit_post' then
    update community_private.hub_posts set title=btrim(payload->>'title'),body=btrim(payload->>'body'),category=payload->>'category',updated_at=now(),staff_edited=(p.author_id<>actor) where id=pid;
   else
    if action='cancel_draft' and p.published then raise exception 'This post is already published'; end if;
    delete from community_private.hub_posts where id=pid;
   end if;
   if staff and p.author_id<>actor then insert into community_private.hub_moderation(actor_id,target_id,action) values(actor,pid,action); end if;
   return to_jsonb(pid);
  end if;
  if not p.published then raise exception 'Post not found'; end if;
  if action='vote' then
   n:=(payload->>'value')::int;
   if n=0 then delete from community_private.hub_votes where post_id=pid and user_id=actor;
   elsif n in (-1,1) then insert into community_private.hub_votes values(pid,actor,n) on conflict(post_id,user_id) do update set value=excluded.value;
   else raise exception 'Invalid vote'; end if;
   return jsonb_build_object('score',coalesce((select sum(value) from community_private.hub_votes where post_id=pid),0),'my_vote',n);
  end if;
  parent:=nullif(payload->>'parent_id','')::uuid;
  if parent is not null and not exists(select 1 from community_private.hub_comments where id=parent and post_id=pid) then raise exception 'Reply must belong to this post'; end if;
  if (select count(*) from community_private.hub_comments where author_id=actor and created_at>now()-interval '1 day')>=100 then raise exception 'Daily comment limit reached'; end if;
  insert into community_private.hub_comments(post_id,author_id,display_name,parent_id,body) values(pid,actor,who,parent,btrim(payload->>'body')) returning id into cid;
  return to_jsonb(cid);
 end if;
 if action in ('edit_comment','delete_comment') then
  cid:=(payload->>'id')::uuid;
  select * into c from community_private.hub_comments where id=cid for update;
  if not found then raise exception 'Comment not found'; end if;
  if c.author_id<>actor and not staff then raise exception 'Not authorized' using errcode='42501'; end if;
  if action='delete_comment' then delete from community_private.hub_comments where id=cid;
  else update community_private.hub_comments set body=btrim(payload->>'body'),updated_at=now(),staff_edited=(c.author_id<>actor) where id=cid; end if;
  if staff and c.author_id<>actor then insert into community_private.hub_moderation(actor_id,target_id,action) values(actor,cid,action); end if;
  return to_jsonb(cid);
 end if;
 raise exception 'Unknown community action';
end; $$;
revoke all on function community_private.hub_api(text,jsonb) from public;
grant execute on function community_private.hub_api(text,jsonb) to anon,authenticated;
create function public.community_hub(action text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select community_private.hub_api(action,payload)$$;
revoke all on function public.community_hub(text,jsonb) from public;
grant execute on function public.community_hub(text,jsonb) to anon,authenticated;

create function community_private.hub_file_access(file_path text, operation text) returns boolean language plpgsql stable security definer set search_path='' as $$
declare f community_private.hub_files; p community_private.hub_posts;
begin
 select * into f from community_private.hub_files where path=file_path;
 if not found then return false; end if;
 select * into p from community_private.hub_posts where id=f.post_id;
 if operation='read' then return coalesce(p.published,false) or (auth.uid() is not null and (f.owner_id=auth.uid() or community_private.is_staff())); end if;
 if auth.uid() is null then return false; end if;
 if operation='delete' then return f.post_id is null and (f.owner_id=auth.uid() or community_private.is_staff()); end if;
 if operation='upload' then return f.owner_id=auth.uid() and p.author_id=auth.uid() and not p.published and f.created_at>now()-interval '1 hour' and coalesce((community_private.agreement_status()->>'accepted')::boolean,false); end if;
 return false;
end; $$;
revoke all on function community_private.hub_file_access(text,text) from public;
grant execute on function community_private.hub_file_access(text,text) to anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-files','community-files',false,8388608,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/zip']);
create policy hub_read on storage.objects for select to anon,authenticated using(bucket_id='community-files' and community_private.hub_file_access(name,'read'));
create policy hub_upload on storage.objects for insert to authenticated with check(bucket_id='community-files' and community_private.hub_file_access(name,'upload'));
create policy hub_remove on storage.objects for delete to authenticated using(bucket_id='community-files' and community_private.hub_file_access(name,'delete'));

