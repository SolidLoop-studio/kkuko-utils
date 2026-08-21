begin;

create or replace function pg_temp.set_moderation_actor(actor_id uuid)
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
    ('41000000-0000-4000-8000-000000000001'),
    ('41000000-0000-4000-8000-000000000002'),
    ('41000000-0000-4000-8000-000000000003'),
    ('41000000-0000-4000-8000-000000000004'),
    ('41000000-0000-4000-8000-000000000005'),
    ('41000000-0000-4000-8000-000000000006');

insert into public.users (id, nickname, role) values
    ('41000000-0000-4000-8000-000000000001', 'moderation-admin-a', 'admin'),
    ('41000000-0000-4000-8000-000000000002', 'moderation-admin-b', 'admin'),
    ('41000000-0000-4000-8000-000000000003', 'moderation-user', 'r1'),
    ('41000000-0000-4000-8000-000000000004', 'moderation-add-requester', 'r1'),
    ('41000000-0000-4000-8000-000000000005', 'moderation-delete-requester', 'r1'),
    ('41000000-0000-4000-8000-000000000006', 'moderation-theme-requester', 'r1');

update public.themes
set name = 'moderation-noin-theme'
where code = '530';

insert into public.themes (code, name) values
    ('moderation-secondary', 'moderation-secondary-theme'),
    ('moderation-unselected', 'moderation-unselected-theme'),
    ('moderation-delete-old', 'moderation-delete-old-theme'),
    ('moderation-change-add', 'moderation-change-add-theme'),
    ('moderation-change-delete', 'moderation-change-delete-theme'),
    ('moderation-change-unselected', 'moderation-change-unselected-theme'),
    ('540', 'moderation-outside-noin-theme');

insert into public.docs (id, name, typez, last_update) values
    (941003, 'moderation-unselected-theme', 'theme', '2000-01-01'),
    (941004, 'moderation-delete-old-theme', 'theme', '2000-01-01'),
    (941005, 'moderation-change-add-theme', 'theme', '2000-01-01'),
    (941006, 'moderation-change-delete-theme', 'theme', '2000-01-01'),
    (941007, 'moderation-change-unselected-theme', 'theme', '2000-01-01'),
    (941008, 'moderation-outside-noin-theme', 'theme', '2000-01-01'),
    (941010, 'y', 'letter', '2000-01-01'),
    (941011, 'q', 'letter', '2000-01-01'),
    (941012, 'r', 'letter', '2000-01-01'),
    (941013, 'm', 'letter', '2000-01-01');
insert into public.docs (id, name, typez)
values
    (201, 'moderation-special-201', 'ect'),
    (202, 'moderation-special-202', 'ect'),
    (209, 'moderation-special-209', 'ect'),
    (252, 'moderation-special-252', 'ect')
on conflict (id) do nothing;
update public.docs
set
    name = case id
        when 201 then 'x'
        when 209 then 'moderation-secondary-theme'
        when 252 then 'moderation-noin-theme'
    end,
    typez = (
        case when id = 201 then 'letter' else 'theme' end
    )::public.document_type,
    last_update = '2000-01-01'
where id in (201, 209, 252);

insert into public.words (word, k_canuse, noin_canuse, added_by) values
    ('moderation-delete-fixture-y', true, false,
     '41000000-0000-4000-8000-000000000001'),
    ('moderation-theme-fixture-z', true, true,
     '41000000-0000-4000-8000-000000000001'),
    ('moderation-reject-delete-y', true, false,
     '41000000-0000-4000-8000-000000000001'),
    ('moderation-reject-theme-z', true, false,
     '41000000-0000-4000-8000-000000000001');

insert into public.word_themes (word_id, theme_id)
select word_row.id, theme.id
from public.words as word_row
join public.themes as theme on
    (word_row.word = 'moderation-delete-fixture-y'
     and theme.code = 'moderation-delete-old')
    or (word_row.word = 'moderation-theme-fixture-z'
        and theme.code = 'moderation-change-delete')
    or (word_row.word = 'moderation-reject-delete-y'
        and theme.code = 'moderation-delete-old')
    or (word_row.word = 'moderation-reject-theme-z'
        and theme.code = 'moderation-change-delete');

