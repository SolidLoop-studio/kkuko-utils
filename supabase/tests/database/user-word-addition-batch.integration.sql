begin;

create or replace function pg_temp.set_word_addition_batch_actor(actor_id uuid)
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

insert into auth.users (id) values ('49000000-0000-4000-8000-000000000001');
insert into public.users (id, nickname, role) values
    ('49000000-0000-4000-8000-000000000001', 'word-addition-batch-owner', 'r1');
insert into public.themes (name, code) values
    ('대량 추가 주제 A', 'addition-batch-a'),
    ('대량 추가 주제 B', 'addition-batch-b'),
    ('대량 추가 주제 C', 'addition-batch-c'),
    ('대량 추가 실패 주제', 'addition-batch-failure');
insert into public.docs (id, name, typez) values
    (201, 'word-addition-batch-special-201', 'ect'),
    (202, 'word-addition-batch-special-202', 'ect')
on conflict (id) do nothing;

insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('addition-batch-registered', true, true, '49000000-0000-4000-8000-000000000001');
insert into public.word_themes (word_id, theme_id)
select word.id, theme.id from public.words as word, public.themes as theme
where word.word = 'addition-batch-registered' and theme.code = 'addition-batch-a';
insert into public.word_themes_wait (word_id, theme_id, typez, req_by)
select word.id, theme.id, 'add', '49000000-0000-4000-8000-000000000001'
from public.words as word, public.themes as theme
where word.word = 'addition-batch-registered' and theme.code = 'addition-batch-b';

