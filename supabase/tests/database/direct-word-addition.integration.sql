begin;

create function pg_temp.set_direct_addition_actor(actor_id uuid)
returns void
language plpgsql
as $function$
begin
    perform pg_catalog.set_config('request.jwt.claim.sub', coalesce(actor_id::text, ''), true);
    perform pg_catalog.set_config(
        'request.jwt.claims',
        case when actor_id is null then '{}'
             else pg_catalog.jsonb_build_object('sub', actor_id::text, 'role', 'authenticated')::text
        end,
        true
    );
end;
$function$;

insert into auth.users (id) values
    ('4a000000-0000-4000-8000-000000000001'),
    ('4a000000-0000-4000-8000-000000000002'),
    ('4a000000-0000-4000-8000-000000000003');
insert into public.users (id, nickname, role) values
    ('4a000000-0000-4000-8000-000000000001', 'direct-add-admin', 'admin'),
    ('4a000000-0000-4000-8000-000000000002', 'direct-add-r4', 'r4'),
    ('4a000000-0000-4000-8000-000000000003', 'direct-add-user', 'r1');

insert into public.themes (code, name) values
    ('direct-add-theme-a', 'direct-add-theme-a'),
    ('direct-add-theme-b', 'direct-add-theme-b'),
    ('0', 'direct-add-noinjung')
on conflict (code) do nothing;
insert into public.themes (code, name) values
    (pg_catalog.repeat('가', 64), 'direct-add-boundary-code')
on conflict (code) do nothing;
insert into public.docs (id, name, typez, last_update) values
    (946001, 'direct-add-theme-a', 'theme', '2000-01-01'),
    (946002, 'Ω', 'letter', '2000-01-01'),
    (946003, 'direct-add-unrelated', 'theme', '2000-01-01');

select no_plan();

select pg_temp.set_direct_addition_actor(null);
select throws_ok(
    $$select public.add_word_directly('anonymousΩ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_UNAUTHORIZED',
    'anonymous callers are rejected'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.add_word_directly(text,text[])', 'EXECUTE'
    )
    and not exists (
        select 1
          from pg_catalog.pg_proc as routine
          cross join lateral pg_catalog.aclexplode(
              coalesce(
                  routine.proacl,
                  pg_catalog.acldefault('f', routine.proowner)
              )
          ) as privilege
         where routine.oid = 'public.add_word_directly(text,text[])'::pg_catalog.regprocedure
           and privilege.grantee = 0
           and privilege.privilege_type = 'EXECUTE'
    ),
    'anon and PUBLIC cannot execute direct addition'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.add_word_directly(text,text[])', 'EXECUTE'
    ) and pg_catalog.has_function_privilege(
        'service_role', 'public.add_word_directly(text,text[])', 'EXECUTE'
    ),
    'authenticated and service roles have the intentional execute privilege'
);
select is(
    (select owner_role.rolname
       from pg_catalog.pg_proc as routine
       join pg_catalog.pg_roles as owner_role on owner_role.oid = routine.proowner
      where routine.oid = 'public.add_word_directly(text,text[])'::pg_catalog.regprocedure),
    'postgres',
    'the direct-addition function has the intended postgres owner'
);
select is(
    (select routine.prosecdef
       from pg_catalog.pg_proc as routine
      where routine.oid = 'public.add_word_directly(text,text[])'::pg_catalog.regprocedure),
    true,
    'the direct-addition function remains SECURITY DEFINER'
);
select ok(
    not exists (
        select 1
          from pg_catalog.pg_namespace as namespace
          cross join lateral pg_catalog.aclexplode(
              coalesce(
                  namespace.nspacl,
                  pg_catalog.acldefault('n', namespace.nspowner)
              )
          ) as privilege
         where namespace.nspname = 'public'
           and privilege.grantee = 0
           and privilege.privilege_type = 'CREATE'
    )
    and not pg_catalog.has_schema_privilege('anon', 'public', 'CREATE')
    and not pg_catalog.has_schema_privilege('authenticated', 'public', 'CREATE')
    and not pg_catalog.has_schema_privilege('service_role', 'public', 'CREATE'),
    'application roles and PUBLIC cannot create shadow objects in public'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
     from pg_catalog.pg_proc as routine
     where routine.oid = 'public.add_word_directly(text,text[])'::pg_catalog.regprocedure),
    'search_path=""',
    'the security definer RPC uses an empty search path'
);

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000003');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('regularΩ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_FORBIDDEN',
    'regular authenticated users cannot add directly'
);
reset role;

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000001');
set local role authenticated;
set local search_path = pg_temp, public, extensions;
select lives_ok(
    $$select public.add_word_directly('path-successΩ', array['direct-add-theme-b'])$$,
    'the RPC succeeds with a caller-controlled search path'
);
select is(
    pg_catalog.current_setting('search_path'),
    'pg_temp, public, extensions',
    'a successful RPC restores the caller search path'
);
do $caught_failure$
begin
    begin
        perform public.add_word_directly('path-failureΩ', array['missing-theme']);
    exception when others then
        null;
    end;
