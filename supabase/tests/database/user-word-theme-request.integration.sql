begin;

-- Simulate legacy-corrupt lookup data while keeping the real schema unchanged
-- after this transaction rolls back.
alter table public.themes drop constraint unique_code;

create or replace function pg_temp.set_user_word_theme_request_actor(
    actor_id uuid
)
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

insert into auth.users (id) values
    ('47000000-0000-4000-8000-000000000001');

insert into public.users (id, nickname, role) values
    ('47000000-0000-4000-8000-000000000001',
     'user-word-theme-request-owner', 'r1');

insert into public.docs (id, name, typez) values
    (201, 'user-word-theme-request-special-201', 'ect'),
    (202, 'user-word-theme-request-special-202', 'ect')
on conflict (id) do nothing;

insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('theme-request-word', true, true,
     '47000000-0000-4000-8000-000000000001'),
    ('theme-request-pending', true, true,
     '47000000-0000-4000-8000-000000000001'),
    ('theme-request-batch', true, true,
     '47000000-0000-4000-8000-000000000001'),
    ('theme-request-rollback', true, true,
     '47000000-0000-4000-8000-000000000001');

insert into public.themes (name, code) values
    ('Theme Request Existing', 'tr-existing'),
    ('Theme Request Missing Relation', 'tr-missing-relation'),
    ('Theme Request Pending', 'tr-pending'),
    ('Theme Request Batch Add', 'tr-batch-add'),
    ('Theme Request Batch Delete', 'tr-batch-delete'),
    ('Theme Request Rollback A', 'tr-rollback-a'),
    ('Theme Request Rollback B', 'tr-rollback-b'),
    ('Theme Request Ambiguous A', 'tr-ambiguous'),
    ('Theme Request Ambiguous B', 'tr-ambiguous');

insert into public.word_themes (word_id, theme_id)
select registered_word.id, theme.id
from public.words as registered_word
cross join public.themes as theme
where registered_word.word = 'theme-request-word'
  and theme.code = 'tr-existing';

insert into public.word_themes (word_id, theme_id)
select registered_word.id, theme.id
from public.words as registered_word
cross join public.themes as theme
where registered_word.word = 'theme-request-batch'
  and theme.code = 'tr-batch-delete';

insert into public.word_themes_wait (word_id, theme_id, typez, req_by)
select registered_word.id, theme.id, 'add',
       '47000000-0000-4000-8000-000000000001'
from public.words as registered_word
cross join public.themes as theme
where registered_word.word = 'theme-request-pending'
  and theme.code = 'tr-pending';

select no_plan();

select pg_temp.set_user_word_theme_request_actor(null);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-missing-relation","type":"add"}]'::jsonb
    )$$,
    'P0001', 'WORD_THEME_REQUEST_UNAUTHORIZED',
    'an unauthenticated word theme request is rejected'
);

select ok(
    (
        select routine.prosecdef
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_theme_changes(text,jsonb)'::pg_catalog.regprocedure
    ),
    'the word theme request RPC is a security definer function'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_theme_changes(text,jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'the word theme request RPC uses an empty search path'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated',
        'public.request_word_theme_changes(text,jsonb)',
        'EXECUTE'
    ),
    'authenticated users can execute the word theme request RPC'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon',
        'public.request_word_theme_changes(text,jsonb)',
        'EXECUTE'
    ),
    'anon cannot execute the word theme request RPC'
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
            'public.request_word_theme_changes(text,jsonb)'::pg_catalog.regprocedure
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
    ),
    'public has no execute privilege on the word theme request RPC'
);

select pg_temp.set_user_word_theme_request_actor(
    '47000000-0000-4000-8000-000000000001'
);
set local role authenticated;

