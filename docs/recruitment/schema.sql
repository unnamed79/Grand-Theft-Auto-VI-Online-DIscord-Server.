
create table community_private.recruitment_settings (
 id boolean primary key default true check(id), accepting boolean not null default false,
 closed_message text not null default 'Staff applications are currently closed. Check back during our next recruitment phase.',
 round integer not null default 1, revision integer not null default 1,
 check(length(closed_message) between 1 and 1000)
);
insert into community_private.recruitment_settings(id) values(true);
create table community_private.recruitment_guardians (
 guardian_id uuid primary key references community_private.guardian_approvals(id) on delete cascade,
 approved_by uuid references auth.users(id) on delete set null,
 approved_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 days',
 notice_version text not null default 'recruitment-2026-11-01'
);
create table community_private.staff_applications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 round integer not null, answers jsonb not null,
 submitted_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '90 days',
 notice_version text not null default 'recruitment-2026-11-01',
 unique(user_id,round)
);
create index staff_applications_expiry on community_private.staff_applications(expires_at);
alter table community_private.recruitment_settings enable row level security;
alter table community_private.recruitment_guardians enable row level security;
alter table community_private.staff_applications enable row level security;
revoke all on community_private.recruitment_settings,community_private.recruitment_guardians,community_private.staff_applications from public,anon,authenticated;

