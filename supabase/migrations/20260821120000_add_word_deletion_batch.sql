begin;

create schema if not exists private;

create table public.word_deletion_operations (
    operation_id uuid primary key,
    actor_id uuid not null references public.users(id),
    input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
    total_entries integer not null check (total_entries > 0),
    total_batches integer not null check (total_batches > 0),
    status text not null default 'running'
        check (status in ('running', 'completed', 'cancelled')),
    created_at timestamp with time zone not null default pg_catalog.now(),
    updated_at timestamp with time zone not null default pg_catalog.now()
);

create table public.word_deletion_batches (
    operation_id uuid not null
        references public.word_deletion_operations(operation_id) on delete cascade,
    batch_index integer not null check (batch_index >= 0),
    payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
    entry_count integer not null check (entry_count between 1 and 50),
    result jsonb not null,
    created_at timestamp with time zone not null default pg_catalog.now(),
    primary key (operation_id, batch_index)
);

create unique index word_deletion_operations_running_input_key
    on public.word_deletion_operations (actor_id, input_hash)
    where status = 'running';

alter table public.word_deletion_operations enable row level security;
alter table public.word_deletion_batches enable row level security;

create or replace function private.assert_word_deletion_admin()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
begin
    if actor is null then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_UNAUTHORIZED';
    end if;
    if not exists (
        select 1 from public.users as app_user
        where app_user.id = actor and app_user.role in ('r4', 'admin')
    ) then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_FORBIDDEN';
    end if;
    return actor;
end;
$$;

create or replace function private.word_deletion_operation_result(target_operation_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
    select pg_catalog.jsonb_build_object(
        'operationId', operation.operation_id,
        'inputHash', operation.input_hash,
        'totalEntries', operation.total_entries,
        'totalBatches', operation.total_batches,
        'completedBatches', coalesce((
            select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'batchIndex', batch.batch_index,
                'payloadHash', batch.payload_hash,
                'result', batch.result
            ) order by batch.batch_index)
            from public.word_deletion_batches as batch
            where batch.operation_id = operation.operation_id
        ), '[]'::jsonb),
        'status', operation.status
    )
    from public.word_deletion_operations as operation
    where operation.operation_id = target_operation_id;
$$;

