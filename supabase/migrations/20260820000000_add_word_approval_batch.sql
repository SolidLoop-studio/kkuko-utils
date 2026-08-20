begin;

create schema if not exists private;

create table public.word_approval_operations (
    operation_id uuid primary key,
    actor_id uuid not null references public.users(id),
    input_hash text not null check (length(input_hash) = 64),
    total_entries integer not null check (total_entries > 0),
    total_batches integer not null check (total_batches > 0),
    status text not null default 'running' check (status in ('running', 'completed', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    completed_at timestamptz
);

create unique index word_approval_operations_running_input_key
    on public.word_approval_operations (actor_id, input_hash)
    where status = 'running';

create table public.word_approval_batches (
    operation_id uuid not null references public.word_approval_operations(operation_id) on delete cascade,
    batch_index integer not null check (batch_index >= 0),
    payload_hash text not null check (length(payload_hash) = 64),
    entry_count integer not null check (entry_count between 1 and 50),
    result jsonb not null,
    committed_at timestamptz not null default now(),
    primary key (operation_id, batch_index)
);

alter table public.word_approval_operations enable row level security;
alter table public.word_approval_batches enable row level security;

create or replace function private.assert_word_approval_admin()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_UNAUTHORIZED';
    end if;

    if not exists (
        select 1
        from public.users as app_user
        where app_user.id = actor
          and app_user.role = 'admin'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_FORBIDDEN';
    end if;

    return actor;
end;
$$;

create or replace function public.start_word_approval_operation(
    p_operation_id uuid,
    p_input_hash text,
    p_total_entries integer,
    p_total_batches integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid;
    operation_row public.word_approval_operations%rowtype;
    operation_result jsonb;
begin
    actor := private.assert_word_approval_admin();

    if p_operation_id is null
       or p_input_hash is null
       or p_input_hash !~ '^[0-9a-f]{64}$'
       or p_total_entries is null
       or p_total_batches is null
       or p_total_entries < 1
       or p_total_batches < 1
       or p_total_entries < p_total_batches
       or p_total_entries::bigint > p_total_batches::bigint * 50 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    select operation.*
    into operation_row
    from public.word_approval_operations as operation
    where operation.operation_id = p_operation_id
    for update;

    if found then
        if operation_row.actor_id <> actor
           or operation_row.input_hash <> p_input_hash
           or operation_row.total_entries <> p_total_entries
           or operation_row.total_batches <> p_total_batches then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_APPROVAL_CONFLICT';
        end if;
    else
        select operation.*
        into operation_row
        from public.word_approval_operations as operation
        where operation.actor_id = actor
          and operation.input_hash = p_input_hash
          and operation.status = 'running'
        for update;

        if found then
            if operation_row.total_entries <> p_total_entries
               or operation_row.total_batches <> p_total_batches then
                raise exception using
                    errcode = 'P0001',
                    message = 'WORD_APPROVAL_CONFLICT';
            end if;
        else
            insert into public.word_approval_operations (
                operation_id,
                actor_id,
                input_hash,
                total_entries,
                total_batches
            )
            values (
                p_operation_id,
                actor,
                p_input_hash,
                p_total_entries,
                p_total_batches
            )
            on conflict do nothing
            returning * into operation_row;

            if not found then
                select operation.*
                into operation_row
                from public.word_approval_operations as operation
                where operation.operation_id = p_operation_id
                for update;

                if found then
                    if operation_row.actor_id <> actor
                       or operation_row.input_hash <> p_input_hash
                       or operation_row.total_entries <> p_total_entries
                       or operation_row.total_batches <> p_total_batches then
                        raise exception using
                            errcode = 'P0001',
                            message = 'WORD_APPROVAL_CONFLICT';
                    end if;
                else
                    select operation.*
                    into operation_row
                    from public.word_approval_operations as operation
                    where operation.actor_id = actor
                      and operation.input_hash = p_input_hash
                      and operation.status = 'running'
                    for update;

                    if not found then
                        raise exception using
                            errcode = 'P0001',
                            message = 'WORD_APPROVAL_INTERNAL_ERROR';
                    end if;

                    if operation_row.total_entries <> p_total_entries
                       or operation_row.total_batches <> p_total_batches then
                        raise exception using
                            errcode = 'P0001',
                            message = 'WORD_APPROVAL_CONFLICT';
                    end if;
                end if;
            end if;
        end if;
    end if;

    select pg_catalog.jsonb_build_object(
        'operationId', operation.operation_id,
        'inputHash', operation.input_hash,
        'totalEntries', operation.total_entries,
        'totalBatches', operation.total_batches,
        'completedBatches', coalesce((
            select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'batchIndex', batch.batch_index,
                    'payloadHash', batch.payload_hash,
                    'result', batch.result
                )
                order by batch.batch_index
            )
            from public.word_approval_batches as batch
            where batch.operation_id = operation.operation_id
        ), '[]'::jsonb),
        'status', operation.status
    )
    into operation_result
    from public.word_approval_operations as operation
    where operation.operation_id = operation_row.operation_id;

    return operation_result;
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_APPROVAL_UNAUTHORIZED',
            'WORD_APPROVAL_FORBIDDEN',
            'WORD_APPROVAL_CONFLICT',
            'WORD_APPROVAL_INVALID_INPUT',
            'WORD_APPROVAL_INTERNAL_ERROR'
        ) then
            raise;
        end if;

        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
end;
$$;

create or replace function public.get_word_approval_operation(
    p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid;
    operation_result jsonb;
begin
    actor := private.assert_word_approval_admin();

    if p_operation_id is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    select pg_catalog.jsonb_build_object(
        'operationId', operation.operation_id,
        'inputHash', operation.input_hash,
        'totalEntries', operation.total_entries,
        'totalBatches', operation.total_batches,
        'completedBatches', coalesce((
            select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'batchIndex', batch.batch_index,
                    'payloadHash', batch.payload_hash,
                    'result', batch.result
                )
                order by batch.batch_index
            )
            from public.word_approval_batches as batch
            where batch.operation_id = operation.operation_id
        ), '[]'::jsonb),
        'status', operation.status
    )
    into operation_result
    from public.word_approval_operations as operation
    where operation.operation_id = p_operation_id
      and operation.actor_id = actor;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_NOT_FOUND';
    end if;

    return operation_result;
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_APPROVAL_UNAUTHORIZED',
            'WORD_APPROVAL_FORBIDDEN',
            'WORD_APPROVAL_NOT_FOUND',
            'WORD_APPROVAL_INVALID_INPUT'
        ) then
            raise;
        end if;

        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
