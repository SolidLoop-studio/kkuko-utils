begin;

create or replace function pg_temp.set_user_word_request_actor(actor_id uuid)
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
    ('45000000-0000-4000-8000-000000000001'),
    ('45000000-0000-4000-8000-000000000002');

insert into public.users (id, nickname, role) values
    ('45000000-0000-4000-8000-000000000001',
     'user-word-request-owner', 'r1'),
    ('45000000-0000-4000-8000-000000000002',
     'user-word-request-other', 'r1');

insert into public.docs (id, name, typez) values
    (201, 'user-word-request-special-201', 'ect'),
    (202, 'user-word-request-special-202', 'ect')
on conflict (id) do nothing;

insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('user-request-word', true, true,
     '45000000-0000-4000-8000-000000000001'),
    ('user-request-own-delete', true, true,
     '45000000-0000-4000-8000-000000000001'),
    ('user-request-other-delete', true, true,
     '45000000-0000-4000-8000-000000000002'),
    ('user-request-insert-rollback', true, true,
     '45000000-0000-4000-8000-000000000001'),
    ('user-request-delete-rollback', true, true,
     '45000000-0000-4000-8000-000000000001');

insert into public.wait_words (
    word, word_id, requested_by, request_type
) values (
    'user-request-own-add', null,
    '45000000-0000-4000-8000-000000000001', 'add'
);

insert into public.wait_words (
    word, word_id, requested_by, request_type
)
select word_row.word, word_row.id,
       '45000000-0000-4000-8000-000000000001', 'delete'
from public.words as word_row
where word_row.word in (
    'user-request-own-delete', 'user-request-delete-rollback'
);

insert into public.wait_words (
    word, word_id, requested_by, request_type
)
select word_row.word, word_row.id,
       '45000000-0000-4000-8000-000000000002', 'delete'
from public.words as word_row
where word_row.word = 'user-request-other-delete';

create temporary table user_word_request_cancel_fixture_ids as
select wait_word.word, wait_word.id
from public.wait_words as wait_word
where wait_word.word in (
    'user-request-own-add', 'user-request-own-delete'
);

create temporary table user_word_request_results (
    result_name text primary key,
    result jsonb not null
);

select no_plan();

select pg_temp.set_user_word_request_actor(null);
select throws_ok(
    $$select public.request_word_deletion('user-request-word')$$,
    'P0001', 'WORD_REQUEST_UNAUTHORIZED',
    'an unauthenticated deletion request is rejected'
);
select throws_ok(
    $$select public.cancel_word_request('user-request-own-add')$$,
    'P0001', 'WORD_REQUEST_UNAUTHORIZED',
    'an unauthenticated cancellation is rejected'
);

select ok(
    (
        select routine.prosecdef
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_deletion(text)'::pg_catalog.regprocedure
    ) and (
        select routine.prosecdef
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.cancel_word_request(text)'::pg_catalog.regprocedure
    ),
    'both user word request RPCs are security definer functions'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.request_word_deletion(text)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'deletion requests use an empty search path'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.cancel_word_request(text)'::pg_catalog.regprocedure
    ),
    'search_path=""',
    'request cancellation uses an empty search path'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.request_word_deletion(text)', 'EXECUTE'
    ) and pg_catalog.has_function_privilege(
        'authenticated', 'public.cancel_word_request(text)', 'EXECUTE'
    ),
    'authenticated users can execute both user word request RPCs'
);
select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.request_word_deletion(text)', 'EXECUTE'
    ) and not pg_catalog.has_function_privilege(
        'anon', 'public.cancel_word_request(text)', 'EXECUTE'
    ),
    'anon cannot execute either user word request RPC'
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
        where routine.oid in (
            'public.request_word_deletion(text)'::pg_catalog.regprocedure,
            'public.cancel_word_request(text)'::pg_catalog.regprocedure
        )
          and privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
    ),
    'public has no execute privilege on either user word request RPC'
);

select pg_temp.set_user_word_request_actor(
    '45000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select throws_ok(
    $$select public.request_word_deletion('   ')$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'a blank deletion request is rejected'
);
select throws_ok(
    $$select public.cancel_word_request('   ')$$,
    'P0001', 'WORD_REQUEST_INVALID_INPUT',
    'a blank cancellation is rejected'
);
select throws_ok(
    $$select public.request_word_deletion('user-request-missing')$$,
    'P0001', 'WORD_REQUEST_NOT_FOUND',
    'a deletion request for an unregistered word is rejected'
);
reset role;