insert into public.wait_words (word, requested_by, request_type)
values (
    'moderation-add-fixture-x',
    '41000000-0000-4000-8000-000000000004',
    'add'
);
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
join public.themes as theme on theme.code in (
    '530', 'moderation-secondary', 'moderation-unselected'
)
where wait_word.word = 'moderation-add-fixture-x';

insert into public.wait_words (
    word, word_id, requested_by, request_type
)
select word_row.word, word_row.id,
    '41000000-0000-4000-8000-000000000005', 'delete'
from public.words as word_row
where word_row.word = 'moderation-delete-fixture-y';

insert into public.word_themes_wait (word_id, theme_id, req_by, typez)
select word_row.id, theme.id,
    '41000000-0000-4000-8000-000000000006', request.typez
from public.words as word_row
cross join (
    values
        ('moderation-change-add', 'add'::public.request_type_enum),
        ('moderation-change-delete', 'delete'::public.request_type_enum),
        ('moderation-change-unselected', 'add'::public.request_type_enum)
) as request(code, typez)
join public.themes as theme on theme.code = request.code
where word_row.word = 'moderation-theme-fixture-z';

select no_plan();

select pg_temp.set_moderation_actor(null);
set local role anon;
select throws_ok(
    $$select public.approve_word_requests('[]'::jsonb)$$,
    '42501',
    'permission denied for function approve_word_requests',
    'anon cannot execute approval'
);
reset role;

set local role authenticated;
select throws_ok(
    $$select public.approve_word_requests('[]'::jsonb)$$,
    'P0001',
    'WORD_REQUEST_MODERATION_UNAUTHORIZED',
    'authenticated actor without a JWT is unauthorized'
);
reset role;

select pg_temp.set_moderation_actor(
    '41000000-0000-4000-8000-000000000003'
);
set local role authenticated;
select throws_ok(
    $$select public.reject_word_requests(
        '[{"kind":"word-request","requestId":1,"selectedThemeIds":[]}]'::jsonb
    )$$,
    'P0001',
    'WORD_REQUEST_MODERATION_FORBIDDEN',
    'ordinary authenticated users cannot moderate requests'
);
reset role;

select ok(
    not pg_catalog.has_function_privilege(
        'anon', 'public.approve_word_requests(jsonb)', 'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
        'anon', 'public.reject_word_requests(jsonb)', 'EXECUTE'
    ),
    'anon has no execute privilege on either moderation RPC'
);
select ok(
    pg_catalog.has_function_privilege(
        'authenticated', 'public.approve_word_requests(jsonb)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
        'service_role', 'public.approve_word_requests(jsonb)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
        'authenticated', 'public.reject_word_requests(jsonb)', 'EXECUTE'
    )
    and pg_catalog.has_function_privilege(
        'service_role', 'public.reject_word_requests(jsonb)', 'EXECUTE'
    ),
    'authenticated and service_role can execute both moderation RPCs'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.approve_word_requests(jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=pg_catalog, public, pg_temp',
    'approval uses the required trusted search path'
);
select is(
    (
        select pg_catalog.array_to_string(routine.proconfig, ',')
        from pg_catalog.pg_proc as routine
        where routine.oid =
            'public.reject_word_requests(jsonb)'::pg_catalog.regprocedure
    ),
    'search_path=pg_catalog, public, pg_temp',
    'rejection uses the required trusted search path'
);

select pg_temp.set_moderation_actor(
    '41000000-0000-4000-8000-000000000001'
);
set local role authenticated;
select throws_ok(
    $$select public.approve_word_requests('{}'::jsonb)$$,
    'P0001',
    'WORD_REQUEST_MODERATION_INVALID_INPUT',
    'approval rejects a non-array selection payload'
);
reset role;

set local role authenticated;
create temporary table moderation_approval_result (result jsonb not null);
insert into moderation_approval_result (result)
select public.approve_word_requests(
    pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (
                select wait_word.id from public.wait_words as wait_word
                where wait_word.word = 'moderation-add-fixture-x'
            ),
            'selectedThemeIds', pg_catalog.jsonb_build_array(
                (select theme.id from public.themes as theme
                 where theme.code = '530'),
                (select theme.id from public.themes as theme
                 where theme.code = 'moderation-secondary')
            )
        ),
        pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (
                select wait_word.id from public.wait_words as wait_word
                where wait_word.word = 'moderation-delete-fixture-y'
            ),
            'selectedThemeIds', '[]'::jsonb
        ),
        pg_catalog.jsonb_build_object(
            'kind', 'theme-change',
            'wordId', (
                select word_row.id from public.words as word_row
                where word_row.word = 'moderation-theme-fixture-z'
            ),
            'changes', pg_catalog.jsonb_build_array(
                pg_catalog.jsonb_build_object(
                    'themeId', (select theme.id from public.themes as theme
                                where theme.code = 'moderation-change-add'),
                    'type', 'add'
                ),
                pg_catalog.jsonb_build_object(
                    'themeId', (select theme.id from public.themes as theme
                                where theme.code = 'moderation-change-delete'),
                    'type', 'delete'
                )
            )
        )
    )
);
reset role;

