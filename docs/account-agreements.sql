begin;
create table community_private.agreement_releases (
 version text primary key, current boolean not null default false,
 published_at timestamptz not null default now()
);
create unique index one_current_agreement on community_private.agreement_releases(current) where current;
insert into community_private.agreement_releases(version,current) values ('2026-10-31.1',true);
create table community_private.guardian_approvals (
 id uuid primary key default gen_random_uuid(),
 discord_id text not null check(discord_id ~ '^[0-9]{17,20}$'),
 version text not null references community_private.agreement_releases(version),
 verification_reference text not null check(length(verification_reference) between 5 and 200),
 guardian_consented_at timestamptz not null,
 claimed_user_id uuid references auth.users(id) on delete cascade,
 recorded_at timestamptz not null default now(),
 token_hash bytea not null unique,
 token_expires_at timestamptz not null default now()+interval '7 days',
 revoked_at timestamptz,
 check(guardian_consented_at<=recorded_at)
);
create index guardian_approvals_discord on community_private.guardian_approvals(discord_id,version);
create index guardian_approvals_user on community_private.guardian_approvals(claimed_user_id);
create table community_private.member_agreements (
 user_id uuid primary key references auth.users(id) on delete cascade,
 age_group text not null check(age_group in ('adult','guardian')),
 version text not null references community_private.agreement_releases(version),
 accepted_at timestamptz not null default now(),
 withdrawn_at timestamptz
);
create table community_private.agreement_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 version text not null references community_private.agreement_releases(version),
 action text not null check(action in ('accept','withdraw')),
 occurred_at timestamptz not null default now()
);
create index agreement_events_user on community_private.agreement_events(user_id);
alter table community_private.agreement_releases enable row level security;
alter table community_private.guardian_approvals enable row level security;
alter table community_private.member_agreements enable row level security;
alter table community_private.agreement_events enable row level security;
revoke all on community_private.agreement_releases,community_private.guardian_approvals,community_private.member_agreements,community_private.agreement_events from public,anon,authenticated;

create function community_private.agreement_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v text; a community_private.member_agreements; g boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select version into v from community_private.agreement_releases where current;
 select * into a from community_private.member_agreements where user_id=auth.uid();
 select exists(select 1 from community_private.guardian_approvals g join auth.identities i on i.provider='discord' and i.provider_id=g.discord_id where i.user_id=auth.uid() and g.version=v and g.revoked_at is null) into g;
 return jsonb_build_object('version',v,'accepted',coalesce(a.version=v and a.withdrawn_at is null and (a.age_group='adult' or g),false),'accepted_at',a.accepted_at,'age_group',a.age_group,'guardian_approved',g,'withdrawn',a.withdrawn_at is not null);
end $$;
create function public.agreement_status() returns jsonb language sql security invoker set search_path='' as $$ select community_private.agreement_status(); $$;

create function community_private.check_guardian_code(code text) returns boolean language sql stable security definer set search_path='' as $$
 select length(code)=64 and exists(select 1 from community_private.guardian_approvals g join community_private.agreement_releases r on r.version=g.version and r.current where g.token_hash=sha256(convert_to(code,'UTF8')) and g.revoked_at is null and g.token_expires_at>now());
$$;
create function public.check_guardian_code(code text) returns boolean language sql security invoker set search_path='' as $$ select community_private.check_guardian_code(code); $$;