select throws_ok(
    $$select public.request_word_theme_changes(
        null, '[{"themeCode":"tr-missing-relation","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a null word is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        '   ', '[{"themeCode":"tr-missing-relation","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a blank word is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes('theme-request-word', null)$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a null changes payload is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '{"themeCode":"tr-existing","type":"delete"}'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a non-array changes payload is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes('theme-request-word', '[]')$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'an empty changes array is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        (select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'themeCode', 'tr-code-' || item::text, 'type', 'add'
            )
        ) from pg_catalog.generate_series(1, 101) as item)
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'more than one hundred changes are rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"tr-existing"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a change missing type is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a change missing themeCode is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-existing","type":"delete","extra":true}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a change with an extra key is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[null]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a non-object array entry is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a blank theme code is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":" tr-existing","type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'leading theme code whitespace is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"tr-existing ","type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'trailing theme code whitespace is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"\ttr-existing","type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'non-space edge whitespace in a theme code is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":7,"type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a non-string theme code is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"tr-existing","type":7}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a non-string request type is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word', '[{"themeCode":"tr-existing","type":"replace"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a request type other than add or delete is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-existing","type":"delete"},
          {"themeCode":"tr-existing","type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a repeated theme code with the same type is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-existing","type":"delete"},
          {"themeCode":"tr-existing","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INVALID_INPUT',
    'a repeated theme code with opposite types is rejected'
);

select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-unknown',
        '[{"themeCode":"tr-missing-relation","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_NOT_FOUND',
    'an unregistered word is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-unknown","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_NOT_FOUND',
    'a missing theme is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-ambiguous","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_NOT_FOUND',
    'an ambiguous theme code is rejected'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-ambiguous","type":"add"},
          {"themeCode":"tr-unknown","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_NOT_FOUND',
    'missing and ambiguous theme counts cannot cancel each other out'
);

select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-existing","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_CONFLICT',
    'add conflicts when the relation already exists'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-word',
        '[{"themeCode":"tr-missing-relation","type":"delete"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_CONFLICT',
    'delete conflicts when the relation does not exist'
);
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-pending',
        '[{"themeCode":"tr-pending","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_CONFLICT',
    'an existing pending request conflicts'
);

reset role;

create temporary table user_word_theme_request_result (
    result jsonb not null
);
insert into user_word_theme_request_result (result)
values (
    public.request_word_theme_changes(
        ' theme-request-batch ',
        '[{"themeCode":"tr-batch-delete","type":"delete"},
          {"themeCode":"tr-batch-add","type":"add"}]'
    )
);

select is(
    (select result from user_word_theme_request_result),
    '{"word":"theme-request-batch","changes":[
       {"themeCode":"tr-batch-add","themeName":"Theme Request Batch Add","type":"add"},
       {"themeCode":"tr-batch-delete","themeName":"Theme Request Batch Delete","type":"delete"}
     ]}'::jsonb,
    'a mixed request returns the exact stable sorted JSON contract'
);
select is(
    (
        select pg_catalog.count(*)::integer
        from public.word_themes_wait as pending_request
        join public.words as registered_word
          on registered_word.id = pending_request.word_id
        join public.themes as theme
          on theme.id = pending_request.theme_id
        where registered_word.word = 'theme-request-batch'
          and theme.code in ('tr-batch-add', 'tr-batch-delete')
          and pending_request.req_by =
              '47000000-0000-4000-8000-000000000001'::uuid
    ),
    2,
    'every mixed request row stores auth.uid as req_by'
);

create function pg_temp.fail_user_word_theme_request_insert()
returns trigger
language plpgsql
as $function$
begin
    if new.theme_id = (
        select theme.id from public.themes as theme
        where theme.code = 'tr-rollback-b'
    ) then
        raise exception 'USER_WORD_THEME_REQUEST_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger user_word_theme_request_test_fail_insert
before insert on public.word_themes_wait
for each row execute function pg_temp.fail_user_word_theme_request_insert();

set local role authenticated;
select throws_ok(
    $$select public.request_word_theme_changes(
        'theme-request-rollback',
        '[{"themeCode":"tr-rollback-a","type":"add"},
          {"themeCode":"tr-rollback-b","type":"add"}]'
    )$$,
    'P0001', 'WORD_THEME_REQUEST_INTERNAL_ERROR',
    'an unexpected insert failure returns only the stable internal error'
);
reset role;
drop trigger user_word_theme_request_test_fail_insert
    on public.word_themes_wait;

select is(
    (
        select pg_catalog.count(*)::integer
        from public.word_themes_wait as pending_request
        join public.words as registered_word
          on registered_word.id = pending_request.word_id
        where registered_word.word = 'theme-request-rollback'
    ),
    0,
    'an unexpected failure rolls back every row in the batch'
);

select * from finish();
rollback;