select is(
    (select result from moderation_approval_result),
    '{"affectedDocsIds":[941004,941005,941006,941010],"processedThemeChangeCount":2,"processedWordRequestCount":2}'::jsonb,
    'mixed approval returns literal processed counts and sorted docs IDs'
);
select is(
    (select pg_catalog.count(*)::integer from public.words
     where word = 'moderation-add-fixture-x'
       and k_canuse and noin_canuse),
    1,
    'add approval inserts one usable word and derives noin_canuse from code 530'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = 'moderation-add-fixture-x'
       and theme.code in ('530', 'moderation-secondary')),
    2,
    'add approval connects both selected authoritative themes'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = 'moderation-add-fixture-x'
       and theme.code = 'moderation-unselected'),
    0,
    'add approval does not connect an unselected queued theme'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_words
     where word in ('moderation-add-fixture-x', 'moderation-delete-fixture-y')),
    0,
    'mixed approval removes both selected whole-word queue rows'
);
select is(
    (select pg_catalog.count(*)::integer from public.words
     where word = 'moderation-delete-fixture-y'),
    0,
    'delete approval deletes the authoritative word'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs
     where word = 'moderation-add-fixture-x'
       and r_type = 'add' and state = 'approved'
       and make_by = '41000000-0000-4000-8000-000000000004'
       and processed_by = '41000000-0000-4000-8000-000000000001'),
    1,
    'add approval writes one authoritative approved word log'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs
     where word = 'moderation-delete-fixture-y'
       and r_type = 'delete' and state = 'approved'
       and make_by = '41000000-0000-4000-8000-000000000005'
       and processed_by = '41000000-0000-4000-8000-000000000001'),
    1,
    'delete approval writes one authoritative approved word log'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-add-fixture-x'
       and docs_id = 201 and type = 'add'),
    1,
    'add approval leaves special final-letter docs ID 201 to its trigger exactly once'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-add-fixture-x'
       and docs_id in (209, 252) and type = 'add'),
    0,
    'add approval does not manually log trigger-managed theme-range docs IDs'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-delete-fixture-y'
       and docs_id in (941004, 941010) and type = 'delete'),
    2,
    'delete approval captures old theme and final-letter docs logs'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-delete-fixture-y'
       and docs_id = 201 and type = 'delete'),
    1,
    'delete approval leaves special docs log 201 to the word trigger exactly once'
);
select is(
    (select pg_catalog.count(*)::integer from public.docs_logs
     where word = 'moderation-delete-fixture-y'
       and docs_id = 202 and type = 'delete'),
    1,
    'delete approval leaves special docs log 202 to the word trigger exactly once'
);
select ok(
    (select pg_catalog.bool_and(document.last_update > '2000-01-01')
     from public.docs as document
     where document.id in (
         941004, 941005, 941006, 941010
     )),
    'approval updates every directly affected docs timestamp'
);
select is(
    (select contribution from public.users
     where id = '41000000-0000-4000-8000-000000000004'),
    1,
    'add approval increments the original requester once'
);
select is(
    (select contribution from public.users
     where id = '41000000-0000-4000-8000-000000000005'),
    1,
    'delete approval increments the original requester once'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = 'moderation-theme-fixture-z'
       and theme.code = 'moderation-change-add'),
    1,
    'selected theme add is applied'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes as word_theme
     join public.words as word_row on word_row.id = word_theme.word_id
     join public.themes as theme on theme.id = word_theme.theme_id
     where word_row.word = 'moderation-theme-fixture-z'
       and theme.code = 'moderation-change-delete'),
    0,
    'selected theme delete is applied'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes_wait as wait_theme
     join public.words as word_row on word_row.id = wait_theme.word_id
     where word_row.word = 'moderation-theme-fixture-z'),
    1,
    'selected theme wait rows disappear while the unselected row remains'
);
select is(
    (select pg_catalog.count(*)::integer
     from public.word_themes_wait as wait_theme
     join public.words as word_row on word_row.id = wait_theme.word_id
     join public.themes as theme on theme.id = wait_theme.theme_id
     where word_row.word = 'moderation-theme-fixture-z'
       and theme.code = 'moderation-change-unselected'),
    1,
    'the remaining theme wait row is the unselected request'
);
select is(
    (select contribution from public.users
     where id = '41000000-0000-4000-8000-000000000006'),
    0,
    'theme-change approval does not increment lifetime contribution'
);
select is(
    (select month_contribution from public.users
     where id = '41000000-0000-4000-8000-000000000006'),
    0,
    'theme-change approval does not increment monthly contribution'
);
select is(
    (select noin_canuse from public.words
     where word = 'moderation-theme-fixture-z'),
    true,
    'theme-change approval leaves the word noin_canuse value unchanged'
);