create function community_private.accept_agreement(policy_version text, age_group text, terms_agreed boolean, privacy_acknowledged boolean, processing_consented boolean, transfer_consented boolean, eligibility_confirmed boolean, guardian_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); v text; discord text; old_age text; existing community_private.member_agreements; g boolean;
begin
 if actor is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if terms_agreed is not true or privacy_acknowledged is not true or processing_consented is not true or transfer_consented is not true or eligibility_confirmed is not true then raise exception 'Complete every required agreement choice' using errcode='22023'; end if;
 select version into v from community_private.agreement_releases where current;
 if policy_version is distinct from v or age_group is null or age_group not in ('adult','guardian') then raise exception 'Review the current agreement' using errcode='22023'; end if;
 select provider_id into discord from auth.identities where user_id=actor and provider='discord' limit 1;
 if discord is null then raise exception 'Discord sign-in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select * into existing from community_private.member_agreements where user_id=actor;
 if existing.age_group='guardian' and age_group='adult' then raise exception 'Contact the operator to update a guardian-managed account' using errcode='42501'; end if;
 if age_group='guardian' then
  select exists(select 1 from community_private.guardian_approvals g where g.discord_id=discord and g.version=v and g.revoked_at is null and (existing.age_group='guardian' or (length(guardian_code)=64 and g.token_hash=sha256(convert_to(guardian_code,'UTF8')) and g.token_expires_at>now()))) into g;
  if not g then raise exception 'A verified guardian approval for this Discord account is required' using errcode='42501'; end if;
  update community_private.guardian_approvals set claimed_user_id=actor where discord_id=discord and version=v and revoked_at is null and (claimed_user_id is null or claimed_user_id=actor);
 elsif exists(select 1 from community_private.guardian_approvals where discord_id=discord) then
  raise exception 'Use the guardian approval route for this account' using errcode='42501';
 end if;
 if existing.version=v and existing.withdrawn_at is null and existing.age_group=age_group then return community_private.agreement_status(); end if;
 insert into community_private.member_agreements(user_id,age_group,version) values(actor,age_group,v)
 on conflict(user_id) do update set age_group=excluded.age_group,version=excluded.version,accepted_at=now(),withdrawn_at=null;
 insert into community_private.agreement_events(user_id,version,action) values(actor,v,'accept');
 return community_private.agreement_status();
end $$;
create function public.accept_agreement(policy_version text, age_group text, terms_agreed boolean, privacy_acknowledged boolean, processing_consented boolean, transfer_consented boolean, eligibility_confirmed boolean, guardian_code text default null) returns jsonb language sql security invoker set search_path='' as $$
 select community_private.accept_agreement(policy_version,age_group,terms_agreed,privacy_acknowledged,processing_consented,transfer_consented,eligibility_confirmed,guardian_code);
$$;
create function community_private.withdraw_agreement() returns void language plpgsql security definer set search_path='' as $$
declare v text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 update community_private.member_agreements set withdrawn_at=now() where user_id=auth.uid() and withdrawn_at is null returning version into v;
 if v is not null then insert into community_private.agreement_events(user_id,version,action) values(auth.uid(),v,'withdraw'); end if;
end $$;
create function public.withdraw_agreement() returns void language sql security invoker set search_path='' as $$ select community_private.withdraw_agreement(); $$;

create function community_private.require_review_agreement() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (community_private.agreement_status()->>'accepted')::boolean is not true then raise exception 'Review and accept the current community agreement before posting or editing' using errcode='42501'; end if;
 return NEW;
end $$;
create trigger agreement_before_review before insert or update on public.website_reviews for each row execute function community_private.require_review_agreement();

-- Only the database operator may issue codes, after independently verifying the guardian and recording consent.
create function community_private.issue_guardian_approval(child_discord_id text, verification_reference text, guardian_consented_at timestamptz) returns text language plpgsql security invoker set search_path='' as $$
declare token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''); v text;
begin
 select version into v from community_private.agreement_releases where current;
 insert into community_private.guardian_approvals(discord_id,version,verification_reference,guardian_consented_at,token_hash) values(child_discord_id,v,verification_reference,guardian_consented_at,sha256(convert_to(token,'UTF8')));
 return token;
end $$;

revoke all on function community_private.agreement_status(),public.agreement_status(),community_private.check_guardian_code(text),public.check_guardian_code(text),community_private.accept_agreement(text,text,boolean,boolean,boolean,boolean,boolean,text),public.accept_agreement(text,text,boolean,boolean,boolean,boolean,boolean,text),community_private.withdraw_agreement(),public.withdraw_agreement(),community_private.require_review_agreement(),community_private.issue_guardian_approval(text,text,timestamptz) from public,anon,authenticated;
grant usage on schema community_private to anon,authenticated;
grant execute on function community_private.check_guardian_code(text),public.check_guardian_code(text) to anon,authenticated;
grant execute on function community_private.agreement_status(),public.agreement_status(),community_private.accept_agreement(text,text,boolean,boolean,boolean,boolean,boolean,text),public.accept_agreement(text,text,boolean,boolean,boolean,boolean,boolean,text),community_private.withdraw_agreement(),public.withdraw_agreement() to authenticated;
commit;