create or replace function public.start_word_deletion_operation(
    p_operation_id uuid, p_input_hash text,
    p_total_entries integer, p_total_batches integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    actor uuid;
    operation_row public.word_deletion_operations%rowtype;
begin
    actor := private.assert_word_deletion_admin();
    if p_operation_id is null or p_input_hash is null
       or p_input_hash !~ '^[0-9a-f]{64}$'
       or p_total_entries is null or p_total_batches is null
       or p_total_entries < 1 or p_total_batches < 1
       or p_total_entries < p_total_batches
       or p_total_entries::bigint > p_total_batches::bigint * 50 then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;

    select operation.* into operation_row
    from public.word_deletion_operations as operation
    where operation.operation_id = p_operation_id for update;
    if found then
        if operation_row.actor_id <> actor or operation_row.input_hash <> p_input_hash
           or operation_row.total_entries <> p_total_entries
           or operation_row.total_batches <> p_total_batches then
            raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
        end if;
    else
        select operation.* into operation_row
        from public.word_deletion_operations as operation
        where operation.actor_id = actor and operation.input_hash = p_input_hash
          and operation.status = 'running' for update;
        if found then
            if operation_row.total_entries <> p_total_entries
               or operation_row.total_batches <> p_total_batches then
                raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
            end if;
        else
            insert into public.word_deletion_operations (
                operation_id, actor_id, input_hash, total_entries, total_batches
            ) values (
                p_operation_id, actor, p_input_hash, p_total_entries, p_total_batches
            ) on conflict do nothing returning * into operation_row;
            if not found then
                select operation.* into operation_row
                from public.word_deletion_operations as operation
                where operation.operation_id = p_operation_id for update;
                if found then
                    if operation_row.actor_id <> actor or operation_row.input_hash <> p_input_hash
                       or operation_row.total_entries <> p_total_entries
                       or operation_row.total_batches <> p_total_batches then
                        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
                    end if;
                else
                    select operation.* into operation_row
                    from public.word_deletion_operations as operation
                    where operation.actor_id = actor and operation.input_hash = p_input_hash
                      and operation.status = 'running' for update;
                    if not found then
                        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
                    end if;
                    if operation_row.total_entries <> p_total_entries
                       or operation_row.total_batches <> p_total_batches then
                        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
                    end if;
                end if;
            end if;
        end if;
    end if;
    return private.word_deletion_operation_result(operation_row.operation_id);
exception when raise_exception then
    if sqlerrm in ('WORD_DELETION_UNAUTHORIZED','WORD_DELETION_FORBIDDEN',
        'WORD_DELETION_CONFLICT','WORD_DELETION_INVALID_INPUT','WORD_DELETION_INTERNAL_ERROR') then raise; end if;
    raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
when others then
    raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
end;
$$;

create or replace function public.get_word_deletion_operation(p_operation_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare actor uuid; operation_row public.word_deletion_operations%rowtype;
begin
    actor := private.assert_word_deletion_admin();
    if p_operation_id is null then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    select operation.* into operation_row
    from public.word_deletion_operations as operation
    where operation.operation_id = p_operation_id and operation.actor_id = actor;
    if not found then raise exception using errcode = 'P0001', message = 'WORD_DELETION_NOT_FOUND'; end if;
    return private.word_deletion_operation_result(p_operation_id);
exception when raise_exception then
    if sqlerrm in ('WORD_DELETION_UNAUTHORIZED','WORD_DELETION_FORBIDDEN',
        'WORD_DELETION_NOT_FOUND','WORD_DELETION_INVALID_INPUT') then raise; end if;
    raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
when others then raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
end;
$$;

create or replace function public.apply_word_deletion_batch(
    p_operation_id uuid, p_batch_index integer, p_total_batches integer,
    p_payload_hash text, p_entries jsonb
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
    actor uuid;
    operation_row public.word_deletion_operations%rowtype;
    batch_row public.word_deletion_batches%rowtype;
    entry_count integer; completed_batch_count integer; completed_entry_count integer;
    remaining_batch_count integer; remaining_entry_count integer;
    entry_words text[]; actual_words jsonb := '[]'::jsonb;
    deleted_word_count integer := 0; protected_word_count integer := 0;
    missing_word_count integer := 0; processed_request_count integer := 0;
    statement_count integer := 0; affected_docs_ids bigint[] := array[]::bigint[];
    batch_result jsonb;
begin
    actor := private.assert_word_deletion_admin();
    if p_operation_id is null then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    select operation.* into operation_row
    from public.word_deletion_operations as operation
    where operation.operation_id = p_operation_id for update;
    if not found then raise exception using errcode = 'P0001', message = 'WORD_DELETION_NOT_FOUND'; end if;
    if operation_row.actor_id <> actor then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_FORBIDDEN';
    end if;
    if p_total_batches is distinct from operation_row.total_batches then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
    end if;
    select batch.* into batch_row from public.word_deletion_batches as batch
    where batch.operation_id = p_operation_id and batch.batch_index = p_batch_index;
    if found then
        if batch_row.payload_hash is distinct from p_payload_hash then
            raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
        end if;
        return batch_row.result;
    end if;
    if operation_row.status <> 'running' then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
    end if;
    if p_batch_index is null or p_batch_index < 0
       or p_batch_index >= operation_row.total_batches
       or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    select pg_catalog.count(*)::integer, coalesce(pg_catalog.sum(batch.entry_count),0)::integer
    into completed_batch_count, completed_entry_count
    from public.word_deletion_batches as batch where batch.operation_id = p_operation_id;
    if p_batch_index <> completed_batch_count then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
    end if;
    if p_entries is null or pg_catalog.jsonb_typeof(p_entries) <> 'array' then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    entry_count := pg_catalog.jsonb_array_length(p_entries);
    if entry_count < 1 or entry_count > 50 then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(p_entries) as item(value)
        where pg_catalog.jsonb_typeof(item.value) <> 'object'
           or not (item.value ? 'word') or (item.value - 'word') <> '{}'::jsonb
           or pg_catalog.jsonb_typeof(item.value -> 'word') <> 'string'
           or pg_catalog.length(item.value ->> 'word') = 0
           or item.value ->> 'word' ~ '^[[:space:]]'
           or item.value ->> 'word' ~ '[[:space:]]$') then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    if exists (select 1 from pg_catalog.jsonb_array_elements(p_entries) as item(value)
        group by item.value ->> 'word' having pg_catalog.count(*) > 1) then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INVALID_INPUT';
    end if;
    remaining_batch_count := operation_row.total_batches - completed_batch_count - 1;
    remaining_entry_count := operation_row.total_entries - completed_entry_count - entry_count;
    if remaining_entry_count < remaining_batch_count
       or remaining_entry_count::bigint > remaining_batch_count::bigint * 50 then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_CONFLICT';
    end if;

    select pg_catalog.array_agg(entry.word order by entry.word) into entry_words
    from pg_catalog.jsonb_to_recordset(p_entries) as entry(word text);

    perform word_row.id from public.words as word_row
    where word_row.word = any(entry_words) order by word_row.id for update;
    perform wait_word.id from public.wait_words as wait_word
    where wait_word.request_type = 'delete' and wait_word.word = any(entry_words)
    order by wait_word.id for update;
    perform wait_theme.word_id from public.word_themes_wait as wait_theme
    join public.words as word_row on word_row.id = wait_theme.word_id
    where wait_theme.typez = 'delete' and word_row.word = any(entry_words)
    order by wait_theme.word_id, wait_theme.theme_id for update of wait_theme;
    perform word_theme.word_id from public.word_themes as word_theme
    join public.words as word_row on word_row.id = word_theme.word_id
    where word_row.word = any(entry_words)
    order by word_theme.word_id, word_theme.theme_id for update of word_theme;

    select pg_catalog.count(*)::integer into missing_word_count
    from pg_catalog.unnest(entry_words) as entry(word)
    where not exists (select 1 from public.words as word_row where word_row.word = entry.word);
    select pg_catalog.count(*)::integer into protected_word_count
    from public.words as word_row where word_row.word = any(entry_words)
      and exists (select 1 from public.word_themes as word_theme
        join public.themes as theme on theme.id = word_theme.theme_id
        where word_theme.word_id = word_row.id and theme.code ~ '^[0-9]+$');
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'word_id', word_row.id, 'word', word_row.word,
        'whole_requester', requester.requested_by,
        'contributor', coalesce(requester.requested_by, actor),
        'k_canuse', word_row.k_canuse, 'word_length', word_row.length
    ) order by word_row.id), '[]'::jsonb) into actual_words
    from public.words as word_row
    left join lateral (select wait_word.requested_by
        from public.wait_words as wait_word
        where wait_word.word = word_row.word and wait_word.request_type = 'delete'
          and wait_word.requested_by is not null
        order by wait_word.requested_at, wait_word.id limit 1) as requester on true
    where word_row.word = any(entry_words)
      and not exists (select 1 from public.word_themes as word_theme
        join public.themes as theme on theme.id = word_theme.theme_id
        where word_theme.word_id = word_row.id and theme.code ~ '^[0-9]+$');
    deleted_word_count := pg_catalog.jsonb_array_length(actual_words);

    insert into public.logs (word, processed_by, make_by, r_type, state)
    select actual.word, actor, actual.contributor, 'delete', 'approved'
    from pg_catalog.jsonb_to_recordset(actual_words) as actual(
        word_id bigint, word text, whole_requester uuid, contributor uuid,
        k_canuse boolean, word_length integer
    );
    insert into public.docs_logs (docs_id, word, add_by, type)
    select document.id, actual.word, actual.contributor, 'delete'
    from pg_catalog.jsonb_to_recordset(actual_words) as actual(
        word_id bigint, word text, whole_requester uuid, contributor uuid,
        k_canuse boolean, word_length integer
    ) join public.docs as document on document.typez = 'letter'
      and pg_catalog.btrim(document.name) = pg_catalog.right(actual.word, 1);
    insert into public.docs_logs (docs_id, word, add_by, type)
    select document.id, actual.word,
        coalesce(actual.whole_requester, (select wait_theme.req_by
            from public.word_themes_wait as wait_theme
            where wait_theme.word_id = actual.word_id and wait_theme.theme_id = theme.id
              and wait_theme.typez = 'delete' and wait_theme.req_by is not null
            order by wait_theme.req_at limit 1), actor), 'delete'
    from pg_catalog.jsonb_to_recordset(actual_words) as actual(
        word_id bigint, word text, whole_requester uuid, contributor uuid,
        k_canuse boolean, word_length integer
    ) join public.word_themes as word_theme on word_theme.word_id = actual.word_id
      join public.themes as theme on theme.id = word_theme.theme_id
      join public.docs as document on document.typez = 'theme' and document.name = theme.name;

    select coalesce(pg_catalog.array_agg(affected.docs_id order by affected.docs_id), array[]::bigint[])
    into affected_docs_ids from (
        select distinct document.id as docs_id
        from pg_catalog.jsonb_to_recordset(actual_words) as actual(
            word_id bigint, word text, whole_requester uuid, contributor uuid,
            k_canuse boolean, word_length integer
        ) join public.docs as document on
            (document.typez = 'letter' and pg_catalog.btrim(document.name) = pg_catalog.right(actual.word,1))
            or (document.typez = 'theme' and exists (select 1
                from public.word_themes as word_theme join public.themes as theme
                  on theme.id = word_theme.theme_id
                where word_theme.word_id = actual.word_id and theme.name = document.name))
        union select document.id from pg_catalog.jsonb_to_recordset(actual_words) as actual(
            word_id bigint, word text, whole_requester uuid, contributor uuid,
            k_canuse boolean, word_length integer
        ) join public.docs as document on document.id in (201,202)
        where actual.k_canuse and actual.word_length >= 9
    ) as affected;

    with removed as (delete from public.word_themes_wait as wait_theme
        using public.words as word_row where wait_theme.word_id = word_row.id
          and wait_theme.typez = 'delete' and word_row.word = any(entry_words) returning 1)
    select pg_catalog.count(*)::integer into statement_count from removed;
    processed_request_count := processed_request_count + statement_count;
    with removed as (delete from public.wait_words as wait_word
        where wait_word.request_type = 'delete' and wait_word.word = any(entry_words) returning 1)
    select pg_catalog.count(*)::integer into statement_count from removed;
    processed_request_count := processed_request_count + statement_count;

    with removed as (delete from public.words as word_row where word_row.id in
        (select actual.word_id from pg_catalog.jsonb_to_recordset(actual_words) as actual(
            word_id bigint, word text, whole_requester uuid, contributor uuid,
            k_canuse boolean, word_length integer)) returning 1)
    select pg_catalog.count(*)::integer into statement_count from removed;
    if statement_count <> deleted_word_count then
        raise exception using errcode = 'P0001', message = 'WORD_DELETION_INTERNAL_ERROR';
    end if;
    perform public.increment_contribution(target_id => grouped.contributor, inc_amount => grouped.amount)
    from (select actual.contributor, pg_catalog.count(*)::integer as amount
        from pg_catalog.jsonb_to_recordset(actual_words) as actual(
            word_id bigint, word text, whole_requester uuid, contributor uuid,
            k_canuse boolean, word_length integer)
        group by actual.contributor) as grouped;
    if pg_catalog.cardinality(affected_docs_ids) > 0 then
        perform public.update_last_updates(docs_ids => affected_docs_ids);
    end if;
    batch_result := pg_catalog.jsonb_build_object(
        'deletedWordCount', deleted_word_count,
        'protectedWordCount', protected_word_count,
        'missingWordCount', missing_word_count,
        'processedRequestCount', processed_request_count,
        'affectedDocsIds', pg_catalog.to_jsonb(affected_docs_ids)
    );
    insert into public.word_deletion_batches(operation_id,batch_index,payload_hash,entry_count,result)
    values(p_operation_id,p_batch_index,p_payload_hash,entry_count,batch_result);
    if completed_batch_count + 1 = operation_row.total_batches then
        update public.word_deletion_operations set status='completed', updated_at=pg_catalog.now()
        where operation_id=p_operation_id;
    else
        update public.word_deletion_operations set updated_at=pg_catalog.now()
        where operation_id=p_operation_id;
    end if;
    return batch_result;