insert into public.wait_words (word, requested_by, request_type)
values ('moderation-540-fixture-q',
        '41000000-0000-4000-8000-000000000004', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = 'moderation-540-fixture-q' and theme.code = '540';
set local role authenticated;
select lives_ok(
    pg_catalog.format(
        'select public.approve_word_requests(%L::jsonb)',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (select id from public.wait_words
                          where word = 'moderation-540-fixture-q'),
            'selectedThemeIds', pg_catalog.jsonb_build_array(
                (select id from public.themes where code = '540')
            )
        ))::text
    ),
    'approval accepts an authoritative numeric theme outside the noin set'
);
reset role;
select is(
    (select pg_catalog.count(*)::integer from public.words
     where word = 'moderation-540-fixture-q' and not noin_canuse),
    1,
    'numeric theme code 540 is not treated as noin_canuse'
);

insert into public.wait_words (word, requested_by, request_type)
values ('moderation-reject-add-x',
        '41000000-0000-4000-8000-000000000004', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = 'moderation-reject-add-x' and theme.code = '530';
insert into public.wait_words (word, word_id, requested_by, request_type)
select word_row.word, word_row.id,
       '41000000-0000-4000-8000-000000000005', 'delete'
from public.words as word_row
where word_row.word = 'moderation-reject-delete-y';
insert into public.word_themes_wait (word_id, theme_id, req_by, typez)
select word_row.id, theme.id,
       '41000000-0000-4000-8000-000000000006', request.typez
from public.words as word_row
cross join (
    values
        ('moderation-change-add', 'add'::public.request_type_enum),
        ('moderation-change-unselected', 'add'::public.request_type_enum)
) as request(code, typez)
join public.themes as theme on theme.code = request.code
where word_row.word = 'moderation-reject-theme-z';

create temporary table moderation_rejection_baseline as
select
    (select pg_catalog.count(*) from public.docs_logs) as docs_log_count,
    (select pg_catalog.sum(contribution) from public.users
     where id in (
        '41000000-0000-4000-8000-000000000004',
        '41000000-0000-4000-8000-000000000005',
        '41000000-0000-4000-8000-000000000006'
     )) as contribution;
set local role authenticated;
create temporary table moderation_rejection_result (result jsonb not null);
insert into moderation_rejection_result (result)
select public.reject_word_requests(
    pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (select id from public.wait_words
                          where word = 'moderation-reject-add-x'),
            'selectedThemeIds', '[]'::jsonb
        ),
        pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (select id from public.wait_words
                          where word = 'moderation-reject-delete-y'),
            'selectedThemeIds', '[]'::jsonb
        ),
        pg_catalog.jsonb_build_object(
            'kind', 'theme-change',
            'wordId', (select id from public.words
                       where word = 'moderation-reject-theme-z'),
            'changes', pg_catalog.jsonb_build_array(
                pg_catalog.jsonb_build_object(
                    'themeId', (select id from public.themes
                                where code = 'moderation-change-add'),
                    'type', 'add'
                )
            )
        )
    )
);
reset role;
select is(
    (select result from moderation_rejection_result),
    '{"affectedDocsIds":[],"processedThemeChangeCount":1,"processedWordRequestCount":2}'::jsonb,
    'UI-real add rejection with empty themes returns exact counts and no docs IDs'
);
select is(
    (select pg_catalog.count(*)::integer from public.wait_words
     where word in ('moderation-reject-add-x', 'moderation-reject-delete-y')),
    0,
    'rejection removes selected whole-word requests'
);
select is(
    (select pg_catalog.count(*)::integer from public.word_themes_wait wt
     join public.words w on w.id = wt.word_id
     where w.word = 'moderation-reject-theme-z'),
    1,
    'rejection removes only the selected theme request'
);
select is(
    (select pg_catalog.count(*)::integer from public.logs
     where word in ('moderation-reject-add-x', 'moderation-reject-delete-y')
       and state = 'rejected'),
    2,
    'rejection writes rejected logs only for whole-word requests'
);
select ok(
    not exists (
        select 1 from public.words where word = 'moderation-reject-add-x'
    ) and exists (
        select 1 from public.words where word = 'moderation-reject-delete-y'
    ) and exists (
        select 1 from public.word_themes wt
        join public.words w on w.id = wt.word_id
        join public.themes t on t.id = wt.theme_id
        where w.word = 'moderation-reject-theme-z'
          and t.code = 'moderation-change-delete'
    ),
    'rejection does not mutate words or approved theme relations'
);
select ok(
    (select docs_log_count from moderation_rejection_baseline)
        = (select pg_catalog.count(*) from public.docs_logs)
    and (select contribution from moderation_rejection_baseline)
        = (select pg_catalog.sum(contribution) from public.users
           where id in (
              '41000000-0000-4000-8000-000000000004',
              '41000000-0000-4000-8000-000000000005',
              '41000000-0000-4000-8000-000000000006'
           )),
    'rejection creates no docs logs and changes no contribution'
);