end;
$caught_failure$;
select is(
    pg_catalog.current_setting('search_path'),
    'pg_temp, public, extensions',
    'a caught RPC failure restores the caller search path'
);
reset search_path;
reset role;

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000002');
set local role authenticated;
create temporary table direct_add_hijack_marker (hits integer not null);
insert into direct_add_hijack_marker values (0);
create temporary table direct_add_public_word_count_before as
select total_words from public.words_count where id = 1;
create temporary table words_count (
    id integer primary key,
    total_words bigint not null
);
insert into words_count values (1, 777);
create function pg_temp.mark_direct_add_hijack()
returns trigger
language plpgsql
as $function$
begin
    update direct_add_hijack_marker set hits = hits + 1;
    return new;
end;
$function$;
create trigger direct_add_hijack_trigger
before update on words_count
for each row execute function pg_temp.mark_direct_add_hijack();
select lives_ok(
    $$select public.add_word_directly('temp-resistantΩ', array['direct-add-theme-b'])$$,
    'an r4 caller can add while a same-named temp relation exists'
);
reset role;
select is(
    (select hits from direct_add_hijack_marker),
    0,
    'the SECURITY DEFINER trigger chain never executes an attacker temp trigger'
);
select is(
    (select total_words from pg_temp.words_count where id = 1),
    777::bigint,
    'the SECURITY DEFINER trigger chain never resolves the attacker temp relation'
);
select is(
    (select total_words from public.words_count where id = 1),
    (select total_words + 1 from direct_add_public_word_count_before),
    'the real public word counter receives the insert effect'
);

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly(' ', array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'blank words are rejected'
);
select throws_ok(
    $$select public.add_word_directly('invalid-themeΩ', array['missing-theme'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_THEME',
    'unknown themes are rejected'
);
reset role;
select ok(
    not exists (select 1 from public.words where word = 'invalid-themeΩ')
    and not exists (select 1 from public.logs where word = 'invalid-themeΩ')
    and not exists (select 1 from public.docs_logs where word = 'invalid-themeΩ'),
    'invalid themes roll back every addition effect'
);

set local role authenticated;
select lives_ok(
    $$select public.add_word_directly(repeat('가', 100), array[repeat('가', 64)])$$,
    'exact word and theme-code character/octet boundaries are accepted'
);
select throws_ok(
    $$select public.add_word_directly(repeat('1', 101), array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'a word over the character boundary is rejected'
);
select throws_ok(
    $$select public.add_word_directly(repeat('😀', 76), array[]::text[])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'a word over the UTF-8 byte boundary is rejected'
);
select throws_ok(
    $$select public.add_word_directly('theme-char-limitΩ', array[repeat('x', 65)])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'a theme code over the character boundary is rejected before resolution'
);
select throws_ok(
    $$select public.add_word_directly('theme-byte-limitΩ', array[repeat('😀', 49)])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INVALID_INPUT',
    'a theme code over the UTF-8 byte boundary is rejected before resolution'
);
reset role;

set local role authenticated;
create temporary table direct_add_admin_result as
select public.add_word_directly(
    ' atomicΩ ', array['direct-add-theme-a', '0']
) as result;
reset role;
select is((select result ->> 'word' from direct_add_admin_result), 'atomicΩ',
    'the RPC trims and returns the normalized word');
select is((select (result ->> 'noinCanUse')::boolean from direct_add_admin_result), true,
    'the database derives noin_canuse from the selected theme codes');
select is((select pg_catalog.jsonb_array_length(result -> 'themeIds') from direct_add_admin_result), 2,
    'the RPC returns both resolved theme IDs');
select is((select result -> 'affectedDocsIds' from direct_add_admin_result), '[946001, 946002]'::jsonb,
    'the RPC returns unique sorted ordinary docs effects');
select is((select pg_catalog.count(*)::integer from public.words where word = 'atomicΩ'), 1,
    'the word is inserted exactly once');
select is((select pg_catalog.count(*)::integer
    from public.word_themes as relation
    join public.words as word_row on word_row.id = relation.word_id
    where word_row.word = 'atomicΩ'), 2,
    'all selected theme relations are inserted');
select is((select pg_catalog.count(*)::integer from public.logs
    where word = 'atomicΩ'
      and make_by = '4a000000-0000-4000-8000-000000000001'
      and processed_by = '4a000000-0000-4000-8000-000000000001'
      and r_type = 'add' and state = 'approved'), 1,
    'one authoritative approved word log uses the database actor');
select ok(
    (select pg_catalog.count(*) = 2
       and pg_catalog.count(distinct docs_id) = 2
     from public.docs_logs
     where word = 'atomicΩ' and type = 'add' and docs_id in (946001, 946002)),
    'one direct docs log is written for each unique ordinary docs effect'
);
select is((select pg_catalog.count(*)::integer from public.docs_logs
    where word = 'atomicΩ' and docs_id = 946003), 0,
    'unrelated docs receive no log');
select ok((select pg_catalog.bool_and(last_update > '2000-01-01')
    from public.docs where id in (946001, 946002)),
    'every directly affected docs timestamp changes');

update public.docs
   set last_update = '2000-01-01'::timestamptz
 where id in (946001, 946002)
    or reference_code in (
        'ko.word-chain.mission.ga',
        'ko.reverse-word-chain.mission.ga',
        'ko.kkungkkungtta.mission.ga',
        'ko.word-chain.mission',
        'ko.reverse-word-chain.mission',
        'ko.kkungkkungtta.mission'
    );
update public.docs
   set last_update = '2000-01-01'::timestamptz
 where reference_code in (
        'ko.word-chain.mission',
        'ko.reverse-word-chain.mission',
        'ko.kkungkkungtta.mission'
    );
set local role authenticated;
create temporary table direct_add_special_result as
select public.add_word_directly(
    '가가가가가가가가Ω', array['direct-add-theme-a']
) as result;
reset role;
select is(
    (select result -> 'affectedDocsIds' from direct_add_special_result),
    '[946001, 946002]'::jsonb,
    'the RPC result reports only its ordinary docs effects'
);
select results_eq(
    $$ select document.reference_code
         from public.docs_logs as docs_log
         join public.docs as document on document.id = docs_log.docs_id
        where docs_log.word = '가가가가가가가가Ω'
          and document.reference_code is not null
        order by document.reference_code $$,
    $$ values
        ('ko.reverse-word-chain.long'::text),
        ('ko.reverse-word-chain.mission.ga'::text),
        ('ko.word-chain.long'::text),
        ('ko.word-chain.mission.ga'::text) $$,
    'legacy triggers own the exact long and mission docs effects'
);
select results_eq(
    $$ select docs_id
         from public.docs_logs
        where word = '가가가가가가가가Ω'
          and docs_id in (946001, 946002)
        order by docs_id $$,
    $$ values (946001::bigint), (946002::bigint) $$,
    'the RPC owns the disjoint ordinary theme and letter docs effects'
);
select ok(
    (select pg_catalog.count(*) = 6
            and pg_catalog.count(distinct docs_id) = 6
       from public.docs_logs
      where word = '가가가가가가가가Ω'),
    'every trigger-owned and RPC-owned docs effect occurs exactly once'
);
select ok(
    (select pg_catalog.bool_and(last_update > '2000-01-01'::timestamptz)
       from public.docs
      where id in (946001, 946002)
         or reference_code in (
             'ko.word-chain.mission.ga',
             'ko.reverse-word-chain.mission.ga',
             'ko.word-chain.mission',
             'ko.reverse-word-chain.mission'
         ))
    and (select last_update = '2000-01-01'::timestamptz
           from public.docs
          where reference_code = 'ko.kkungkkungtta.mission'),
    'ordinary and applicable mission child/parent timestamps change without a false kk effect'
);

set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('atomicΩ', array['direct-add-theme-b'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_DUPLICATE',
    'an existing normalized word returns the stable duplicate code'
);
reset role;
select is((select pg_catalog.count(*)::integer from public.words where word = 'atomicΩ'), 1,
    'duplicate failure leaves the original word unchanged');
select is((select pg_catalog.count(*)::integer from public.logs where word = 'atomicΩ'), 1,
    'duplicate failure writes no additional word log');

select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok(
    $$select public.add_word_directly('r4-word', array['direct-add-theme-b'])$$,
    'r4 users are authorized by the database role lookup'
);
reset role;
select is((select added_by from public.words where word = 'r4-word'),
    '4a000000-0000-4000-8000-000000000002'::uuid,
    'the r4 addition actor comes from auth.uid()');

update public.docs
   set last_update = '2000-01-01'::timestamptz
 where id in (946001, 946002)
    or reference_code in (
        'ko.word-chain.long',
        'ko.reverse-word-chain.long',
        'ko.word-chain.mission.na',
        'ko.reverse-word-chain.mission.na',
        'ko.word-chain.mission',
        'ko.reverse-word-chain.mission'
    );
update public.docs
   set last_update = '2000-01-01'::timestamptz
 where reference_code in (
        'ko.word-chain.mission',
        'ko.reverse-word-chain.mission'
    );
create temporary table direct_add_rollback_snapshot as
select
    (select pg_catalog.count(*) from public.word_themes) as word_theme_count,
    (select total_words from public.words_count where id = 1) as total_words,
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(stat) order by stat.first_letter),
        '[]'::jsonb
     ) from public.word_first_letter_counts as stat) as first_stats,
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(stat) order by stat.last_letter),
        '[]'::jsonb
     ) from public.word_last_letter_counts as stat) as last_stats,
    (select pg_catalog.jsonb_object_agg(
        document.id::text,
        pg_catalog.to_jsonb(document.last_update)
        order by document.id
     ) from public.docs as document
       where document.id in (946001, 946002)
          or document.reference_code in (
              'ko.word-chain.long',
              'ko.reverse-word-chain.long',
              'ko.word-chain.mission.na',
              'ko.reverse-word-chain.mission.na',
              'ko.word-chain.mission',
              'ko.reverse-word-chain.mission'
          )) as docs_updates,
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(update_row) order by update_row.table_name),
        '[]'::jsonb
     ) from public.last_update as update_row) as table_updates;

