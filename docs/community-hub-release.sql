begin;
update community_private.agreement_releases set current=false where current;
insert into community_private.agreement_releases(version,current) values('2026-10-31.2',true);
commit;
