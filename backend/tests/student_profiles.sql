\set ON_ERROR_STOP on
begin;
select set_config('test.student_a', gen_random_uuid()::text, true);
select set_config('test.student_b', gen_random_uuid()::text, true);
insert into auth.users (id, email) values
    (current_setting('test.student_a')::uuid, 'hoos-test-a@example.invalid'),
    (current_setting('test.student_b')::uuid, 'hoos-test-b@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.student_a'), true);
insert into public.student_profiles (user_id, profile) values (
    current_setting('test.student_a')::uuid,
    '{"name":"Test A","age":"21","height":"69","weight":"155","dietary":{"allergies":[],"restrictions":[],"preferences":[],"dislikes":[]}}'
);

do $test$
declare
    affected integer;
    current_version bigint;
begin
    select version into current_version from public.student_profiles;
    if current_version != 1 then raise exception 'Initial version must be 1'; end if;
    update public.student_profiles set profile = jsonb_set(profile, '{name}', '"Changed"')
        where user_id = current_setting('test.student_a')::uuid and version = 1;
    get diagnostics affected = row_count;
    if affected != 1 then raise exception 'Own profile update must succeed'; end if;
    select version into current_version from public.student_profiles;
    if current_version != 2 then raise exception 'Update must increment version'; end if;
    update public.student_profiles set profile = jsonb_set(profile, '{name}', '"Stale"')
        where user_id = current_setting('test.student_a')::uuid and version = 1;
    get diagnostics affected = row_count;
    if affected != 0 then raise exception 'Stale update must affect no rows'; end if;
end;
$test$;

select set_config('request.jwt.claim.sub', current_setting('test.student_b'), true);
do $test$
declare affected integer;
begin
    if exists(select 1 from public.student_profiles) then
        raise exception 'Second user must not see first profile';
    end if;
    update public.student_profiles set profile = jsonb_set(profile, '{name}', '"Other user"')
        where user_id = current_setting('test.student_a')::uuid;
    get diagnostics affected = row_count;
    if affected != 0 then raise exception 'Second user must not update first profile'; end if;
    begin
        insert into public.student_profiles (user_id, profile) values (
            current_setting('test.student_a')::uuid,
            '{"name":"Impersonated","age":"","height":"","weight":"","dietary":{"allergies":[],"restrictions":[],"preferences":[],"dislikes":[]}}'
        );
        raise exception 'Cross-user insert must fail';
    exception when insufficient_privilege then null;
    end;
    begin
        insert into public.student_profiles (user_id, profile)
        values (current_setting('test.student_b')::uuid, '{"name":"Invalid"}');
        raise exception 'Malformed profile must fail';
    exception when check_violation then null;
    end;
    insert into public.student_profiles (user_id, profile) values (
        current_setting('test.student_b')::uuid,
        '{"name":"Test B","age":"","height":"","weight":"","dietary":{"allergies":[],"restrictions":[],"preferences":[],"dislikes":[]}}'
    );
    if (select count(*) from public.student_profiles) != 1 then
        raise exception 'Second user must see only their own profile';
    end if;
end;
$test$;

set local role anon;
do $test$
begin
    begin
        perform * from public.student_profiles;
        raise exception 'Anonymous access must fail';
    exception when insufficient_privilege then null;
    end;
end;
$test$;
reset role;
select 'Profile ownership, version conflicts, schema checks, and anonymous restrictions passed' as result;
rollback;