end;
$$;

create or replace function public.apply_word_approval_batch(
    p_operation_id uuid,
    p_batch_index integer,
    p_total_batches integer,
    p_payload_hash text,
    p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid;
    operation_row public.word_approval_operations%rowtype;
    batch_row public.word_approval_batches%rowtype;
    entry_count integer;
    completed_batch_count integer;
    completed_entry_count integer;
    remaining_batch_count integer;
    remaining_entry_count integer;
    inserted_word_count integer := 0;
    added_theme_count integer := 0;
    removed_theme_count integer := 0;
    processed_request_count integer := 0;
    deleted_request_count integer := 0;
    entry_words text[];
    inserted_words jsonb := '[]'::jsonb;
    added_theme_pairs jsonb := '[]'::jsonb;
    removed_theme_pairs jsonb := '[]'::jsonb;
    affected_docs_raw jsonb := '[]'::jsonb;
    affected_docs_statement jsonb := '[]'::jsonb;
    affected_docs_ids jsonb := '[]'::jsonb;
    removed_theme_contributors jsonb := '[]'::jsonb;
    batch_result jsonb;
begin
    actor := private.assert_word_approval_admin();

    select operation.*
    into operation_row
    from public.word_approval_operations as operation
    where operation.operation_id = p_operation_id
    for update;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_NOT_FOUND';
    end if;

    if operation_row.actor_id <> actor then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_FORBIDDEN';
    end if;

    if p_total_batches is distinct from operation_row.total_batches then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_CONFLICT';
    end if;

    select batch.*
    into batch_row
    from public.word_approval_batches as batch
    where batch.operation_id = p_operation_id
      and batch.batch_index = p_batch_index;

    if found then
        if batch_row.payload_hash is distinct from p_payload_hash then
            raise exception using
                errcode = 'P0001',
                message = 'WORD_APPROVAL_CONFLICT';
        end if;

        return batch_row.result;
    end if;

    if operation_row.status <> 'running' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_CONFLICT';
    end if;

    if p_batch_index is null
       or p_batch_index < 0
       or p_batch_index >= operation_row.total_batches
       or p_payload_hash is null
       or p_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    select
        pg_catalog.count(*)::integer,
        coalesce(pg_catalog.sum(batch.entry_count), 0)::integer
    into completed_batch_count, completed_entry_count
    from public.word_approval_batches as batch
    where batch.operation_id = p_operation_id;

    if p_batch_index <> completed_batch_count then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_CONFLICT';
    end if;

    if p_entries is null or pg_catalog.jsonb_typeof(p_entries) <> 'array' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    entry_count := pg_catalog.jsonb_array_length(p_entries);

    if entry_count < 1 or entry_count > 50 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        where pg_catalog.jsonb_typeof(entry.value) <> 'object'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        where not (entry.value ? 'word')
           or not (entry.value ? 'themeCodes')
           or not (entry.value ? 'noinCanUse')
           or (((entry.value - 'word') - 'themeCodes') - 'noinCanUse') <> '{}'::jsonb
           or pg_catalog.jsonb_typeof(entry.value -> 'word') <> 'string'
           or pg_catalog.jsonb_typeof(entry.value -> 'themeCodes') <> 'array'
           or pg_catalog.jsonb_typeof(entry.value -> 'noinCanUse') <> 'boolean'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        where pg_catalog.length(entry.value ->> 'word') = 0
           or entry.value ->> 'word' ~ '^[[:space:]]'
           or entry.value ->> 'word' ~ '[[:space:]]$'
           or pg_catalog.jsonb_array_length(entry.value -> 'themeCodes') = 0
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        cross join lateral pg_catalog.jsonb_array_elements(entry.value -> 'themeCodes') as theme_code(value)
        where pg_catalog.jsonb_typeof(theme_code.value) <> 'string'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        cross join lateral pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
        where pg_catalog.length(theme_code.value) = 0
           or theme_code.value ~ '^[[:space:]]'
           or theme_code.value ~ '[[:space:]]$'
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        group by entry.value ->> 'word'
        having pg_catalog.count(*) > 1
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) with ordinality as entry(value, entry_index)
        cross join lateral pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
        group by entry.entry_index, theme_code.value
        having pg_catalog.count(*) > 1
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        cross join lateral pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
        where not exists (
            select 1
            from public.themes as theme
            where theme.code = theme_code.value
        )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    if exists (
        select 1
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        where ((entry.value ->> 'noinCanUse')::boolean) is distinct from (
            exists (
                select 1
                from pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
                cross join pg_catalog.generate_series(0, 53) as policy(code_index)
                where theme_code.value = (policy.code_index * 10)::text
            )
        )
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    remaining_batch_count := operation_row.total_batches - completed_batch_count - 1;
    remaining_entry_count := operation_row.total_entries - completed_entry_count - entry_count;

    if remaining_entry_count < remaining_batch_count
       or remaining_entry_count::bigint > remaining_batch_count::bigint * 50 then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_CONFLICT';
    end if;

    select pg_catalog.array_agg(entry.value ->> 'word' order by entry.value ->> 'word')
    into entry_words
    from pg_catalog.jsonb_array_elements(p_entries) as entry(value);

    perform wait_word.id
    from public.wait_words as wait_word
    where wait_word.request_type = 'add'
      and wait_word.word = any(entry_words)
    order by wait_word.id
    for update;

    perform word_row.id
    from public.words as word_row
    where word_row.word = any(entry_words)
    order by word_row.id
    for update;

    perform wait_theme.word_id
    from public.word_themes_wait as wait_theme
    join public.words as word_row on word_row.id = wait_theme.word_id
    where word_row.word = any(entry_words)
    order by wait_theme.word_id, wait_theme.theme_id
    for update of wait_theme;

    perform word_theme.word_id
    from public.word_themes as word_theme
    join public.words as word_row on word_row.id = word_theme.word_id
    where word_row.word = any(entry_words)
    order by word_theme.word_id, word_theme.theme_id
    for update of word_theme;

    with entry_data as (
        select
            entry.value ->> 'word' as word,
            (entry.value ->> 'noinCanUse')::boolean as noin_canuse
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
    ), inserted as (
        insert into public.words (
            word,
            k_canuse,
            noin_canuse,
            added_by
        )
        select
            entry.word,
            true,
            entry.noin_canuse,
            coalesce((
                select wait_word.requested_by
                from public.wait_words as wait_word
                where wait_word.word = entry.word
                  and wait_word.request_type = 'add'
                order by wait_word.id
                limit 1
            ), actor)
        from entry_data as entry
        order by entry.word
        on conflict (word) do nothing
        returning word, added_by
    )
    select coalesce(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'word', inserted.word,
                'added_by', inserted.added_by
            )
            order by inserted.word
        ),
        '[]'::jsonb
    )
    into inserted_words
    from inserted;

    inserted_word_count := pg_catalog.jsonb_array_length(inserted_words);

    perform word_row.id
    from public.words as word_row
    where word_row.word = any(entry_words)
    order by word_row.id
    for update;

    insert into public.logs (
        word,
        processed_by,
        make_by,
        r_type,
        state
    )
    select
        inserted.word,
        actor,
        inserted.added_by,
        'add',
        'approved'
    from pg_catalog.jsonb_to_recordset(inserted_words) as inserted(
        word text,
        added_by uuid
    );

    perform public.increment_contribution(
        target_id => contributor.added_by,
        inc_amount => contributor.amount
    )
    from (
        select
            inserted.added_by,
            pg_catalog.count(*)::integer as amount
        from pg_catalog.jsonb_to_recordset(inserted_words) as inserted(
            word text,
            added_by uuid
        )
        group by inserted.added_by
    ) as contributor;

    with inserted_logs as (
        insert into public.docs_logs (
            docs_id,
            word,
            add_by,
            type
        )
        select
            document.id,
            inserted.word,
            inserted.added_by,
            'add'
        from pg_catalog.jsonb_to_recordset(inserted_words) as inserted(
            word text,
            added_by uuid
        )
        join public.docs as document
          on document.typez = 'letter'
         and document.name = pg_catalog.right(inserted.word, 1)
        returning docs_id
    )
    select coalesce(pg_catalog.jsonb_agg(inserted_logs.docs_id), '[]'::jsonb)
    into affected_docs_statement
    from inserted_logs;

    affected_docs_raw := affected_docs_raw || affected_docs_statement;

    with desired_theme_pairs as (
        select
            entry.value ->> 'word' as word,
            theme.id as theme_id
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        cross join lateral pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
        join public.themes as theme on theme.code = theme_code.value
    ), inserted as (
        insert into public.word_themes (
            word_id,
            theme_id
        )
        select
            word_row.id,
            desired.theme_id
        from desired_theme_pairs as desired
        join public.words as word_row on word_row.word = desired.word
        on conflict (word_id, theme_id) do nothing
        returning word_id, theme_id
    )
    select coalesce(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'word', word_row.word,
                'theme_code', theme.code,
                'theme_name', theme.name
            )
            order by word_row.word, theme.code
        ),
        '[]'::jsonb
    )
    into added_theme_pairs
    from inserted
    join public.words as word_row on word_row.id = inserted.word_id
    join public.themes as theme on theme.id = inserted.theme_id;

    added_theme_count := pg_catalog.jsonb_array_length(added_theme_pairs);

    with added_pairs as (
        select pair.*
        from pg_catalog.jsonb_to_recordset(added_theme_pairs) as pair(
            word text,
            theme_code text,
            theme_name text
        )
    ), prepared_logs as (
        select
            document.id as docs_id,
            pair.word,
            coalesce(
                (
                    select wait_theme.req_by
                    from public.word_themes_wait as wait_theme
                    join public.words as word_row on word_row.id = wait_theme.word_id
                    join public.themes as theme on theme.id = wait_theme.theme_id
                    where word_row.word = pair.word
                      and theme.code = pair.theme_code
                      and wait_theme.typez = 'add'
                    limit 1
                ),
                (
                    select wait_word.requested_by
                    from public.wait_words as wait_word
                    join public.wait_word_themes as wait_word_theme
                      on wait_word_theme.wait_word_id = wait_word.id
                    join public.themes as theme on theme.id = wait_word_theme.theme_id
                    where wait_word.word = pair.word
                      and wait_word.request_type = 'add'
                      and theme.code = pair.theme_code
                    order by wait_word.id
                    limit 1
                ),
                actor
            ) as add_by
        from added_pairs as pair
        join public.docs as document
          on document.typez = 'theme'
         and document.name = pair.theme_name
    ), inserted_logs as (
        insert into public.docs_logs (
            docs_id,
            word,
            add_by,
            type
        )
        select
            prepared.docs_id,
            prepared.word,
            prepared.add_by,
            'add'
        from prepared_logs as prepared
        returning docs_id
    )
    select coalesce(pg_catalog.jsonb_agg(inserted_logs.docs_id), '[]'::jsonb)
    into affected_docs_statement
    from inserted_logs;

    affected_docs_raw := affected_docs_raw || affected_docs_statement;

    with desired_theme_pairs as (
        select
            entry.value ->> 'word' as word,
            theme_code.value as theme_code
        from pg_catalog.jsonb_array_elements(p_entries) as entry(value)
        cross join lateral pg_catalog.jsonb_array_elements_text(entry.value -> 'themeCodes') as theme_code(value)
    ), deleted as (
        delete from public.word_themes as word_theme
        using public.words as word_row, public.themes as theme
        where word_theme.word_id = word_row.id
          and word_theme.theme_id = theme.id
          and word_row.word = any(entry_words)
          and not exists (
              select 1
              from desired_theme_pairs as desired
              where desired.word = word_row.word
                and desired.theme_code = theme.code
          )
        returning word_row.word, theme.code, theme.name
    )
    select coalesce(
        pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
                'word', deleted.word,
                'theme_code', deleted.code,
                'theme_name', deleted.name
            )
            order by deleted.word, deleted.code
        ),
        '[]'::jsonb
    )
    into removed_theme_pairs
    from deleted;

    removed_theme_count := pg_catalog.jsonb_array_length(removed_theme_pairs);

    with removed_pairs as (
        select pair.*
        from pg_catalog.jsonb_to_recordset(removed_theme_pairs) as pair(
            word text,
            theme_code text,
            theme_name text
        )
    ), prepared_logs as (
        select
            document.id as docs_id,
            pair.word,
            coalesce((
                select wait_theme.req_by
                from public.word_themes_wait as wait_theme
                join public.words as word_row on word_row.id = wait_theme.word_id
                join public.themes as theme on theme.id = wait_theme.theme_id
                where word_row.word = pair.word
                  and theme.code = pair.theme_code
                  and wait_theme.typez = 'delete'
                limit 1
            ), actor) as add_by
        from removed_pairs as pair
        join public.docs as document
          on document.typez = 'theme'
         and document.name = pair.theme_name
    ), inserted_logs as (
        insert into public.docs_logs (
            docs_id,
            word,
            add_by,
            type
        )
        select
            prepared.docs_id,
            prepared.word,
            prepared.add_by,
            'delete'
        from prepared_logs as prepared
        returning docs_id, add_by
    )
    select
        coalesce(pg_catalog.jsonb_agg(inserted_logs.docs_id), '[]'::jsonb),
        coalesce(
            pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object('added_by', inserted_logs.add_by)
            ),
            '[]'::jsonb
        )
    into affected_docs_statement, removed_theme_contributors
    from inserted_logs;

    affected_docs_raw := affected_docs_raw || affected_docs_statement;

    perform public.increment_contribution(
        target_id => contributor.added_by,
        inc_amount => contributor.amount
    )
    from (
        select
            removed.added_by,
            pg_catalog.count(*)::integer as amount
        from pg_catalog.jsonb_to_recordset(removed_theme_contributors) as removed(
            added_by uuid
        )
        group by removed.added_by
    ) as contributor;

    with deleted_requests as (
        delete from public.word_themes_wait as wait_theme
        using public.words as word_row
        where wait_theme.word_id = word_row.id
          and word_row.word = any(entry_words)
        returning 1
    )
    select pg_catalog.count(*)::integer
    into deleted_request_count
    from deleted_requests;

    processed_request_count := processed_request_count + deleted_request_count;

    with deleted_requests as (
        delete from public.wait_words as wait_word
        where wait_word.request_type = 'add'
          and wait_word.word = any(entry_words)
        returning 1
    )
    select pg_catalog.count(*)::integer
    into deleted_request_count
    from deleted_requests;

    processed_request_count := processed_request_count + deleted_request_count;

    select coalesce(
        pg_catalog.jsonb_agg(affected.docs_id order by affected.docs_id),
        '[]'::jsonb
    )
    into affected_docs_ids
    from (
        select distinct document.id as docs_id
        from public.docs as document
        where document.id::text in (
            select affected_id.value
            from pg_catalog.jsonb_array_elements_text(affected_docs_raw) as affected_id(value)
        )
    ) as affected;

    if pg_catalog.jsonb_array_length(affected_docs_ids) > 0 then
        perform public.update_last_updates(
            docs_ids => pg_catalog.array_agg(affected.docs_id order by affected.docs_id)
        )
        from (
            select distinct document.id as docs_id
            from public.docs as document
            where document.id::text in (
                select affected_id.value
                from pg_catalog.jsonb_array_elements_text(affected_docs_ids) as affected_id(value)
            )
        ) as affected;
    end if;

    batch_result := pg_catalog.jsonb_build_object(
        'approvedWordCount', inserted_word_count,
        'addedThemeCount', added_theme_count,
        'removedThemeCount', removed_theme_count,
        'processedRequestCount', processed_request_count,
        'affectedDocsIds', affected_docs_ids
    );

    insert into public.word_approval_batches (
        operation_id,
        batch_index,
        payload_hash,
        entry_count,
        result
    )
    values (
        p_operation_id,
        p_batch_index,
        p_payload_hash,
        entry_count,
        batch_result
    );

    select pg_catalog.count(*)::integer
    into completed_batch_count
    from public.word_approval_batches as batch
    where batch.operation_id = p_operation_id;

    if completed_batch_count = operation_row.total_batches then
        update public.word_approval_operations as operation
        set status = 'completed',
            updated_at = pg_catalog.now(),
            completed_at = pg_catalog.now()
        where operation.operation_id = p_operation_id;
    else
        update public.word_approval_operations as operation
        set updated_at = pg_catalog.now()
        where operation.operation_id = p_operation_id;
    end if;

    return batch_result;
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_APPROVAL_UNAUTHORIZED',
            'WORD_APPROVAL_FORBIDDEN',
            'WORD_APPROVAL_NOT_FOUND',
            'WORD_APPROVAL_CONFLICT',
            'WORD_APPROVAL_INVALID_INPUT'
        ) then
            raise;
        end if;

        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