set local role authenticated;
select throws_ok(
    $$select public.reject_word_requests(
        '[{"kind":"word-request","requestId":9007199254740991,"selectedThemeIds":[]}]'::jsonb
    )$$,
    'P0001',
    'WORD_REQUEST_MODERATION_CONFLICT',
    'a stale whole-word request ID is a conflict'
);
reset role;

insert into public.wait_words (word, requested_by, request_type)
values ('moderation-mismatch-fixture-x',
        '41000000-0000-4000-8000-000000000004', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = 'moderation-mismatch-fixture-x'
  and theme.code = 'moderation-secondary';
set local role authenticated;
select throws_ok(
    pg_catalog.format(
        'select public.approve_word_requests(%L::jsonb)',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (select id from public.wait_words
                          where word = 'moderation-mismatch-fixture-x'),
            'selectedThemeIds', pg_catalog.jsonb_build_array(
                (select id from public.themes where code = '530')
            )
        ))::text
    ),
    'P0001',
    'WORD_REQUEST_MODERATION_CONFLICT',
    'a selected theme outside the authoritative request membership conflicts'
);
reset role;
select ok(
    exists (select 1 from public.wait_words
            where word = 'moderation-mismatch-fixture-x')
    and not exists (select 1 from public.words
                    where word = 'moderation-mismatch-fixture-x')
    and not exists (select 1 from public.logs
                    where word = 'moderation-mismatch-fixture-x'),
    'mismatched preflight conflict has no side effects'
);