insert into user_word_request_results (result_name, result)
values (
    'deletion',
    public.request_word_deletion(' user-request-word ')
);
select is(
    (
        select result from user_word_request_results
        where result_name = 'deletion'
    ),
    pg_catalog.jsonb_build_object(
        'requestId', (
            select id from public.wait_words
            where word = 'user-request-word'
        ),
        'word', 'user-request-word',
        'requestType', 'delete'
    ),
    'deletion request returns the public contract'
);

select is(
    (select requested_by from public.wait_words
     where word = 'user-request-word'),
    '45000000-0000-4000-8000-000000000001'::uuid,
    'the RPC stores auth.uid as the requester'
);

set local role authenticated;
select throws_ok(
    $$select public.request_word_deletion('user-request-word')$$,
    'P0001', 'WORD_REQUEST_CONFLICT',
    'a duplicate word request returns conflict'
);
reset role;

select is(
    public.cancel_word_request(' user-request-own-add '),
    pg_catalog.jsonb_build_object(
        'requestId', (
            select id from user_word_request_cancel_fixture_ids
            where word = 'user-request-own-add'
        ),
        'word', 'user-request-own-add',
        'requestType', 'add'
    ),
    'an actor can cancel their own pending add request'
);
select is(
    public.cancel_word_request('user-request-own-delete'),
    pg_catalog.jsonb_build_object(
        'requestId', (
            select id from user_word_request_cancel_fixture_ids
            where word = 'user-request-own-delete'
        ),
        'word', 'user-request-own-delete',
        'requestType', 'delete'
    ),
    'an actor can cancel their own pending delete request'
);
set local role authenticated;
select throws_ok(
    $$select public.cancel_word_request('user-request-other-delete')$$,
    'P0001', 'WORD_REQUEST_NOT_FOUND',
    'an actor cannot discover or cancel another actor request'
);
reset role;

select ok(
    not exists (
        select 1 from public.wait_words
        where word in ('user-request-own-add', 'user-request-own-delete')
    ) and exists (
        select 1 from public.wait_words
        where word = 'user-request-other-delete'
          and requested_by =
              '45000000-0000-4000-8000-000000000002'::uuid
    ),
    'cancellation deletes only the authenticated actor pending requests'
);

create function pg_temp.fail_user_word_request_change()
returns trigger
language plpgsql
as $function$
begin
    if tg_op = 'INSERT'
       and new.word = 'user-request-insert-rollback' then
        raise exception 'USER_WORD_REQUEST_TEST_FORCED_INSERT_FAILURE';
    end if;
    if tg_op = 'DELETE'
       and old.word = 'user-request-delete-rollback' then
        raise exception 'USER_WORD_REQUEST_TEST_FORCED_DELETE_FAILURE';
    end if;
    return coalesce(new, old);
end;
$function$;
create trigger user_word_request_test_fail_change
before insert or delete on public.wait_words
for each row execute function pg_temp.fail_user_word_request_change();

set local role authenticated;
select throws_ok(
    $$select public.request_word_deletion(
        'user-request-insert-rollback'
    )$$,
    'P0001', 'USER_WORD_REQUEST_TEST_FORCED_INSERT_FAILURE',
    'an injected insert failure is preserved'
);
select throws_ok(
    $$select public.cancel_word_request(
        'user-request-delete-rollback'
    )$$,
    'P0001', 'USER_WORD_REQUEST_TEST_FORCED_DELETE_FAILURE',
    'an injected delete failure is preserved'
);
reset role;
drop trigger user_word_request_test_fail_change on public.wait_words;

select ok(
    not exists (
        select 1 from public.wait_words
        where word = 'user-request-insert-rollback'
    ) and exists (
        select 1 from public.wait_words
        where word = 'user-request-delete-rollback'
          and requested_by =
              '45000000-0000-4000-8000-000000000001'::uuid
    ),
    'trigger failures roll back request insertion and cancellation'
);

select * from finish();
rollback;