end;
$$;

create or replace function public.cancel_word_approval_operation(
    p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid;
    operation_row public.word_approval_operations%rowtype;
    operation_result jsonb;
begin
    actor := private.assert_word_approval_admin();

    if p_operation_id is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INVALID_INPUT';
    end if;

    select operation.*
    into operation_row
    from public.word_approval_operations as operation
    where operation.operation_id = p_operation_id
    for update;

    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_NOT_FOUND';
    end if;

    if operation_row.actor_id <> actor then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_FORBIDDEN';
    end if;

    if operation_row.status = 'completed' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_CONFLICT';
    end if;

    if operation_row.status = 'running' then
        update public.word_approval_operations as operation
        set status = 'cancelled',
            updated_at = pg_catalog.now()
        where operation.operation_id = p_operation_id;
    end if;

    select pg_catalog.jsonb_build_object(
        'operationId', operation.operation_id,
        'inputHash', operation.input_hash,
        'totalEntries', operation.total_entries,
        'totalBatches', operation.total_batches,
        'completedBatches', coalesce((
            select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                    'batchIndex', batch.batch_index,
                    'payloadHash', batch.payload_hash,
                    'result', batch.result
                )
                order by batch.batch_index
            )
            from public.word_approval_batches as batch
            where batch.operation_id = operation.operation_id
        ), '[]'::jsonb),
        'status', operation.status
    )
    into operation_result
    from public.word_approval_operations as operation
    where operation.operation_id = p_operation_id;

    return operation_result;
