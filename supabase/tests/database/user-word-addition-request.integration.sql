begin;

create or replace function pg_temp.set_word_addition_request_actor(actor_id uuid)
returns void
language plpgsql
as $function$
begin
    perform pg_catalog.set_config(
        'request.jwt.claim.sub', coalesce(actor_id::text, ''), true
    );
    perform pg_catalog.set_config(
        'request.jwt.claims',
        case when actor_id is null then '{}'
             else pg_catalog.jsonb_build_object(
                 'sub', actor_id::text, 'role', 'authenticated'
             )::text
        end,
        true
    );
end;
$function$;

insert into auth.users (id)
values ('47000000-0000-4000-8000-000000000001');

insert into public.users (id, nickname, role)
values (
    '47000000-0000-4000-8000-000000000001',
    'word-addition-request-owner',
    'r1'
);

insert into public.themes (name, code) values
    ('추가 요청 주제 A', 'addition-theme-a'),
    ('추가 요청 주제 B', 'addition-theme-b'),
    ('추가 요청 실패 주제', 'addition-theme-failure');

insert into public.docs (id, name, typez) values
    (201, 'word-addition-request-special-201', 'ect'),
    (202, 'word-addition-request-special-202', 'ect')
on conflict (id) do nothing;

insert into public.words (word, k_canuse, noin_canuse, added_by)
values (
    'addition-already-registered', true, true,
    '47000000-0000-4000-8000-000000000001'
);

select no_plan();

select pg_temp.set_word_addition_request_actor(null);
select throws_ok(
    $$select public.request_word_addition(
        'addition-unauthorized', array[]::text[]
    )$$,
    'P0001', 'WORD_REQUEST_UNAUTHORIZED',
    'an unauthenticated addition request is rejected'
);

select ok(
    (
        select routine.prosecdef
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_addition(text,text[])'::pg_catalog.regprocedure
    ),
    'the addition request RPC is a security definer function'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_addition(text,text[])'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'addition requests use an empty search path'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated',
        'public.request_word_addition(text,text[])',
        'EXECUTE'
    ),
    'authenticated users can execute the addition request RPC'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon',
        'public.request_word_addition(text,text[])',
        'EXECUTE'
    ),
    'anon cannot execute the addition request RPC'
);
select ok(
    not exists (
        select 1
        from pg_catalog.pg_proc as routine
        cross join lateral pg_catalog.aclexplode(
            coalesce(
                routine.proacl,
                pg_catalog.acldefault('f', routine.proowner)
            )
        ) as privilege
        where routine.oid =
            'public.request_word_addition(text,text[])'::pg_catalog.regprocedure
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
    ),
    'public has no execute privilege on the addition request RPC'
);

select pg_temp.set_word_addition_request_actor(
    '47000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select throws_ok(
    $$select public.request_word_addition('   ', array[]::text[])$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'a blank word is rejected'
);
select throws_ok(
    $$select public.request_word_addition('addition-null-themes', null)$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'a null theme array is rejected'
);
select throws_ok(
    $$select public.request_word_addition(
        'addition-blank-theme', array['addition-theme-a', ' ']
    )$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'a blank theme code is rejected'
);
select throws_ok(
    $$select public.request_word_addition(
        'addition-duplicate-theme',
        array['addition-theme-a', 'addition-theme-a']
    )$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'duplicate theme codes are rejected'
);
select throws_ok(
    $$select public.request_word_addition(
        'addition-too-many-themes',
        array(select 'theme-' || value from pg_catalog.generate_series(1, 101) as value)
    )$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'more than 100 themes are rejected'
);
select throws_ok(
    $$select public.request_word_addition(
        'addition-unknown-theme', array['addition-theme-missing']
    )$$,
    'P0001', 'WORD_REQUEST_INVALID_THEME',
    'an unknown theme code is rejected'
);
select throws_ok(
    $$select public.request_word_addition(
        'addition-already-registered', array[]::text[]
    )$$,
    'P0001', 'WORD_REQUEST_ALREADY_REGISTERED',
    'an already registered word is rejected'
);
reset role;

create temporary table word_addition_request_results (
    result_name text primary key,
    result jsonb not null
);

insert into word_addition_request_results (result_name, result)
values (
    'with-themes',
    public.request_word_addition(
        ' addition-success ',
        array['addition-theme-b', 'addition-theme-a']
    )
), (
    'without-themes',
    public.request_word_addition(
        'addition-no-themes',
        array[]::text[]
    )
);

select is(
    (
        select result from word_addition_request_results
        where result_name = 'with-themes'
    ),
    pg_catalog.jsonb_build_object(
        'requestId', (
            select id from public.wait_words where word = 'addition-success'
        ),
        'word', 'addition-success',
        'requestType', 'add',
        'themes', pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'themeCode', 'addition-theme-a',
                'themeName', '추가 요청 주제 A'
            ),
            pg_catalog.jsonb_build_object(
                'themeCode', 'addition-theme-b',
                'themeName', '추가 요청 주제 B'
            )
        )
    ),
    'an addition request returns the stable sorted public contract'
);
select is(
    (
        select result -> 'themes' from word_addition_request_results
        where result_name = 'without-themes'
    ),
    '[]'::jsonb,
    'an addition request without themes returns an empty theme list'
);
select is(
    (
        select requested_by from public.wait_words
        where word = 'addition-success'
    ),
    '47000000-0000-4000-8000-000000000001'::uuid,
    'the RPC stores auth.uid as the requester'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.wait_word_themes as wait_theme
        join public.wait_words as wait_word
          on wait_word.id = wait_theme.wait_word_id
        where wait_word.word = 'addition-success'
    ),
    2,
    'the request and all selected themes are committed together'
);

set local role authenticated;
select throws_ok(
    $$select public.request_word_addition(
        'addition-success', array['addition-theme-a']
    )$$,
    'P0001', 'WORD_REQUEST_CONFLICT',
    'a duplicate addition request returns conflict'
);
reset role;

create function pg_temp.fail_word_addition_theme_insert()
returns trigger
language plpgsql
as $function$
begin
    if new.theme_id = (
        select id from public.themes where code = 'addition-theme-failure'
    ) then
        raise exception 'WORD_ADDITION_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger word_addition_test_fail_theme_insert
before insert on public.wait_word_themes
for each row execute function pg_temp.fail_word_addition_theme_insert();

set local role authenticated;
select throws_ok(
    $$select public.request_word_addition(
        'addition-rollback', array['addition-theme-failure']
    )$$,
    'P0001', 'WORD_REQUEST_INTERNAL_ERROR',
    'an unexpected relation insert failure is exposed safely'
);
reset role;
drop trigger word_addition_test_fail_theme_insert on public.wait_word_themes;

select ok(
    not exists (
        select 1 from public.wait_words where word = 'addition-rollback'
    ),
    'a theme relation failure rolls back the wait word row'
);

select * from finish();
rollback;