create function pg_temp.fail_direct_addition_log()
returns trigger
language plpgsql
as $function$
begin
    if new.word = '나나나나나나나나Ω' then
        raise exception 'SENSITIVE_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger direct_addition_test_fail_log
before insert on public.logs
for each row execute function pg_temp.fail_direct_addition_log();
select pg_temp.set_direct_addition_actor('4a000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(
    $$select public.add_word_directly('나나나나나나나나Ω', array['direct-add-theme-a'])$$,
    'P0001', 'DIRECT_WORD_ADDITION_INTERNAL_ERROR',
    'unexpected database failures map to the stable internal code'
);
reset role;
drop trigger direct_addition_test_fail_log on public.logs;
select ok(
    not exists (select 1 from public.words where word = '나나나나나나나나Ω')
    and not exists (select 1 from public.logs where word = '나나나나나나나나Ω')
    and not exists (select 1 from public.docs_logs where word = '나나나나나나나나Ω'),
    'unexpected failures roll back the word, relations, and all logs'
);
select is(
    (select pg_catalog.count(*) from public.word_themes),
    (select word_theme_count from direct_add_rollback_snapshot),
    'unexpected failure rolls back every word-theme relation'
);
select is(
    (select total_words from public.words_count where id = 1),
    (select total_words from direct_add_rollback_snapshot),
    'unexpected failure rolls back the trigger-maintained global word count'
);
select is(
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(stat) order by stat.first_letter),
        '[]'::jsonb
     ) from public.word_first_letter_counts as stat),
    (select first_stats from direct_add_rollback_snapshot),
    'unexpected failure rolls back all first-letter statistics'
);
select is(
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(stat) order by stat.last_letter),
        '[]'::jsonb
     ) from public.word_last_letter_counts as stat),
    (select last_stats from direct_add_rollback_snapshot),
    'unexpected failure rolls back all last-letter statistics'
);
select is(
    (select pg_catalog.jsonb_object_agg(
        document.id::text,
        pg_catalog.to_jsonb(document.last_update)
        order by document.id
     ) from public.docs as document
       where document.id in (946001, 946002)
          or document.reference_code in (
              'ko.word-chain.long',
              'ko.reverse-word-chain.long',
              'ko.word-chain.mission.na',
              'ko.reverse-word-chain.mission.na',
              'ko.word-chain.mission',
              'ko.reverse-word-chain.mission'
          )),
    (select docs_updates from direct_add_rollback_snapshot),
    'unexpected failure rolls back ordinary and trigger-owned docs timestamps'
);
select is(
    (select coalesce(
        pg_catalog.jsonb_agg(pg_catalog.to_jsonb(update_row) order by update_row.table_name),
        '[]'::jsonb
     ) from public.last_update as update_row),
    (select table_updates from direct_add_rollback_snapshot),
    'unexpected failure rolls back trigger-maintained table timestamps'
);

select * from finish();
rollback;
