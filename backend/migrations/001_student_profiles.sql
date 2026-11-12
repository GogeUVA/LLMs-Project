begin;

create table public.student_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    profile jsonb not null,
    version bigint not null default 1 check (version > 0),
    updated_at timestamptz not null default now(),
    constraint profile_object check (
        jsonb_typeof(profile) = 'object'
        and profile ?& array['name', 'age', 'height', 'weight', 'dietary']
        and jsonb_typeof(profile -> 'name') = 'string'
        and length(btrim(profile ->> 'name')) between 1 and 100
        and jsonb_typeof(profile -> 'age') = 'string'
        and jsonb_typeof(profile -> 'height') = 'string'
        and jsonb_typeof(profile -> 'weight') = 'string'
        and jsonb_typeof(profile -> 'dietary') = 'object'
        and (profile -> 'dietary') ?& array['allergies', 'restrictions', 'preferences', 'dislikes']
        and jsonb_typeof(profile -> 'dietary' -> 'allergies') = 'array'
        and jsonb_typeof(profile -> 'dietary' -> 'restrictions') = 'array'
        and jsonb_typeof(profile -> 'dietary' -> 'preferences') = 'array'
        and jsonb_typeof(profile -> 'dietary' -> 'dislikes') = 'array'
        and not jsonb_path_exists(profile, '$.dietary.*[*] ? (@.type() != "string")')
    )
);

alter table public.student_profiles enable row level security;

revoke all on public.student_profiles from anon;
revoke all on public.student_profiles from authenticated;
grant select, insert, update on public.student_profiles to authenticated;

create policy own_profile_read on public.student_profiles
    for select to authenticated using ((select auth.uid()) = user_id);
create policy own_profile_insert on public.student_profiles
    for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_profile_update on public.student_profiles
    for update to authenticated using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create function public.advance_profile_version()
returns trigger language plpgsql set search_path = '' as $$
begin
    new.version := old.version + 1;
    new.updated_at := now();
    return new;
end;
$$;

revoke all on function public.advance_profile_version() from public;
create trigger student_profile_version
    before update on public.student_profiles
    for each row execute function public.advance_profile_version();

commit;