exception when raise_exception then
    if sqlerrm in ('WORD_DELETION_UNAUTHORIZED','WORD_DELETION_FORBIDDEN','WORD_DELETION_NOT_FOUND',
        'WORD_DELETION_CONFLICT','WORD_DELETION_INVALID_INPUT','WORD_DELETION_INTERNAL_ERROR') then raise; end if;
    raise exception using errcode='P0001', message='WORD_DELETION_INTERNAL_ERROR';
when others then raise exception using errcode='P0001', message='WORD_DELETION_INTERNAL_ERROR';
end;
$$;

create or replace function public.cancel_word_deletion_operation(p_operation_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare actor uuid; operation_row public.word_deletion_operations%rowtype;
begin
    actor := private.assert_word_deletion_admin();
    if p_operation_id is null then
        raise exception using errcode='P0001', message='WORD_DELETION_INVALID_INPUT';
    end if;
    select operation.* into operation_row from public.word_deletion_operations as operation
    where operation.operation_id=p_operation_id for update;
    if not found then raise exception using errcode='P0001', message='WORD_DELETION_NOT_FOUND'; end if;
    if operation_row.actor_id <> actor then raise exception using errcode='P0001', message='WORD_DELETION_FORBIDDEN'; end if;
    if operation_row.status='running' then update public.word_deletion_operations
        set status='cancelled',updated_at=pg_catalog.now() where operation_id=p_operation_id; end if;
    return private.word_deletion_operation_result(p_operation_id);
exception when raise_exception then
    if sqlerrm in ('WORD_DELETION_UNAUTHORIZED','WORD_DELETION_FORBIDDEN','WORD_DELETION_NOT_FOUND',
        'WORD_DELETION_INVALID_INPUT') then raise; end if;
    raise exception using errcode='P0001',message='WORD_DELETION_INTERNAL_ERROR';
when others then raise exception using errcode='P0001',message='WORD_DELETION_INTERNAL_ERROR';
end;
$$;

revoke all on table public.word_deletion_operations from public, anon, authenticated, service_role;
revoke all on table public.word_deletion_batches from public, anon, authenticated, service_role;
revoke all on function private.assert_word_deletion_admin() from public, anon, authenticated, service_role;
revoke all on function private.word_deletion_operation_result(uuid) from public, anon, authenticated, service_role;
revoke all on function public.start_word_deletion_operation(uuid,text,integer,integer) from public, anon;
revoke all on function public.get_word_deletion_operation(uuid) from public, anon;
revoke all on function public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb) from public, anon;
revoke all on function public.cancel_word_deletion_operation(uuid) from public, anon;
grant execute on function public.start_word_deletion_operation(uuid,text,integer,integer) to authenticated, service_role;
grant execute on function public.get_word_deletion_operation(uuid) to authenticated, service_role;
grant execute on function public.apply_word_deletion_batch(uuid,integer,integer,text,jsonb) to authenticated, service_role;
grant execute on function public.cancel_word_deletion_operation(uuid) to authenticated, service_role;

commit;