insert into public.wait_words (word, requested_by, request_type) values
    ('addition-batch-pending', '49000000-0000-4000-8000-000000000001', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id from public.wait_words as wait_word, public.themes as theme
where wait_word.word = 'addition-batch-pending' and theme.code = 'addition-batch-a';

select no_plan();

select pg_temp.set_word_addition_batch_actor(null);
select throws_ok(
    $$select public.request_word_additions('[{"word":"unauthorized","themeCodes":[]}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_UNAUTHORIZED',
    'an unauthenticated batch is rejected'
);

select ok(
    (select routine.prosecdef from pg_catalog.pg_proc as routine
     where routine.oid = 'public.request_word_additions(jsonb)'::pg_catalog.regprocedure),
    'the batch RPC is a security definer function'
);
select is(
    (select pg_catalog.array_to_string(routine.proconfig, ',')
     from pg_catalog.pg_proc as routine
     where routine.oid = 'public.request_word_additions(jsonb)'::pg_catalog.regprocedure),
    'search_path=""',
    'the batch RPC uses an empty search path'
);
select ok(
    pg_catalog.has_function_privilege('authenticated', 'public.request_word_additions(jsonb)', 'EXECUTE'),
    'authenticated users can execute the batch RPC'
);
select ok(
    not pg_catalog.has_function_privilege('anon', 'public.request_word_additions(jsonb)', 'EXECUTE'),
    'anon cannot execute the batch RPC'
);
select ok(
    not exists (
        select 1
        from pg_catalog.pg_proc as routine
        cross join lateral pg_catalog.aclexplode(
            coalesce(routine.proacl, pg_catalog.acldefault('f', routine.proowner))
        ) as privilege
        where routine.oid = 'public.request_word_additions(jsonb)'::pg_catalog.regprocedure
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
    ),
    'public has no execute privilege on the batch RPC'
);

select pg_temp.set_word_addition_batch_actor('49000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_ok(
    $$select public.request_word_additions(null)$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'null input is rejected'
);
select throws_ok(
    $$select public.request_word_additions('[]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'an empty batch is rejected'
);
select throws_ok(
    $$select public.request_word_additions('{"word":"not-an-array"}')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'a non-array batch is rejected'
);
select throws_ok(
    $$select public.request_word_additions('[{"word":"bad","themeCodes":[],"extra":true}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'extra entry fields are rejected'
);
select throws_ok(
    $$select public.request_word_additions('[{"word":" ","themeCodes":[]}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'a blank word is rejected'
);
select throws_ok(
    $$select public.request_word_additions('[{"word":"duplicate","themeCodes":[]},{"word":" duplicate ","themeCodes":[]}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'duplicate normalized words are rejected'
);
select throws_ok(
    $$select public.request_word_additions('[{"word":"duplicate-theme","themeCodes":["addition-batch-a","addition-batch-a"]}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'duplicate themes are rejected'
);
select throws_ok(
    $$select public.request_word_additions(
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'word', 'too-many-themes',
            'themeCodes', (select pg_catalog.jsonb_agg('theme-' || value) from pg_catalog.generate_series(1, 101) as value)
        ))
    )$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'more than 100 themes for one word are rejected'
);
select throws_ok(
    $$select public.request_word_additions(
        (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('word', 'too-many-' || value, 'themeCodes', '[]'::jsonb))
         from pg_catalog.generate_series(1, 301) as value)
    )$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_INPUT', 'more than 300 words are rejected'
);
select throws_ok(
    $$select public.request_word_additions('[{"word":"unknown-theme","themeCodes":["missing"]}]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INVALID_THEME', 'an unknown theme is rejected'
);
reset role;

create temporary table word_addition_batch_results (name text primary key, result jsonb not null);
insert into word_addition_batch_results values (
    'first',
    public.request_word_additions('[
        {"word":"addition-batch-new","themeCodes":["addition-batch-b","addition-batch-a"]},
        {"word":"addition-batch-pending","themeCodes":["addition-batch-a","addition-batch-b"]},
        {"word":"addition-batch-registered","themeCodes":["addition-batch-a","addition-batch-b","addition-batch-c"]}
    ]')
);

select is(
    (select result from word_addition_batch_results where name = 'first'),
    '{"requestedWordCount":3,"createdWordRequestCount":1,"updatedWordRequestCount":1,"changedRegisteredWordCount":1,"createdThemeChangeRequestCount":1,"unchangedWordCount":0}'::jsonb,
    'the batch returns stable summary counts for every branch'
);
select is(
    (select requested_by from public.wait_words where word = 'addition-batch-new'),
    '49000000-0000-4000-8000-000000000001'::uuid,
    'new addition requests derive the requester from auth.uid'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_word_themes as relation
     join public.wait_words as request on request.id = relation.wait_word_id
     where request.word = 'addition-batch-new'),
    2,
    'a new request and all its themes are committed together'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_word_themes as relation
     join public.wait_words as request on request.id = relation.wait_word_id
     where request.word = 'addition-batch-pending'),
    2,
    'missing themes are added to an existing pending request'
);
select is(
    (select pg_catalog.count(*)::integer from public.word_themes_wait as pending_theme
     join public.words as word on word.id = pending_theme.word_id
     where word.word = 'addition-batch-registered'),
    2,
    'only missing registered-word theme requests are added'
);

insert into word_addition_batch_results values (
    'retry',
    public.request_word_additions('[
        {"word":"addition-batch-new","themeCodes":["addition-batch-a","addition-batch-b"]},
        {"word":"addition-batch-pending","themeCodes":["addition-batch-a","addition-batch-b"]},
        {"word":"addition-batch-registered","themeCodes":["addition-batch-a","addition-batch-b","addition-batch-c"]}
    ]')
);
select is(
    (select result ->> 'unchangedWordCount' from word_addition_batch_results where name = 'retry'),
    '3',
    'replaying a committed batch is idempotent and safe for resume'
);

create function pg_temp.fail_word_addition_batch_theme_insert()
returns trigger language plpgsql as $function$
begin
    if new.theme_id = (select id from public.themes where code = 'addition-batch-failure') then
        raise exception 'WORD_ADDITION_BATCH_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger word_addition_batch_test_fail_theme_insert
before insert on public.wait_word_themes
for each row execute function pg_temp.fail_word_addition_batch_theme_insert();

set local role authenticated;
select throws_ok(
    $$select public.request_word_additions('[
        {"word":"addition-batch-rollback-a","themeCodes":["addition-batch-a"]},
        {"word":"addition-batch-rollback-b","themeCodes":["addition-batch-failure"]}
    ]')$$,
    'P0001', 'WORD_ADDITION_BATCH_INTERNAL_ERROR',
    'an unexpected relation failure is exposed safely'
);
reset role;
drop trigger word_addition_batch_test_fail_theme_insert on public.wait_word_themes;
select is(
    (select pg_catalog.count(*)::integer from public.wait_words
     where word in ('addition-batch-rollback-a', 'addition-batch-rollback-b')),
    0,
    'a failure rolls back every word in the atomic RPC batch'
);

select * from finish();
rollback;