insert into public.wait_words (word, requested_by, request_type)
values ('moderation-null-requester-m', null, 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = 'moderation-null-requester-m'
  and theme.code = 'moderation-secondary';
insert into public.word_themes_wait (word_id, theme_id, req_by, typez)
select word_row.id, theme.id, null, 'add'
from public.words as word_row
cross join public.themes as theme
where word_row.word = 'moderation-theme-fixture-z'
  and theme.code = 'moderation-change-delete';
create temporary table moderation_null_requester_baseline as
select contribution
from public.users
where id = '41000000-0000-4000-8000-000000000001';

set local role authenticated;
select lives_ok(
    pg_catalog.format(
        'select public.approve_word_requests(%L::jsonb)',
        pg_catalog.jsonb_build_array(
            pg_catalog.jsonb_build_object(
                'kind', 'word-request',
                'requestId', (select id from public.wait_words
                              where word = 'moderation-null-requester-m'),
                'selectedThemeIds', pg_catalog.jsonb_build_array(
                    (select id from public.themes
                     where code = 'moderation-secondary')
                )
            ),
            pg_catalog.jsonb_build_object(
                'kind', 'theme-change',
                'wordId', (select id from public.words
                           where word = 'moderation-theme-fixture-z'),
                'changes', pg_catalog.jsonb_build_array(
                    pg_catalog.jsonb_build_object(
                        'themeId', (select id from public.themes
                                    where code = 'moderation-change-delete'),
                        'type', 'add'
                    )
                )
            )
        )::text
    ),
    'approval accepts null authoritative whole-word and theme requesters'
);
reset role;
select ok(
    exists (
        select 1 from public.words
        where word = 'moderation-null-requester-m'
          and added_by is null
    ) and exists (
        select 1 from public.logs
        where word = 'moderation-null-requester-m'
          and make_by is null and state = 'approved'
    ),
    'null whole-word requester remains null on the word and moderation log'
);
select ok(
    not exists (
        select 1 from public.docs_logs
        where word = 'moderation-null-requester-m'
          and add_by is not null
    ) and exists (
        select 1 from public.docs_logs
        where word = 'moderation-null-requester-m'
          and docs_id = 941013 and add_by is null and type = 'add'
    ) and exists (
        select 1 from public.docs_logs
        where word = 'moderation-theme-fixture-z'
          and docs_id = 941006 and add_by is null and type = 'add'
    ),
    'null whole-word and theme requesters remain null in docs logs'
);
select is(
    (select contribution from public.users
     where id = '41000000-0000-4000-8000-000000000001'),
    (select contribution from moderation_null_requester_baseline),
    'null requesters do not credit the moderator'
);

insert into public.wait_words (word, requested_by, request_type)
values ('moderation-rollback-fixture-r',
        '41000000-0000-4000-8000-000000000004', 'add');
insert into public.wait_word_themes (wait_word_id, theme_id)
select wait_word.id, theme.id
from public.wait_words as wait_word
cross join public.themes as theme
where wait_word.word = 'moderation-rollback-fixture-r'
  and theme.code = 'moderation-secondary';
create function pg_temp.fail_moderation_log()
returns trigger
language plpgsql
as $function$
begin
    if new.word = 'moderation-rollback-fixture-r' then
        raise exception 'MODERATION_TEST_FORCED_FAILURE';
    end if;
    return new;
end;
$function$;
create trigger word_request_moderation_test_fail_log
before insert on public.logs
for each row execute function pg_temp.fail_moderation_log();

create temporary table moderation_rollback_baseline as
select contribution from public.users
where id = '41000000-0000-4000-8000-000000000004';
set local role authenticated;
select throws_ok(
    pg_catalog.format(
        'select public.approve_word_requests(%L::jsonb)',
        pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'kind', 'word-request',
            'requestId', (select id from public.wait_words
                          where word = 'moderation-rollback-fixture-r'),
            'selectedThemeIds', pg_catalog.jsonb_build_array(
                (select id from public.themes
                 where code = 'moderation-secondary')
            )
        ))::text
    ),
    'P0001',
    'WORD_REQUEST_MODERATION_INTERNAL_ERROR',
    'unexpected logs trigger failure maps to the stable internal error'
);
reset role;
drop trigger word_request_moderation_test_fail_log on public.logs;
select ok(
    not exists (select 1 from public.words
                where word = 'moderation-rollback-fixture-r')
    and exists (select 1 from public.wait_words
                where word = 'moderation-rollback-fixture-r')
    and not exists (select 1 from public.logs
                    where word = 'moderation-rollback-fixture-r')
    and not exists (select 1 from public.docs_logs
                    where word = 'moderation-rollback-fixture-r')
    and (select contribution from moderation_rollback_baseline)
        = (select contribution from public.users
           where id = '41000000-0000-4000-8000-000000000004'),
    'internal failure rolls back word, queue, logs, docs logs, and contribution'
);

select * from finish();
rollback;