create function community_private.recruitment(action text, payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s community_private.recruitment_settings; actor uuid:=auth.uid(); staff boolean:=community_private.is_staff();
 a jsonb; ag jsonb; k text; v jsonb; age integer; guardian_ok boolean:=false; needs_guardian boolean:=false; gid uuid; result jsonb; own jsonb;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>30000 then raise exception 'Invalid request'; end if;
 -- Serialize settings changes against submissions, so closing recruitment also closes stale forms.
 select * into s from community_private.recruitment_settings where id=true for update;
 if actor is not null then
  ag:=community_private.agreement_status();
  needs_guardian:=ag->>'age_group'='guardian';
  select exists(select 1 from community_private.recruitment_guardians r
   join community_private.guardian_approvals g on g.id=r.guardian_id
   join auth.identities i on i.provider='discord' and i.provider_id=g.discord_id
   where i.user_id=actor and g.revoked_at is null and g.version=ag->>'version'
    and r.expires_at>now() and r.notice_version='recruitment-2026-11-01') into guardian_ok;
 end if;
 if action='status' then
  select jsonb_build_object('id',id,'submitted_at',submitted_at,'expires_at',expires_at)
   into own from community_private.staff_applications where user_id=actor and round=s.round and expires_at>now();
  return jsonb_build_object('accepting',s.accepting,'closed_message',s.closed_message,'round',s.round,
   'revision',s.revision,'staff',staff,'needs_guardian',coalesce(needs_guardian,false),'guardian_approved',guardian_ok,'own',own);
 end if;
 if actor is null or not exists(select 1 from auth.identities where user_id=actor and provider='discord') then raise exception 'Discord sign-in required' using errcode='42501'; end if;
 if action in ('settings','responses','delete','guardian') and not staff then raise exception 'Staff access required' using errcode='42501'; end if;
 if action='settings' then
  if (payload->>'revision')::integer is distinct from s.revision then raise exception 'Settings changed. Refresh and try again.'; end if;
  if jsonb_typeof(payload->'accepting') is distinct from 'boolean' or length(btrim(coalesce(payload->>'closed_message',''))) not between 1 and 1000 then raise exception 'Invalid published options'; end if;
  if coalesce((payload->>'new_round')::boolean,false) and s.accepting then raise exception 'Close recruitment before starting a new round'; end if;
  update community_private.recruitment_settings set accepting=(payload->>'accepting')::boolean,closed_message=btrim(payload->>'closed_message'),
   round=round+case when coalesce((payload->>'new_round')::boolean,false) then 1 else 0 end,revision=revision+1 where id=true;
  return '{"saved":true}'::jsonb;
 elsif action='responses' then
  select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) into result from (
   select id,round,answers,submitted_at,expires_at from community_private.staff_applications
   where expires_at>now() order by submitted_at desc,id limit 50 offset greatest(0,least(coalesce((payload->>'offset')::integer,0),100000))
  ) t;
  return result;
 elsif action in ('delete','withdraw') then
  delete from community_private.staff_applications where id=(payload->>'id')::uuid and (staff or user_id=actor);
  return '{"deleted":true}'::jsonb;
 elsif action='guardian' then
  if coalesce(payload->>'discord_id','') !~ '^[0-9]{17,20}$' then raise exception 'Enter a numeric Discord ID'; end if;
  if payload->>'approved'='false' then
   delete from community_private.recruitment_guardians r using community_private.guardian_approvals g where r.guardian_id=g.id and g.discord_id=payload->>'discord_id';
   delete from community_private.staff_applications x using auth.identities i where x.user_id=i.user_id and i.provider='discord' and i.provider_id=payload->>'discord_id';
   return '{"revoked":true}'::jsonb;
  end if;
  if payload->>'verified' is distinct from 'true' then raise exception 'Verify guardian authority and explicit recruitment permission first'; end if;
  select id into gid from community_private.guardian_approvals where discord_id=payload->>'discord_id' and revoked_at is null
   and version=(select version from community_private.agreement_releases where current) order by recorded_at desc limit 1;
  if gid is null then raise exception 'A current verified account guardian approval must be recorded first'; end if;
  insert into community_private.recruitment_guardians(guardian_id,approved_by) values(gid,actor)
   on conflict(guardian_id) do update set approved_by=actor,approved_at=now(),expires_at=now()+interval '90 days',notice_version='recruitment-2026-11-01';
  return '{"approved":true}'::jsonb;
 elsif action='submit' then
  if not s.accepting then raise exception 'Recruitment is closed. Your application was not submitted.'; end if;
  if (payload->>'round')::integer is distinct from s.round then raise exception 'The recruitment round changed. Refresh before submitting.'; end if;
  if (ag->>'accepted')::boolean is not true then raise exception 'Accept the current account agreement first' using errcode='42501'; end if;
  if payload->>'consent' is distinct from 'true' or payload->>'notice_version' is distinct from 'recruitment-2026-11-01' then raise exception 'Review and accept the recruitment notice'; end if;
  a:=payload->'answers';
  if jsonb_typeof(a) is distinct from 'object' then raise exception 'Missing application answers'; end if;
  if exists(select 1 from jsonb_object_keys(a) key where key not in ('username','age','timezone','availability','motivation','rules','skills','experience','other_code','other_markup','ielts','english','coding','markup')) then raise exception 'Unknown application field'; end if;
  foreach k in array array['username','age','timezone','availability','motivation','rules','skills','experience','english'] loop
   if jsonb_typeof(a->k) is distinct from 'string' or length(btrim(coalesce(a->>k,'')))=0 then raise exception 'Complete all required answers'; end if;
  end loop;
  foreach k in array array['username','age','timezone','availability','motivation','rules','skills','experience','other_code','other_markup','ielts','english'] loop
   if a ? k and (jsonb_typeof(a->k)<>'string' or length(a->>k)>case when k in ('motivation','rules','skills','experience') then 4000 else 300 end) then raise exception 'An answer is too long or invalid'; end if;
  end loop;
  if (a->>'age') !~ '^[0-9]{1,3}$' then raise exception 'Enter your age in whole years'; end if;
  age:=(a->>'age')::integer;
  if age<16 or age>120 then raise exception 'Applicants must be at least 16 years old'; end if;
  if (age<18 or needs_guardian) and not guardian_ok then raise exception 'Verified guardian recruitment approval is required before submitting' using errcode='42501'; end if;
  if a->>'english' not in ('A1','A2','B1','B2','C1','C2','Native / first / only language') then raise exception 'Choose your English level'; end if;
  foreach k in array array['coding','markup'] loop
   if jsonb_typeof(a->k) is distinct from 'object' then raise exception 'Invalid experience grid'; end if;
   for result,v in select to_jsonb(key),value from jsonb_each(a->k) loop
    if (k='coding' and result#>>'{}' not in ('Python','JavaScript','Java','C++','C','Rust')) or
       (k='markup' and result#>>'{}' not in ('Markdown','HTML','XML','SVG','LaTeX')) or
       jsonb_typeof(v)<>'number' or v::text !~ '^[0-7]$' then raise exception 'Choose one listed duration per language'; end if;
   end loop;
  end loop;
  insert into community_private.staff_applications(user_id,round,answers) values(actor,s.round,a)
   returning jsonb_build_object('id',id,'submitted_at',submitted_at,'expires_at',expires_at) into result;
  return result;
 end if;
 raise exception 'Unknown application action';
exception when unique_violation then raise exception 'You already submitted an application for this round.';
end $$;
revoke all on function community_private.recruitment(text,jsonb) from public;
grant execute on function community_private.recruitment(text,jsonb) to anon,authenticated;
create function public.recruitment(action text,payload jsonb default '{}'::jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select community_private.recruitment(action,payload); $$;
revoke all on function public.recruitment(text,jsonb) from public;
grant execute on function public.recruitment(text,jsonb) to anon,authenticated;

create extension if not exists pg_cron;
select cron.schedule('recruitment-retention','* * * * *',
 $job$delete from community_private.staff_applications where expires_at<=now();
 delete from community_private.recruitment_guardians where expires_at<=now();
 delete from cron.job_run_details where jobid=(select jobid from cron.job where jobname='recruitment-retention') and end_time<now()-interval '7 days';$job$);