exception
    when raise_exception then
        if sqlerrm in (
            'WORD_APPROVAL_UNAUTHORIZED',
            'WORD_APPROVAL_FORBIDDEN',
            'WORD_APPROVAL_NOT_FOUND',
            'WORD_APPROVAL_CONFLICT',
            'WORD_APPROVAL_INVALID_INPUT'
        ) then
            raise;
        end if;

        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
    when others then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_APPROVAL_INTERNAL_ERROR';
end;
$$;

comment on function private.assert_word_approval_admin()
    is 'Validates the authenticated administrator for word approval RPCs.';
comment on function public.start_word_approval_operation(uuid, text, integer, integer)
    is 'Starts or resumes an actor-owned word approval operation.';
comment on function public.get_word_approval_operation(uuid)
    is 'Returns authoritative operation and committed batch metadata.';
comment on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb)
    is 'Atomically applies one sequential, idempotent word approval batch.';
comment on function public.cancel_word_approval_operation(uuid)
    is 'Idempotently cancels an actor-owned running word approval operation.';

revoke all on table public.word_approval_operations from public, anon, authenticated;
revoke all on table public.word_approval_batches from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

revoke all on function private.assert_word_approval_admin() from public, anon, authenticated;
revoke all on function public.start_word_approval_operation(uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.get_word_approval_operation(uuid) from public, anon, authenticated;
revoke all on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_word_approval_operation(uuid) from public, anon, authenticated;

grant execute on function public.start_word_approval_operation(uuid, text, integer, integer) to authenticated;
grant execute on function public.get_word_approval_operation(uuid) to authenticated;
grant execute on function public.apply_word_approval_batch(uuid, integer, integer, text, jsonb) to authenticated;
grant execute on function public.cancel_word_approval_operation(uuid) to authenticated;

commit;
