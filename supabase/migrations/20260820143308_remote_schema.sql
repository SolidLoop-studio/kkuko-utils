

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE SCHEMA IF NOT EXISTS "private";


ALTER SCHEMA "private" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."document_type" AS ENUM (
    'letter',
    'theme',
    'ect'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE TYPE "public"."program_category" AS ENUM (
    'tool',
    'util',
    'other'
);


ALTER TYPE "public"."program_category" OWNER TO "postgres";


CREATE TYPE "public"."request_status_enum" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."request_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."request_type_enum" AS ENUM (
    'add',
    'delete'
);


ALTER TYPE "public"."request_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."role_level" AS ENUM (
    'r1',
    'r2',
    'r3',
    'r4',
    'admin'
);


ALTER TYPE "public"."role_level" OWNER TO "postgres";


CREATE TYPE "public"."word_type" AS ENUM (
    'ok',
    'deprecated'
);


ALTER TYPE "public"."word_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "private"."assert_word_approval_admin"() RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "private"."assert_word_approval_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "private"."assert_word_approval_admin"() IS 'Validates the authenticated administrator for word approval RPCs.';



CREATE OR REPLACE FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") IS 'Atomically applies one sequential, idempotent word approval batch.';



CREATE OR REPLACE FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") IS 'Idempotently cancels an actor-owned running word approval operation.';



CREATE OR REPLACE FUNCTION "public"."combine_hangul"("cho" "text", "jung" "text", "jong" "text" DEFAULT ''::"text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
    cho_pos int;
    jung_pos int;
    jong_pos int;
    cho_index int;
    jung_index int;
    jong_index int;
    code int;

    chosung text[] := array[
        'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
        'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
    ];

    jungsung text[] := array[
        'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ',
        'ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'
    ];

    jongsung text[] := array[
        '','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ',
        'ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ',
        'ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
    ];
begin
    -- cho 또는 jung이 NULL이면 파라미터 그대로 반환
    if cho is null or jung is null then
        return coalesce(cho,'') || coalesce(jung,'') || coalesce(jong,'');
    end if;

    cho_pos := array_position(chosung, cho);
    jung_pos := array_position(jungsung, jung);
    jong_pos := array_position(jongsung, jong); -- jong이 ''이면 첫 원소로 매치됨

    -- 배열에 없으면 에러 대신 원래 파라미터 문자열을 그대로 반환
    if cho_pos is null or jung_pos is null or jong_pos is null then
        return coalesce(cho,'') || coalesce(jung,'') || coalesce(jong,'');
    end if;

    cho_index := cho_pos - 1;
    jung_index := jung_pos - 1;
    jong_index := jong_pos - 1;

    code := 44032 + (cho_index * 21 * 28) + (jung_index * 28) + jong_index;

    return chr(code);
end;
$$;


ALTER FUNCTION "public"."combine_hangul"("cho" "text", "jung" "text", "jong" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decompose_hangul"("hangul" "text") RETURNS TABLE("cho" "text", "jung" "text", "jong" "text")
    LANGUAGE "plpgsql"
    AS $$
declare
    code int;
    cho_index int;
    jung_index int;
    jong_index int;

    chosung text[] := array[
        'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
        'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
    ];

    jungsung text[] := array[
        'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ',
        'ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'
    ];

    jongsung text[] := array[
        '','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ',
        'ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ',
        'ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
    ];
begin
    if hangul is null or char_length(hangul) = 0 then
        return query select null::text, null::text, null::text;
        return;
    end if;

    -- unicode() 대신 PostgreSQL의 내장 함수인 ascii() 사용
    code := ascii(left(hangul, 1));

    code := code - 44032; -- 한글 시작점 보정 (0xAC00)

    -- 한글 범위 밖이면 그대로 반환
    if code < 0 or code > 11171 then
        return query select hangul, null::text, null::text;
        return;
    end if;

    jong_index := code % 28;
    jung_index := (code / 28) % 21;
    cho_index := code / (21*28);

    return query select
        chosung[cho_index+1],
        jungsung[jung_index+1],
        jongsung[jong_index+1];
end;
$$;


ALTER FUNCTION "public"."decompose_hangul"("hangul" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrease_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_letter text;
    v_is_len3 boolean := (p_word_len = 3);
    v_now timestamptz := now() AT TIME ZONE 'utc';
BEGIN
    -- 1. 시작 글자 감소
    FOREACH v_letter IN ARRAY revers_duem(p_first_letter)
    LOOP
        UPDATE public.word_first_letter_counts SET 
            count = GREATEST(0, count - 1),
            count_updated_at = v_now,
            k_count = GREATEST(0, k_count - (CASE WHEN p_k_canuse THEN 1 ELSE 0 END)),
            k_count_updated_at = CASE WHEN p_k_canuse THEN v_now ELSE k_count_updated_at END,
            n_count = GREATEST(0, n_count - (CASE WHEN p_noin_canuse THEN 1 ELSE 0 END)),
            n_count_updated_at = CASE WHEN p_noin_canuse THEN v_now ELSE n_count_updated_at END,
            len3_count = GREATEST(0, len3_count - (CASE WHEN v_is_len3 THEN 1 ELSE 0 END)),
            len3_count_updated_at = CASE WHEN v_is_len3 THEN v_now ELSE len3_count_updated_at END,
            len3_k_count = GREATEST(0, len3_k_count - (CASE WHEN v_is_len3 AND p_k_canuse THEN 1 ELSE 0 END)),
            len3_k_count_updated_at = CASE WHEN v_is_len3 AND p_k_canuse THEN v_now ELSE len3_k_count_updated_at END,
            len3_n_count = GREATEST(0, len3_n_count - (CASE WHEN v_is_len3 AND p_noin_canuse THEN 1 ELSE 0 END)),
            len3_n_count_updated_at = CASE WHEN v_is_len3 AND p_noin_canuse THEN v_now ELSE len3_n_count_updated_at END
        WHERE first_letter = v_letter;
    END LOOP;

    -- 2. 끝 글자 감소
    FOREACH v_letter IN ARRAY revers_duem(p_last_letter)
    LOOP
        UPDATE public.word_last_letter_counts SET 
            count = GREATEST(0, count - 1),
            count_updated_at = v_now,
            k_count = GREATEST(0, k_count - (CASE WHEN p_k_canuse THEN 1 ELSE 0 END)),
            k_count_updated_at = CASE WHEN p_k_canuse THEN v_now ELSE k_count_updated_at END,
            n_count = GREATEST(0, n_count - (CASE WHEN p_noin_canuse THEN 1 ELSE 0 END)),
            n_count_updated_at = CASE WHEN p_noin_canuse THEN v_now ELSE n_count_updated_at END
        WHERE last_letter = v_letter;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."decrease_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_word_themes_bulk"("pairs" "jsonb") RETURNS TABLE("word_id" bigint, "word" "text", "theme_id" bigint, "theme_name" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  current_user_id uuid;
  user_role public.role_level;
  pair jsonb;
  v_word_id bigint;
  v_theme_id bigint;
begin
  -- 현재 사용자 확인
  select auth.uid() into current_user_id;
  -- 권한 확인
  select role into user_role from public.users where id = current_user_id;
  if user_role not in ('r4', 'admin') then
    raise exception 'Permission denied: must be r4 or admin';
  end if;
  -- 삭제 및 결과 수집
  for pair in select * from jsonb_array_elements(pairs)
  loop
    v_word_id := (pair ->> 'word_id')::bigint;
    v_theme_id := (pair ->> 'theme_id')::bigint;
    
    return query
    with deleted as (
      delete from public.word_themes as wt
      where wt.word_id = v_word_id and wt.theme_id = v_theme_id
      returning wt.word_id as del_word_id, wt.theme_id as del_theme_id
    )
    select
      d.del_word_id,  -- as word_id 제거
      w.word,
      d.del_theme_id, -- as theme_id 제거  
      t.name
    from deleted d
    join public.words w on w.id = d.del_word_id
    join public.themes t on t.id = d.del_theme_id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."delete_word_themes_bulk"("pairs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_word_themes_wait_bulk"("pairs" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  current_user_id uuid;
  user_role public.role_level;
  pair jsonb;
  _word_id bigint;
  _theme_id bigint;
begin
  select auth.uid() into current_user_id;

  select role into user_role
  from public.users
  where id = current_user_id;

  if user_role not in ('r4', 'admin') then
    raise exception 'Permission denied: you must be r4 or admin to perform this action';
  end if;

  for pair in select * from jsonb_array_elements(pairs)
  loop
    _word_id := (pair ->> 'word_id')::bigint;
    _theme_id := (pair ->> 'theme_id')::bigint;

    delete from public.word_themes_wait
    where word_id = _word_id and theme_id = _theme_id;
  end loop;
end;
$$;


ALTER FUNCTION "public"."delete_word_themes_wait_bulk"("pairs" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."duem"("letter" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_cho text;
    v_jung text;
    v_jong text;
    duem_letter text := letter;

    duem_list1 text[] := array['ㅏ','ㅐ','ㅗ','ㅚ','ㅜ','ㅡ'];
    duem_list2 text[] := array['ㅑ','ㅕ','ㅖ','ㅛ','ㅠ','ㅣ'];
    duem_list3 text[] := array['ㅕ','ㅛ','ㅠ','ㅣ'];
BEGIN
    IF letter IS NULL OR char_length(letter) = 0 THEN
        RETURN letter;
    END IF;

    SELECT d.cho, d.jung, d.jong
    INTO v_cho, v_jung, v_jong
    FROM decompose_hangul(letter) d;

    IF v_cho IS NULL OR v_jung IS NULL THEN
        RETURN letter;
    END IF;

    IF v_cho = 'ㄹ' AND v_jung = ANY(duem_list1) THEN
        duem_letter := combine_hangul('ㄴ', v_jung, v_jong);
    ELSIF v_cho = 'ㄹ' AND v_jung = ANY(duem_list2) THEN
        duem_letter := combine_hangul('ㅇ', v_jung, v_jong);
    ELSIF v_cho = 'ㄴ' AND v_jung = ANY(duem_list3) THEN
        duem_letter := combine_hangul('ㅇ', v_jung, v_jong);
    END IF;

    RETURN duem_letter;
END;
$$;


ALTER FUNCTION "public"."duem"("letter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_process_word_docs_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    letters TEXT[] := ARRAY['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    target_word TEXT;
    target_user UUID;
    log_type public.request_type_enum;
    target_id BIGINT;
    i INTEGER;
    word_len INTEGER;
BEGIN
    -- 1. INSERT/DELETE 상태에 따른 변수 설정
    IF (TG_OP = 'INSERT') THEN
        target_word := NEW.word;
        target_user := NEW.added_by;
        word_len := NEW.length;
        log_type := 'add';
    ELSIF (TG_OP = 'DELETE') THEN
        target_word := OLD.word;
        target_user := OLD.added_by;
        word_len := OLD.length;
        log_type := 'delete';
    END IF;

    -- 2. 글자 배열을 순회하며 포함 여부 확인
    FOR i IN 0..13 LOOP
        -- 해당 글자가 단어에 포함되어 있는지 확인
        IF target_word LIKE '%' || letters[i+1] || '%' THEN
            
            -- 업데이트 및 로그를 남길 ID 배열 생성 (기본 2개)
            -- 209 + index, 224 + index
            -- 단어 길이가 3이면 239 + index 추가 (예시의 239 패턴 적용)
            
            -- 루프 내에서 각 ID에 대해 작업 수행
            FOR target_id IN 
                SELECT unnest(
                    CASE 
                        WHEN word_len = 3 THEN ARRAY[209 + i, 224 + i, 239 + i]
                        ELSE ARRAY[209 + i, 224 + i]
                    END
                )
            LOOP
                -- docs 테이블 업데이트
                UPDATE public.docs 
                SET last_update = (now() AT TIME ZONE 'utc'::text)
                WHERE id = target_id;

                -- docs_logs 테이블에 로그 추가
                INSERT INTO public.docs_logs (docs_id, word, add_by, type, date)
                VALUES (target_id, target_word, target_user, log_type, (now() AT TIME ZONE 'utc'::text));
            END LOOP;
            
        END IF;
    END LOOP;

    RETURN NULL; -- AFTER 트리거이므로 리턴값은 중요하지 않음
END;
$$;


ALTER FUNCTION "public"."fn_process_word_docs_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_chosungs"("hangul" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE STRICT
    AS $$
declare
    i int;
    ch text;
    code int;
    cho_index int;
    result text := '';

    chosung text[] := array[
        'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ',
        'ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'
    ];
begin
    if hangul is null or char_length(hangul) = 0 then
        return null;
    end if;

    for i in 1..char_length(hangul) loop
        ch := substr(hangul, i, 1);
        code := ascii(left(ch, 1)); 
        code := code - 44032;

        if code between 0 and 11171 then
            cho_index := code / (21 * 28);
            result := result || chosung[cho_index + 1];
        else
            result := result || ch;  -- 한글 아닌 문자면 그대로
        end if;
    end loop;

    return result;
end;
$$;


ALTER FUNCTION "public"."get_chosungs"("hangul" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_delete_requests_by_themeid"("input_theme_id" bigint) RETURNS TABLE("word" "text", "requested_by" "uuid", "request_type" "public"."request_type_enum")
    LANGUAGE "sql" STABLE
    AS $$
  select
    w.word,
    ww.requested_by,
    ww.request_type
  from
    word_themes wt
  join words w on w.id = wt.word_id
  join wait_words ww on ww.word_id = w.id
  where
    wt.theme_id = input_theme_id
    and ww.request_type = 'delete';
$$;


ALTER FUNCTION "public"."get_delete_requests_by_themeid"("input_theme_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_doc_rank"("doc_id" bigint) RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select rank from (
    select id, rank() over (order by views desc) as rank
    from public.docs
    where is_hidden = false
  ) ranked_docs
  where id = doc_id;
$$;


ALTER FUNCTION "public"."get_doc_rank"("doc_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_korean_words_advanced_e"("p_start" "text" DEFAULT NULL::"text", "p_end" "text" DEFAULT NULL::"text", "p_ingjung" boolean DEFAULT true, "p_mission" "text" DEFAULT ''::"text", "p_man" boolean DEFAULT false, "p_jen" boolean DEFAULT false, "p_eti" boolean DEFAULT false, "p_length_min" integer DEFAULT NULL::integer, "p_length_max" integer DEFAULT NULL::integer, "p_sort_by" "text" DEFAULT 'length'::"text", "p_limit" integer DEFAULT 20, "p_duem" boolean DEFAULT true) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
  base_where text;
  query text;
  count_col text;
  sort_logic text;
  join_table text;
  v_duem_char text;
  v_limit_clause text; -- LIMIT 구문을 담을 변수
BEGIN
  join_table := ' public.word_last_letter_counts s ON w.first_letter = s.last_letter ';
  count_col := CASE WHEN p_ingjung THEN 's.k_count' ELSE 's.n_count' END;

  base_where := ' WHERE w.k_canuse = true ';
  IF NOT p_ingjung THEN
    base_where := base_where || ' AND w.noin_canuse = true ';
  END IF;

  IF p_length_min IS NOT NULL THEN
    base_where := base_where || ' AND w.length >= ' || p_length_min;
  END IF;
  IF p_length_max IS NOT NULL THEN
    base_where := base_where || ' AND w.length <= ' || p_length_max;
  END IF;

  IF p_end IS NOT NULL AND p_end <> '' THEN
    IF length(p_end) = 1 THEN
        IF p_duem THEN
            v_duem_char := public.duem(p_end);
            IF v_duem_char <> p_end THEN
                base_where := base_where || format(' AND w.last_letter IN (%L, %L) ', p_end, v_duem_char);
            ELSE
                base_where := base_where || format(' AND w.last_letter = %L ', p_end);
            END IF;
        ELSE
            base_where := base_where || format(' AND w.last_letter = %L ', p_end);
        END IF;
    ELSE
        base_where := base_where || format(' AND w.word LIKE %L ', '%' || p_end );
    END IF;
  END IF;

  IF p_start IS NOT NULL AND p_start <> '' THEN
    IF length(p_start) = 1 THEN
      base_where := base_where || format(' AND w.first_letter = %L ', p_start);
    ELSE
      base_where := base_where || format(' AND w.word LIKE %L ', '%' || p_start);
    END IF;
  END IF;

  IF p_ingjung THEN
    IF p_man THEN base_where := base_where || format(' AND %s > 0 ', count_col);
    ELSIF p_jen THEN base_where := base_where || format(' AND %s >= 10 ', count_col);
    ELSIF p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    END IF;
  ELSE
    IF p_man OR p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    ELSIF p_jen THEN base_where := base_where || ' AND s.n_count >= 10 ';
    END IF;
  END IF;

  -- 정렬 로직
  sort_logic := '';
  IF p_sort_by = 'attack' THEN
    sort_logic := format(' COALESCE(%s, 0) ASC, ', count_col);
  ELSIF p_sort_by = 'abc' THEN
    sort_logic := ' w.word ASC, ';
  END IF;
  sort_logic := sort_logic || ' w.length DESC, w.word ASC ';

  IF p_limit IS NULL OR p_limit = -1 THEN
    v_limit_clause := ''; -- 제한 없음
  ELSE
    v_limit_clause := ' LIMIT ' || p_limit;
  END IF;

  -- 쿼리 생성
  IF p_mission IS NOT NULL AND p_mission <> '' THEN
    query := 
      'SELECT word FROM (' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, (length(w.word) - length(replace(w.word, ' || quote_literal(p_mission) || ', ''''))) AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND w.word LIKE ' || quote_literal('%' || p_mission || '%') ||
        ' ORDER BY mission_score DESC, ' || sort_logic ||
        v_limit_clause || -- 내부 유니온 1
      ' ) ' ||
      ' UNION ALL ' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, 0 AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND NOT (w.word LIKE ' || quote_literal('%' || p_mission || '%') || ')' ||
        ' ORDER BY ' || sort_logic ||
        v_limit_clause || -- 내부 유니온 2
      ' ) ' ||
      ') AS combined_result ' ||
      ' ORDER BY mission_score DESC, word_length DESC, word ASC ' ||
      v_limit_clause || ';'; -- 최종 결과
  ELSE
    query := 
      'SELECT w.word FROM public.words w LEFT JOIN ' || join_table ||
      base_where ||
      ' ORDER BY ' || sort_logic ||
      v_limit_clause || ';';
  END IF;

  RETURN QUERY EXECUTE query;
END;$$;


ALTER FUNCTION "public"."get_korean_words_advanced_e"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_korean_words_advanced_hunmin"("p_chosungs" "text", "p_limit" integer, "p_mission" "text" DEFAULT NULL::"text") RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
    query text;
    v_limit_clause text;
BEGIN
    -- 1. LIMIT 구문 처리
    IF p_limit IS NULL OR p_limit < 0 THEN
        v_limit_clause := ''; -- 음수면 전체 조회
    ELSE
        v_limit_clause := ' LIMIT ' || p_limit;
    END IF;

    -- 2. 동적 쿼리 생성
    query := 
        'SELECT w.word ' ||
        'FROM public.words w ' ||
        'WHERE w.chosungs = ' || quote_literal(p_chosungs) || 
        ' ORDER BY ' ||
        '    CASE WHEN ' || quote_nullable(p_mission) || ' IS NOT NULL ' ||
        '         THEN (length(w.word) - length(replace(w.word, ' || quote_nullable(p_mission) || ', ''''))) ' ||
        '    END DESC NULLS LAST, ' ||
        '    CASE WHEN ' || quote_nullable(p_mission) || ' IS NULL ' ||
        '         THEN w.word ' ||
        '    END ASC ' ||
        v_limit_clause || ';';

    -- 3. 실행 및 결과 반환
    RETURN QUERY EXECUTE query;
END;$$;


ALTER FUNCTION "public"."get_korean_words_advanced_hunmin"("p_chosungs" "text", "p_limit" integer, "p_mission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_korean_words_advanced_jaqi"("p_chosungs" "text", "p_theme_id" bigint) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT w.word
    FROM public.words w
    JOIN public.word_themes wt ON wt.word_id = w.id
    WHERE wt.theme_id = p_theme_id
      AND w.chosungs LIKE (p_chosungs || '%');
END;
$$;


ALTER FUNCTION "public"."get_korean_words_advanced_jaqi"("p_chosungs" "text", "p_theme_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_korean_words_advanced_kung"("p_start" "text" DEFAULT NULL::"text", "p_end" "text" DEFAULT NULL::"text", "p_ingjung" boolean DEFAULT true, "p_mission" "text" DEFAULT ''::"text", "p_man" boolean DEFAULT false, "p_jen" boolean DEFAULT false, "p_eti" boolean DEFAULT false, "p_sort_by" "text" DEFAULT 'abc'::"text", "p_limit" integer DEFAULT 20, "p_duem" boolean DEFAULT true) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
  base_where text;
  query text;
  count_col text;
  sort_logic text;
  join_table text;
  v_duem_char text;
  v_limit_clause text;
BEGIN
  join_table := ' public.word_first_letter_counts s ON w.last_letter = s.first_letter ';
  count_col := CASE WHEN p_ingjung THEN 's.len3_k_count' ELSE 's.len3_n_count' END;

  base_where := ' WHERE w.k_canuse = true AND w.length = 3 ';
  IF NOT p_ingjung THEN
    base_where := base_where || ' AND w.noin_canuse = true ';
  END IF;

  IF p_start IS NOT NULL AND p_start <> '' THEN
    IF length(p_start) = 1 THEN
        IF p_duem THEN
            v_duem_char := public.duem(p_start);
            IF v_duem_char <> p_start THEN
                base_where := base_where || format(' AND w.first_letter IN (%L, %L) ', p_start, v_duem_char);
            ELSE
                base_where := base_where || format(' AND w.first_letter = %L ', p_start);
            END IF;
        ELSE
            base_where := base_where || format(' AND w.first_letter = %L ', p_start);
        END IF;
    ELSE
        base_where := base_where || format(' AND w.word LIKE %L ', p_start || '%');
    END IF;
  END IF;

  IF p_end IS NOT NULL AND p_end <> '' THEN
    IF length(p_end) = 1 THEN
      base_where := base_where || format(' AND w.last_letter = %L ', p_end);
    ELSE
      base_where := base_where || format(' AND w.word LIKE %L ', '%' || p_end);
    END IF;
  END IF;

  IF p_ingjung THEN
    IF p_man THEN base_where := base_where || format(' AND %s > 0 ', count_col);
    ELSIF p_jen THEN base_where := base_where || format(' AND %s >= 10 ', count_col);
    ELSIF p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    END IF;
  ELSE
    IF p_man OR p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    ELSIF p_jen THEN base_where := base_where || ' AND s.n_count >= 10 ';
    END IF;
  END IF;

  -- 정렬 로직
  sort_logic := '';
  IF p_sort_by = 'attack' THEN
    sort_logic := format(' COALESCE(%s, 0) ASC, ', count_col);
  END IF;
  sort_logic := sort_logic || ' w.word ASC ';

  IF p_limit IS NULL OR p_limit < 0 THEN
    v_limit_clause := ''; -- 음수이거나 NULL이면 LIMIT 없음 (전체 조회)
  ELSE
    v_limit_clause := ' LIMIT ' || p_limit;
  END IF;

  -- 쿼리 생성
  IF p_mission IS NOT NULL AND p_mission <> '' THEN
    query := 
      'SELECT word FROM (' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, (length(w.word) - length(replace(w.word, ' || quote_literal(p_mission) || ', ''''))) AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND w.word LIKE ' || quote_literal('%' || p_mission || '%') ||
        ' ORDER BY mission_score DESC, ' || sort_logic ||
        v_limit_clause || -- 내부 유니온 1 적용
      ' ) ' ||
      ' UNION ALL ' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, 0 AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND NOT (w.word LIKE ' || quote_literal('%' || p_mission || '%') || ')' ||
        ' ORDER BY ' || sort_logic ||
        v_limit_clause || -- 내부 유니온 2 적용
      ' ) ' ||
      ') AS combined_result ' ||
      ' ORDER BY mission_score DESC, word_length DESC, word ASC ' ||
      v_limit_clause || ';'; -- 최종 결과 적용
  ELSE
    query := 
      'SELECT w.word FROM public.words w LEFT JOIN ' || join_table ||
      base_where ||
      ' ORDER BY ' || sort_logic ||
      v_limit_clause || ';';
  END IF;

  RETURN QUERY EXECUTE query;
END;$$;


ALTER FUNCTION "public"."get_korean_words_advanced_kung"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_korean_words_advanced_s"("p_start" "text" DEFAULT NULL::"text", "p_end" "text" DEFAULT NULL::"text", "p_ingjung" boolean DEFAULT true, "p_mission" "text" DEFAULT ''::"text", "p_man" boolean DEFAULT false, "p_jen" boolean DEFAULT false, "p_eti" boolean DEFAULT false, "p_length_min" integer DEFAULT NULL::integer, "p_length_max" integer DEFAULT NULL::integer, "p_sort_by" "text" DEFAULT 'length'::"text", "p_limit" integer DEFAULT 20, "p_duem" boolean DEFAULT true) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$DECLARE
  base_where text;
  query text;
  count_col text;
  sort_logic text;
  join_table text;
  v_duem_char text;
  v_limit_clause text; -- LIMIT 구문을 담을 변수
BEGIN
  join_table := ' public.word_first_letter_counts s ON w.last_letter = s.first_letter ';
  count_col := CASE WHEN p_ingjung THEN 's.k_count' ELSE 's.n_count' END;

  base_where := ' WHERE w.k_canuse = true ';
  IF NOT p_ingjung THEN
    base_where := base_where || ' AND w.noin_canuse = true ';
  END IF;

  IF p_length_min IS NOT NULL THEN
    base_where := base_where || ' AND w.length >= ' || p_length_min;
  END IF;
  IF p_length_max IS NOT NULL THEN
    base_where := base_where || ' AND w.length <= ' || p_length_max;
  END IF;

  IF p_start IS NOT NULL AND p_start <> '' THEN
    IF length(p_start) = 1 THEN
        IF p_duem THEN
            v_duem_char := public.duem(p_start);
            IF v_duem_char <> p_start THEN
                base_where := base_where || format(' AND w.first_letter IN (%L, %L) ', p_start, v_duem_char);
            ELSE
                base_where := base_where || format(' AND w.first_letter = %L ', p_start);
            END IF;
        ELSE
            base_where := base_where || format(' AND w.first_letter = %L ', p_start);
        END IF;
    ELSE
        base_where := base_where || format(' AND w.word LIKE %L ', p_start || '%');
    END IF;
  END IF;

  IF p_end IS NOT NULL AND p_end <> '' THEN
    IF length(p_end) = 1 THEN
      base_where := base_where || format(' AND w.last_letter = %L ', p_end);
    ELSE
      base_where := base_where || format(' AND w.word LIKE %L ', '%' || p_end);
    END IF;
  END IF;

  IF p_ingjung THEN
    IF p_man THEN base_where := base_where || format(' AND %s > 0 ', count_col);
    ELSIF p_jen THEN base_where := base_where || format(' AND %s >= 10 ', count_col);
    ELSIF p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    END IF;
  ELSE
    IF p_man OR p_eti THEN base_where := base_where || ' AND s.n_count > 0 ';
    ELSIF p_jen THEN base_where := base_where || ' AND s.n_count >= 10 ';
    END IF;
  END IF;

  -- 정렬 로직
  sort_logic := '';
  IF p_sort_by = 'attack' THEN
    sort_logic := format(' COALESCE(%s, 0) ASC, ', count_col);
  ELSIF p_sort_by = 'abc' THEN
    sort_logic := ' w.word ASC, ';
  END IF;
  sort_logic := sort_logic || ' w.length DESC, w.word ASC ';

  IF p_limit IS NULL OR p_limit = -1 THEN
    v_limit_clause := ''; -- -1이거나 NULL이면 제한 없음
  ELSE
    v_limit_clause := ' LIMIT ' || p_limit;
  END IF;

  -- 쿼리 생성
  IF p_mission IS NOT NULL AND p_mission <> '' THEN
    query := 
      'SELECT word FROM (' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, (length(w.word) - length(replace(w.word, ' || quote_literal(p_mission) || ', ''''))) AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND w.word LIKE ' || quote_literal('%' || p_mission || '%') ||
        ' ORDER BY mission_score DESC, ' || sort_logic ||
        v_limit_clause || -- 내부 쿼리 제한 적용
      ' ) ' ||
      ' UNION ALL ' ||
      ' ( ' ||
        ' SELECT w.word, length(w.word) AS word_length, 0 AS mission_score ' ||
        ' FROM public.words w LEFT JOIN ' || join_table ||
        base_where ||
        ' AND NOT (w.word LIKE ' || quote_literal('%' || p_mission || '%') || ')' ||
        ' ORDER BY ' || sort_logic ||
        v_limit_clause || -- 내부 쿼리 제한 적용
      ' ) ' ||
      ') AS combined_result ' ||
      ' ORDER BY mission_score DESC, word_length DESC, word ASC ' ||
      v_limit_clause || ';'; -- 최종 결과 제한 적용
  ELSE
    query := 
      'SELECT w.word FROM public.words w LEFT JOIN ' || join_table ||
      base_where ||
      ' ORDER BY ' || sort_logic ||
      v_limit_clause || ';'; -- 일반 쿼리 제한 적용
  END IF;

  RETURN QUERY EXECUTE query;
END;$$;


ALTER FUNCTION "public"."get_korean_words_advanced_s"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_long_wait_words_data"() RETURNS TABLE("word" "text", "request_type" "public"."request_type_enum", "requested_by" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    w.word,
    w.request_type,
    w.requested_by
  FROM
    public.wait_words w
  WHERE
    CHAR_LENGTH(w.word) > 8;
$$;


ALTER FUNCTION "public"."get_long_wait_words_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mission_mark"("input_word" "text") RETURNS bigint
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
    mission_chars text := '가나다라마바사아자차카타파하';
    result bigint := 0;
    i integer;
    ch text;
begin
    for i in 1..char_length(mission_chars) loop
        ch := substr(mission_chars, i, 1);
        if position(ch in input_word) > 0 then
            result := result | (1::bigint << (i - 1));
        end if;
    end loop;

    return result;
end;
$$;


ALTER FUNCTION "public"."get_mission_mark"("input_word" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."words" (
    "id" bigint NOT NULL,
    "word" "text" NOT NULL,
    "k_canuse" boolean DEFAULT true NOT NULL,
    "noin_canuse" boolean DEFAULT false NOT NULL,
    "first_letter" character(1) GENERATED ALWAYS AS ("substr"("word", 1, 1)) STORED,
    "last_letter" character(1) GENERATED ALWAYS AS ("substr"("word", "length"("word"), 1)) STORED,
    "length" integer GENERATED ALWAYS AS ("char_length"("word")) STORED,
    "added_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "added_by" "uuid",
    "chosungs" "text" GENERATED ALWAYS AS ("public"."get_chosungs"("word")) STORED,
    "mission_mark" bigint GENERATED ALWAYS AS ("public"."get_mission_mark"("word")) STORED NOT NULL
);


ALTER TABLE "public"."words" OWNER TO "postgres";


COMMENT ON COLUMN "public"."words"."added_at" IS '단어가 추가된 시각';



COMMENT ON COLUMN "public"."words"."added_by" IS '추가한 사람';



CREATE OR REPLACE FUNCTION "public"."get_mission_len3_words"("target_mask" bigint) RETURNS SETOF "public"."words"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select *
  from public.words
  where 
    k_canuse = true             -- k_canuse가 true인 것
    and length = 3              -- 길이가 1보다 큰 것
    and (mission_mark & target_mask) != 0; -- 비트 연산 결과가 0이 아닌 것
end;
$$;


ALTER FUNCTION "public"."get_mission_len3_words"("target_mask" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_mission_words"("target_mask" bigint) RETURNS SETOF "public"."words"
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select *
  from public.words
  where 
    k_canuse = true             -- k_canuse가 true인 것
    and length > 1              -- 길이가 1보다 큰 것
    and (mission_mark & target_mask) != 0; -- 비트 연산 결과가 0이 아닌 것
end;
$$;


ALTER FUNCTION "public"."get_mission_words"("target_mask" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_monthly_rank"("uid" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  user_contrib integer;
  user_rank integer;
begin
  -- 해당 사용자의 월간 기여도를 가져옵니다
  select month_contribution into user_contrib
  from public.users
  where id = uid;

  -- 기여도가 0이면 0등 반환
  if user_contrib = 0 then
    return 0;
  end if;

  -- 자신보다 높은 월간 기여도를 가진 사람의 수를 세고 +1 해서 랭크 계산
  select count(*) + 1 into user_rank
  from public.users
  where month_contribution > user_contrib;

  return user_rank;
end;
$$;


ALTER FUNCTION "public"."get_user_monthly_rank"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") IS 'Returns authoritative operation and committed batch metadata.';



CREATE OR REPLACE FUNCTION "public"."get_words_by_theme"("theme_name" "text") RETURNS TABLE("id" bigint, "word" "text", "k_canuse" boolean, "noin_canuse" boolean, "first_letter" character, "last_letter" character, "length" integer, "added_at" timestamp with time zone, "added_by" "uuid", "chosungs" "text")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN QUERY
    SELECT w.id, w.word, w.k_canuse, w.noin_canuse,
           w.first_letter, w.last_letter, w.length,
           w.added_at, w.added_by, w.chosungs
    FROM words w
    JOIN word_themes wt ON w.id = wt.word_id
    JOIN themes t ON t.id = wt.theme_id
    WHERE t.name = theme_name;
END;
$$;


ALTER FUNCTION "public"."get_words_by_theme"("theme_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_words_with_themes"("words_input" "text"[]) RETURNS TABLE("id" bigint, "word" "text", "k_canuse" boolean, "noin_canuse" boolean, "first_letter" character, "last_letter" character, "length" integer, "added_at" timestamp with time zone, "added_by" "uuid", "chosungs" "text", "wthemes" bigint[])
    LANGUAGE "sql"
    AS $$
    select 
        w.id,
        w.word,
        w.k_canuse,
        w.noin_canuse,
        w.first_letter,
        w.last_letter,
        w.length,
        w.added_at,
        w.added_by,
        w.chosungs,
        coalesce(array_agg(t.id order by t.id) filter (where t.id is not null), '{}') as wthemes
    from public.words w
    left join public.word_themes wt on wt.word_id = w.id
    left join public.themes t on t.id = wt.theme_id
    where w.word = any(words_input)
    group by w.id;
$$;


ALTER FUNCTION "public"."get_words_with_themes"("words_input" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increase_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_letter text;
    v_is_len3 boolean := (p_word_len = 3);
    v_now timestamptz := now() AT TIME ZONE 'utc';
BEGIN
    -- 1. 시작 글자 (word_first_letter_counts) 업데이트
    FOREACH v_letter IN ARRAY revers_duem(p_first_letter)
    LOOP
        INSERT INTO public.word_first_letter_counts (
            first_letter, count, count_updated_at,
            k_count, k_count_updated_at,
            n_count, n_count_updated_at,
            len3_count, len3_count_updated_at,
            len3_k_count, len3_k_count_updated_at,
            len3_n_count, len3_n_count_updated_at
        )
        VALUES (
            v_letter, 1, v_now,
            CASE WHEN p_k_canuse THEN 1 ELSE 0 END, v_now,
            CASE WHEN p_noin_canuse THEN 1 ELSE 0 END, v_now,
            CASE WHEN v_is_len3 THEN 1 ELSE 0 END, v_now,
            CASE WHEN v_is_len3 AND p_k_canuse THEN 1 ELSE 0 END, v_now,
            CASE WHEN v_is_len3 AND p_noin_canuse THEN 1 ELSE 0 END, v_now
        )
        ON CONFLICT (first_letter) DO UPDATE SET
            count = word_first_letter_counts.count + 1,
            count_updated_at = v_now,
            k_count = word_first_letter_counts.k_count + (CASE WHEN p_k_canuse THEN 1 ELSE 0 END),
            k_count_updated_at = CASE WHEN p_k_canuse THEN v_now ELSE word_first_letter_counts.k_count_updated_at END,
            n_count = word_first_letter_counts.n_count + (CASE WHEN p_noin_canuse THEN 1 ELSE 0 END),
            n_count_updated_at = CASE WHEN p_noin_canuse THEN v_now ELSE word_first_letter_counts.n_count_updated_at END,
            len3_count = word_first_letter_counts.len3_count + (CASE WHEN v_is_len3 THEN 1 ELSE 0 END),
            len3_count_updated_at = CASE WHEN v_is_len3 THEN v_now ELSE word_first_letter_counts.len3_count_updated_at END,
            len3_k_count = word_first_letter_counts.len3_k_count + (CASE WHEN v_is_len3 AND p_k_canuse THEN 1 ELSE 0 END),
            len3_k_count_updated_at = CASE WHEN v_is_len3 AND p_k_canuse THEN v_now ELSE word_first_letter_counts.len3_k_count_updated_at END,
            len3_n_count = word_first_letter_counts.len3_n_count + (CASE WHEN v_is_len3 AND p_noin_canuse THEN 1 ELSE 0 END),
            len3_n_count_updated_at = CASE WHEN v_is_len3 AND p_noin_canuse THEN v_now ELSE word_first_letter_counts.len3_n_count_updated_at END;
    END LOOP;

    -- 2. 끝 글자 (word_last_letter_counts) 업데이트
    FOREACH v_letter IN ARRAY revers_duem(p_last_letter)
    LOOP
        INSERT INTO public.word_last_letter_counts (
            last_letter, count, count_updated_at,
            k_count, k_count_updated_at,
            n_count, n_count_updated_at
        )
        VALUES (
            v_letter, 1, v_now,
            CASE WHEN p_k_canuse THEN 1 ELSE 0 END, v_now,
            CASE WHEN p_noin_canuse THEN 1 ELSE 0 END, v_now
        )
        ON CONFLICT (last_letter) DO UPDATE SET
            count = word_last_letter_counts.count + 1,
            count_updated_at = v_now,
            k_count = word_last_letter_counts.k_count + (CASE WHEN p_k_canuse THEN 1 ELSE 0 END),
            k_count_updated_at = CASE WHEN p_k_canuse THEN v_now ELSE word_last_letter_counts.k_count_updated_at END,
            n_count = word_last_letter_counts.n_count + (CASE WHEN p_noin_canuse THEN 1 ELSE 0 END),
            n_count_updated_at = CASE WHEN p_noin_canuse THEN v_now ELSE word_last_letter_counts.n_count_updated_at END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."increase_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_contribution"("target_id" "uuid", "inc_amount" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  current_role text;
BEGIN
  UPDATE public.users
  SET contribution = contribution + inc_amount,
      month_contribution = month_contribution + inc_amount
  WHERE id = target_id;
END;$$;


ALTER FUNCTION "public"."increment_contribution"("target_id" "uuid", "inc_amount" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_doc_views"("doc_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  update public.docs
  set views = views + 1
  where id = doc_id;
end;$$;


ALTER FUNCTION "public"."increment_doc_views"("doc_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."insert_mission_words"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- 초성 리스트 배열
    initial_cons TEXT[] := ARRAY['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
    cons TEXT;
    target_maker UUID := 'b8eab990-5525-436e-906f-56590a00668b';
BEGIN
    -- 배열을 돌며 INSERT 실행
    FOREACH cons IN ARRAY initial_cons
    LOOP
        INSERT INTO public.docs (
            name, 
            maker, 
            typez, 
            is_hidden, 
            duem, 
            views
        ) 
        VALUES (
            '한국어 쿵쿵따 미션단어 - ' || cons, -- 제목 조합
            target_maker, 
            'ect', -- ※ 주의: public.document_type에 존재하는 실제 값으로 변경하세요
            true, 
            false, 
            0
        );
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."insert_mission_words"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_last_update_trigger"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO debug_log (message)
  VALUES (
    format('[DEBUG] last_update modified: table_name=%s, time=%s', NEW.table_name, NEW.last_modified)
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_last_update_trigger"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_wait_word_ff"("prefixes" "text"[]) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select w.word
  from wait_words w
  where exists (
    select 1 from unnest(prefixes) as p
    where w.word ilike p || '%'
  )
  order by random()
  limit 1;
end;
$$;


ALTER FUNCTION "public"."random_wait_word_ff"("prefixes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_wait_word_ll"("prefixes" "text"[]) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select w.word
  from wait_words w
  where exists (
    select 1 from unnest(prefixes) as p
    where w.word ilike p || '%'
  )
  order by random()
  limit 1;
end;
$$;


ALTER FUNCTION "public"."random_wait_word_ll"("prefixes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_word_ff"("fir1" "text"[]) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select w.word
  from words w
  where w.k_canuse = true
    and w.last_letter = any(fir1)
  order by random()
  limit 1;
end;
$$;


ALTER FUNCTION "public"."random_word_ff"("fir1" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."random_word_ll"("fir1" "text"[]) RETURNS TABLE("word" "text")
    LANGUAGE "plpgsql"
    AS $$
begin
  return query
  select w.word
  from words w
  where w.k_canuse = true
    and w.first_letter = any(fir1)
  order by random()
  limit 1;
end;
$$;


ALTER FUNCTION "public"."random_word_ll"("fir1" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_monthly_contribution"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 1. 저장
    INSERT INTO public.user_month_contributions (user_id, contribution, month)
    SELECT
      id,
      month_contribution,
      date_trunc('month', now() - interval '1 month') AS month
    FROM public.users
    WHERE month_contribution > 0;

    -- 2. 초기화
    UPDATE public.users
    SET month_contribution = 0;

    -- 3. 오래된 기록 삭제
    DELETE FROM public.user_month_contributions
    WHERE month < date_trunc('month', now()) - interval '5 months';
END;
$$;


ALTER FUNCTION "public"."reset_monthly_contribution"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revers_duem"("letter" "text") RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
declare
    v_cho text;
    v_jung text;
    v_jong text;
    revers_letters text[] := array[]::text[];

    duem_list1 text[] := array['ㅏ','ㅐ','ㅗ','ㅚ','ㅜ','ㅡ'];
    duem_list2 text[] := array['ㅑ','ㅕ','ㅖ','ㅛ','ㅠ','ㅣ'];
    duem_list3 text[] := array['ㅕ','ㅛ','ㅠ','ㅣ'];
begin
    if letter is null or char_length(letter) = 0 then
        return array[letter];
    end if;

    -- 한글 분해 (alias 사용)
    select d.cho, d.jung, d.jong
    into v_cho, v_jung, v_jong
    from decompose_hangul(letter) d;

    -- 기본값: 원래 글자
    revers_letters := array_append(revers_letters, letter);

    -- 한글이 아닐 경우 그대로 반환
    if v_cho is null or v_jung is null then
        return revers_letters;
    end if;

    -- 1. ㄴ + (ㅏ,ㅐ,ㅗ,ㅚ,ㅜ,ㅡ) → ㄹ
    if v_cho = 'ㄴ' and v_jung = any(duem_list1) then
        revers_letters := array_append(revers_letters, combine_hangul('ㄹ', v_jung, v_jong));
    end if;

    -- 2. ㅇ + (ㅑ,ㅕ,ㅖ,ㅛ,ㅠ,ㅣ) → ㄹ
    if v_cho = 'ㅇ' and v_jung = any(duem_list2) then
        revers_letters := array_append(revers_letters, combine_hangul('ㄹ', v_jung, v_jong));
    end if;

    -- 3. ㅇ + (ㅕ,ㅛ,ㅠ,ㅣ) → ㄴ
    if v_cho = 'ㅇ' and v_jung = any(duem_list3) then
        revers_letters := array_append(revers_letters, combine_hangul('ㄴ', v_jung, v_jong));
    end if;

    return revers_letters;
end;
$$;


ALTER FUNCTION "public"."revers_duem"("letter" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
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
$_$;


ALTER FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) IS 'Starts or resumes an actor-owned word approval operation.';



CREATE OR REPLACE FUNCTION "public"."sync_parent_last_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  -- last_update가 실제로 변경된 경우만 처리
  if new.last_update is distinct from old.last_update then

    if new.id between 209 and 222 then
      update public.docs
      set last_update = now()
      where id = 208;

    elsif new.id between 224 and 237 then
      update public.docs
      set last_update = now()
      where id = 223;

    elsif new.id between 239 and 252 then
      update public.docs
      set last_update = now()
      where id = 238;

    end if;

  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_parent_last_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_word_stats_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- INSERT
    IF TG_OP = 'INSERT' THEN
        PERFORM public.increase_word_stats(
            UPPER(LEFT(NEW.word, 1)), UPPER(RIGHT(NEW.word, 1)), 
            NEW.k_canuse, NEW.noin_canuse, LENGTH(NEW.word)
        );
        RETURN NEW;
    END IF;

    -- DELETE
    IF TG_OP = 'DELETE' THEN
        PERFORM public.decrease_word_stats(
            UPPER(LEFT(OLD.word, 1)), UPPER(RIGHT(OLD.word, 1)), 
            OLD.k_canuse, OLD.noin_canuse, LENGTH(OLD.word)
        );
        RETURN OLD;
    END IF;

    -- UPDATE
    IF TG_OP = 'UPDATE' THEN
        -- 통계에 영향을 주는 컬럼들이 변경된 경우에만 실행
        IF (OLD.word, OLD.k_canuse, OLD.noin_canuse) IS DISTINCT FROM (NEW.word, NEW.k_canuse, NEW.noin_canuse) THEN
            -- 1. 예전 값 차감
            PERFORM public.decrease_word_stats(
                UPPER(LEFT(OLD.word, 1)), UPPER(RIGHT(OLD.word, 1)), 
                OLD.k_canuse, OLD.noin_canuse, LENGTH(OLD.word)
            );
            -- 2. 새로운 값 증가
            PERFORM public.increase_word_stats(
                UPPER(LEFT(NEW.word, 1)), UPPER(RIGHT(NEW.word, 1)), 
                NEW.k_canuse, NEW.noin_canuse, LENGTH(NEW.word)
            );
        END IF;
        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."tg_word_stats_changes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_dec_first_letter_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.k_canuse THEN
    UPDATE word_first_letter_counts
    SET count = count - 1
    WHERE first_letter = OLD.first_letter;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_dec_first_letter_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_dec_last_letter_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF OLD.k_canuse THEN
    UPDATE word_last_letter_counts
    SET count = count - 1
    WHERE last_letter = OLD.last_letter;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."trg_dec_last_letter_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_inc_first_letter_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.k_canuse THEN
    INSERT INTO word_first_letter_counts (first_letter, count)
    VALUES (NEW.first_letter, 1)
    ON CONFLICT (first_letter) DO UPDATE
      SET count = word_first_letter_counts.count + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_inc_first_letter_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_inc_last_letter_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF NEW.k_canuse THEN
    INSERT INTO word_last_letter_counts (last_letter, count)
    VALUES (NEW.last_letter, 1)
    ON CONFLICT (last_letter) DO UPDATE
      SET count = word_last_letter_counts.count + 1;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_inc_last_letter_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_docs_last_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.docs
  SET last_update = now()
  WHERE id = NEW.docs_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_docs_last_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_docs_last_update_if_letter_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  target_letter char(1);
  target_word text;
  updated_count int;
begin
  if TG_OP = 'DELETE' then
    target_word := OLD.word;
  else
    target_word := NEW.word;
  end if;

  target_letter := substr(target_word, length(target_word), 1);

  update docs
  set last_update = now()
  where typez = 'letter'
    and trim(name) = target_letter;

  return null;
end;
$$;


ALTER FUNCTION "public"."update_docs_last_update_if_letter_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_modified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$BEGIN
  -- significant 변경일 경우만 업데이트
  INSERT INTO public.last_update (table_name, last_modified)
  VALUES (TG_TABLE_NAME, now() AT TIME ZONE 'utc')
  ON CONFLICT (table_name) DO UPDATE 
  SET last_modified = EXCLUDED.last_modified;

  RETURN NEW;
END;$$;


ALTER FUNCTION "public"."update_last_modified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_update"("docs_id" bigint) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  current_role text;
BEGIN

  UPDATE public.docs
  SET last_update = now() AT TIME ZONE 'utc'
  WHERE id = docs_id;
END;$$;


ALTER FUNCTION "public"."update_last_update"("docs_id" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_last_updates"("docs_ids" bigint[]) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  current_role text;
BEGIN

  UPDATE public.docs
  SET last_update = now() AT TIME ZONE 'utc'
  WHERE id = ANY(docs_ids);
END;$$;


ALTER FUNCTION "public"."update_last_updates"("docs_ids" bigint[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_role_with_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$DECLARE
  target_role role_level;
BEGIN
  -- r1~r3인 경우에만 자동 승급 적용
  IF NEW.role IN ('r1', 'r2', 'r3') THEN
    IF NEW.contribution > 3500 THEN
      target_role := 'r3';
    ELSIF NEW.contribution > 500 THEN
      target_role := 'r2';
    ELSE
      target_role := 'r1';
    END IF;

    -- 기존 등급과 달라야만 업데이트
    IF NEW.role <> target_role THEN
      UPDATE public.users
      SET role = target_role
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NULL;  -- AFTER 트리거에서는 RETURN NULL
END;$$;


ALTER FUNCTION "public"."update_user_role_with_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_word_letter_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    -- INSERT 또는 UPDATE: k_canuse=true 로 새로 추가 또는 변경
    if (TG_OP = 'INSERT' and NEW.k_canuse)
       or (TG_OP = 'UPDATE' and (not coalesce(OLD.k_canuse, false)) and NEW.k_canuse) then

        insert into public.word_first_letter_counts(first_letter, count, k_count, n_count)
        values (
            NEW.first_letter,
            0,
            1,
            case when NEW.noin_canuse then 1 else 0 end
        )
        on conflict (first_letter) do update
        set k_count = word_first_letter_counts.k_count + 1,
            n_count = word_first_letter_counts.n_count + (case when NEW.noin_canuse then 1 else 0 end);

        insert into public.word_last_letter_counts(last_letter, count, k_count, n_count)
        values (
            NEW.last_letter,
            0,
            1,
            case when NEW.noin_canuse then 1 else 0 end
        )
        on conflict (last_letter) do update
        set k_count = word_last_letter_counts.k_count + 1,
            n_count = word_last_letter_counts.n_count + (case when NEW.noin_canuse then 1 else 0 end);
    end if;

    -- DELETE 또는 UPDATE: k_canuse=true → false 로 바뀌거나 삭제될 때
    if (TG_OP = 'DELETE' and OLD.k_canuse)
       or (TG_OP = 'UPDATE' and OLD.k_canuse and not NEW.k_canuse) then

        update public.word_first_letter_counts
        set k_count = greatest(k_count - 1, 0),
            n_count = greatest(n_count - (case when OLD.noin_canuse then 1 else 0 end), 0)
        where first_letter = OLD.first_letter;

        update public.word_last_letter_counts
        set k_count = greatest(k_count - 1, 0),
            n_count = greatest(n_count - (case when OLD.noin_canuse then 1 else 0 end), 0)
        where last_letter = OLD.last_letter;
    end if;

    -- UPDATE: noin_canuse만 바뀐 경우 (k_canuse=true 유지 중)
    if TG_OP = 'UPDATE' and NEW.k_canuse and OLD.k_canuse and (OLD.noin_canuse is distinct from NEW.noin_canuse) then
        update public.word_first_letter_counts
        set n_count = greatest(
            n_count + (case when NEW.noin_canuse then 1 else -1 end), 0
        )
        where first_letter = NEW.first_letter;

        update public.word_last_letter_counts
        set n_count = greatest(
            n_count + (case when NEW.noin_canuse then 1 else -1 end), 0
        )
        where last_letter = NEW.last_letter;
    end if;

    return null;
end;
$$;


ALTER FUNCTION "public"."update_word_letter_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_words_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- 새 행이 삽입되면 카운트를 1 증가
        UPDATE words_count SET total_words = total_words + 1 WHERE id = 1;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        -- 행이 삭제되면 카운트를 1 감소
        UPDATE words_count SET total_words = total_words - 1 WHERE id = 1;
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- UPDATE는 보통 단어 내용만 변경하므로 행 수에는 영향을 미치지 않지만,
        -- 혹시 모를 'Soft Delete' 등의 경우를 대비하여 로직을 추가할 수 있습니다.
        -- 일반적인 UPDATE는 카운트에 영향을 주지 않으므로 PASS합니다.
        RETURN NEW;
    END IF;
END;
$$;


ALTER FUNCTION "public"."update_words_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."words_docs_logs_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_type request_type_enum;
BEGIN
    ----------------------------------------------------------------------
    -- INSERT: 새 단어 추가
    ----------------------------------------------------------------------
    IF (TG_OP = 'INSERT') THEN
        IF NEW.k_canuse = true AND NEW.length >= 9 THEN
            INSERT INTO public.docs_logs (docs_id, word, add_by, type)
            VALUES
                (201, NEW.word, NEW.added_by, 'add'),
                (202, NEW.word, NEW.added_by, 'add');
        END IF;
        RETURN NEW;
    END IF;

    ----------------------------------------------------------------------
    -- DELETE: 단어 삭제
    ----------------------------------------------------------------------
    IF (TG_OP = 'DELETE') THEN
        IF OLD.k_canuse = true AND OLD.length >= 9 THEN
            INSERT INTO public.docs_logs (docs_id, word, add_by, type)
            VALUES
                (201, OLD.word, OLD.added_by, 'delete'),
                (202, OLD.word, OLD.added_by, 'delete');
        END IF;
        RETURN OLD;
    END IF;

    ----------------------------------------------------------------------
    -- UPDATE: k_canuse 또는 length 관련 상태 변화 감지
    ----------------------------------------------------------------------
    IF (TG_OP = 'UPDATE') THEN
        -- 조건 변화 전/후 상태 계산
        -- 이전 상태가 유효 단어인지
        DECLARE
            old_valid boolean := (OLD.k_canuse = true AND OLD.length >= 9);
            new_valid boolean := (NEW.k_canuse = true AND NEW.length >= 9);
        BEGIN
            -- 상태 변화 없음 → 로그 없음
            IF old_valid = new_valid THEN
                RETURN NEW;
            END IF;

            -- 상태 변화가 있을 때
            IF new_valid = true THEN
                v_type := 'add';
            ELSE
                v_type := 'delete';
            END IF;

            INSERT INTO public.docs_logs (docs_id, word, add_by, type)
            VALUES
                (201, NEW.word, NEW.added_by, v_type),
                (202, NEW.word, NEW.added_by, v_type);

            RETURN NEW;
        END;
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."words_docs_logs_trg"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."docs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "maker" "uuid",
    "typez" "public"."document_type" NOT NULL,
    "last_update" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "is_hidden" boolean DEFAULT false NOT NULL,
    "duem" boolean DEFAULT false NOT NULL,
    "views" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."docs" OWNER TO "postgres";


ALTER TABLE "public"."docs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."docs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."docs_logs" (
    "docs_id" bigint NOT NULL,
    "word" "text" NOT NULL,
    "add_by" "uuid",
    "date" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "type" "public"."request_type_enum" DEFAULT 'add'::"public"."request_type_enum" NOT NULL,
    "id" bigint NOT NULL
);


ALTER TABLE "public"."docs_logs" OWNER TO "postgres";


ALTER TABLE "public"."docs_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."docs_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."docs_wait" (
    "id" bigint NOT NULL,
    "req_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "docs_name" "text" NOT NULL,
    "req_by" "uuid"
);


ALTER TABLE "public"."docs_wait" OWNER TO "postgres";


ALTER TABLE "public"."docs_wait" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."docs_wait_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."last_update" (
    "table_name" "text" NOT NULL,
    "last_modified" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL
);


ALTER TABLE "public"."last_update" OWNER TO "postgres";


COMMENT ON TABLE "public"."last_update" IS 'Save the last update time of the major table';



CREATE TABLE IF NOT EXISTS "public"."logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "word" "text" NOT NULL,
    "processed_by" "uuid",
    "make_by" "uuid",
    "state" "public"."request_status_enum" DEFAULT 'pending'::"public"."request_status_enum" NOT NULL,
    "r_type" "public"."request_type_enum" NOT NULL
);


ALTER TABLE "public"."logs" OWNER TO "postgres";


ALTER TABLE "public"."logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notification" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "img" "text",
    "end_at" timestamp with time zone NOT NULL,
    "is_modal" boolean DEFAULT false NOT NULL,
    "is_important" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notification" OWNER TO "postgres";


ALTER TABLE "public"."notification" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."notification_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."programs" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "github_repo" "text" NOT NULL,
    "category" "public"."program_category" NOT NULL,
    "tags" "text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "readme_path" "text" NOT NULL
);


ALTER TABLE "public"."programs" OWNER TO "postgres";


ALTER TABLE "public"."programs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."programs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."release_note" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" NOT NULL,
    "title" "text" NOT NULL,
    "link" "text"
);


ALTER TABLE "public"."release_note" OWNER TO "postgres";


ALTER TABLE "public"."release_note" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."release_note_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."themes" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL
);


ALTER TABLE "public"."themes" OWNER TO "postgres";


ALTER TABLE "public"."themes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."themes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_month_contributions" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contribution" integer DEFAULT 0 NOT NULL,
    "month" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."user_month_contributions" OWNER TO "postgres";


ALTER TABLE "public"."user_month_contributions" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_month_contribution_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."user_star_docs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "docs_id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."user_star_docs" OWNER TO "postgres";


ALTER TABLE "public"."user_star_docs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."user_start_docs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "nickname" "text" NOT NULL,
    "contribution" integer DEFAULT 0 NOT NULL,
    "role" "public"."role_level" DEFAULT 'r1'::"public"."role_level" NOT NULL,
    "month_contribution" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wait_word_themes" (
    "wait_word_id" bigint NOT NULL,
    "theme_id" bigint NOT NULL
);


ALTER TABLE "public"."wait_word_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."wait_words" (
    "id" bigint NOT NULL,
    "word" "text" NOT NULL,
    "word_id" bigint,
    "request_type" "public"."request_type_enum" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "status" "public"."request_status_enum" DEFAULT 'pending'::"public"."request_status_enum" NOT NULL,
    "requested_by" "uuid"
);


ALTER TABLE "public"."wait_words" OWNER TO "postgres";


ALTER TABLE "public"."wait_words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."wait_words_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."word_approval_batches" (
    "operation_id" "uuid" NOT NULL,
    "batch_index" integer NOT NULL,
    "payload_hash" "text" NOT NULL,
    "entry_count" integer NOT NULL,
    "result" "jsonb" NOT NULL,
    "committed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "word_approval_batches_batch_index_check" CHECK (("batch_index" >= 0)),
    CONSTRAINT "word_approval_batches_entry_count_check" CHECK ((("entry_count" >= 1) AND ("entry_count" <= 50))),
    CONSTRAINT "word_approval_batches_payload_hash_check" CHECK (("length"("payload_hash") = 64))
);


ALTER TABLE "public"."word_approval_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."word_approval_operations" (
    "operation_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "input_hash" "text" NOT NULL,
    "total_entries" integer NOT NULL,
    "total_batches" integer NOT NULL,
    "status" "text" DEFAULT 'running'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "word_approval_operations_input_hash_check" CHECK (("length"("input_hash") = 64)),
    CONSTRAINT "word_approval_operations_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "word_approval_operations_total_batches_check" CHECK (("total_batches" > 0)),
    CONSTRAINT "word_approval_operations_total_entries_check" CHECK (("total_entries" > 0))
);


ALTER TABLE "public"."word_approval_operations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."word_first_letter_counts" (
    "first_letter" character(1) NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "count_updated_at" timestamp with time zone DEFAULT "now"(),
    "k_count" integer DEFAULT 0 NOT NULL,
    "k_count_updated_at" timestamp with time zone DEFAULT "now"(),
    "n_count" integer DEFAULT 0 NOT NULL,
    "n_count_updated_at" timestamp with time zone DEFAULT "now"(),
    "len3_count" integer DEFAULT 0 NOT NULL,
    "len3_count_updated_at" timestamp with time zone DEFAULT "now"(),
    "len3_k_count" integer DEFAULT 0 NOT NULL,
    "len3_k_count_updated_at" timestamp with time zone DEFAULT "now"(),
    "len3_n_count" integer DEFAULT 0 NOT NULL,
    "len3_n_count_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."word_first_letter_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."word_last_letter_counts" (
    "last_letter" character(1) NOT NULL,
    "count" integer DEFAULT 0 NOT NULL,
    "count_updated_at" timestamp with time zone DEFAULT "now"(),
    "k_count" integer DEFAULT 0 NOT NULL,
    "k_count_updated_at" timestamp with time zone DEFAULT "now"(),
    "n_count" integer DEFAULT 0 NOT NULL,
    "n_count_updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."word_last_letter_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."word_themes" (
    "word_id" bigint NOT NULL,
    "theme_id" bigint NOT NULL
);


ALTER TABLE "public"."word_themes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."word_themes_wait" (
    "word_id" bigint NOT NULL,
    "theme_id" bigint NOT NULL,
    "typez" "public"."request_type_enum" NOT NULL,
    "req_at" timestamp with time zone DEFAULT ("now"() AT TIME ZONE 'utc'::"text") NOT NULL,
    "req_by" "uuid"
);


ALTER TABLE "public"."word_themes_wait" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."words_count" (
    "id" smallint DEFAULT 1 NOT NULL,
    "total_words" bigint NOT NULL,
    CONSTRAINT "single_row_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."words_count" OWNER TO "postgres";


ALTER TABLE "public"."words" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."words_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."docs_logs"
    ADD CONSTRAINT "docs_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."docs"
    ADD CONSTRAINT "docs_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."docs"
    ADD CONSTRAINT "docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."docs_wait"
    ADD CONSTRAINT "docs_wait_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."last_update"
    ADD CONSTRAINT "last_update_pkey" PRIMARY KEY ("table_name");



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_modal_no_overlap" EXCLUDE USING "gist" ("tstzrange"("created_at", "end_at", '[)'::"text") WITH &&) WHERE (("is_modal" = true));



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programs"
    ADD CONSTRAINT "programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."release_note"
    ADD CONSTRAINT "release_note_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "themes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "unique_code" UNIQUE ("code");



ALTER TABLE ONLY "public"."themes"
    ADD CONSTRAINT "unique_name" UNIQUE ("name");



ALTER TABLE ONLY "public"."words"
    ADD CONSTRAINT "unique_word" UNIQUE ("word");



ALTER TABLE ONLY "public"."user_month_contributions"
    ADD CONSTRAINT "user_month_contribution_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_month_contributions"
    ADD CONSTRAINT "user_month_month_unique" UNIQUE ("user_id", "month");



ALTER TABLE ONLY "public"."user_star_docs"
    ADD CONSTRAINT "user_star_docs_user_id_docs_id_key" UNIQUE ("user_id", "docs_id");



ALTER TABLE ONLY "public"."user_star_docs"
    ADD CONSTRAINT "user_start_docs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_nickname_key" UNIQUE ("nickname");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wait_word_themes"
    ADD CONSTRAINT "wait_word_themes_pkey" PRIMARY KEY ("wait_word_id", "theme_id");



ALTER TABLE ONLY "public"."wait_words"
    ADD CONSTRAINT "wait_words_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wait_words"
    ADD CONSTRAINT "wait_words_word_key" UNIQUE ("word");



ALTER TABLE ONLY "public"."word_approval_batches"
    ADD CONSTRAINT "word_approval_batches_pkey" PRIMARY KEY ("operation_id", "batch_index");



ALTER TABLE ONLY "public"."word_approval_operations"
    ADD CONSTRAINT "word_approval_operations_pkey" PRIMARY KEY ("operation_id");



ALTER TABLE ONLY "public"."word_first_letter_counts"
    ADD CONSTRAINT "word_first_letter_counts_pkey" PRIMARY KEY ("first_letter");



ALTER TABLE ONLY "public"."word_last_letter_counts"
    ADD CONSTRAINT "word_last_letter_counts_pkey" PRIMARY KEY ("last_letter");



ALTER TABLE ONLY "public"."word_themes"
    ADD CONSTRAINT "word_themes_pkey" PRIMARY KEY ("word_id", "theme_id");



ALTER TABLE ONLY "public"."word_themes_wait"
    ADD CONSTRAINT "word_themes_wait_word_theme_unique" UNIQUE ("word_id", "theme_id");



ALTER TABLE ONLY "public"."words_count"
    ADD CONSTRAINT "words_count_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."words"
    ADD CONSTRAINT "words_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_docs_letter_trimmed_name" ON "public"."docs" USING "btree" ("typez", TRIM(BOTH FROM "name"));



CREATE INDEX "idx_docs_logs_docs_id" ON "public"."docs_logs" USING "btree" ("docs_id");



CREATE INDEX "idx_wait_word_themes_theme_id" ON "public"."wait_word_themes" USING "btree" ("theme_id");



CREATE INDEX "idx_wait_word_themes_wait_word_id" ON "public"."wait_word_themes" USING "btree" ("wait_word_id");



CREATE INDEX "idx_wait_words_request_type" ON "public"."wait_words" USING "btree" ("request_type");



CREATE INDEX "idx_wait_words_word_id" ON "public"."wait_words" USING "btree" ("word_id");



CREATE INDEX "idx_word_themes_theme_id" ON "public"."word_themes" USING "btree" ("theme_id");



CREATE INDEX "idx_word_themes_word_id" ON "public"."word_themes" USING "btree" ("word_id");



CREATE INDEX "idx_words_chosungs" ON "public"."words" USING "btree" ("chosungs");



CREATE INDEX "idx_words_first_letter" ON "public"."words" USING "btree" ("first_letter");



CREATE INDEX "idx_words_k_canuse" ON "public"."words" USING "btree" ("k_canuse");



CREATE INDEX "idx_words_last_letter" ON "public"."words" USING "btree" ("last_letter");



CREATE INDEX "idx_words_length" ON "public"."words" USING "btree" ("length");



CREATE INDEX "idx_words_noin_canuse" ON "public"."words" USING "btree" ("noin_canuse");



CREATE INDEX "idx_words_word_trgm" ON "public"."words" USING "gin" ("word" "public"."gin_trgm_ops");



CREATE INDEX "mission_mark_index" ON "public"."words" USING "btree" ("mission_mark");



CREATE UNIQUE INDEX "word_approval_operations_running_input_key" ON "public"."word_approval_operations" USING "btree" ("actor_id", "input_hash") WHERE ("status" = 'running'::"text");



CREATE OR REPLACE TRIGGER "trg_after_word_change" AFTER INSERT OR DELETE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."fn_process_word_docs_update"();



CREATE OR REPLACE TRIGGER "trg_sync_parent_last_update" AFTER UPDATE OF "last_update" ON "public"."docs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_parent_last_update"();



CREATE OR REPLACE TRIGGER "trg_update_docs_from_wait_words" AFTER INSERT OR DELETE ON "public"."wait_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_docs_last_update_if_letter_match"();



CREATE OR REPLACE TRIGGER "trg_update_docs_from_words" AFTER INSERT OR DELETE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."update_docs_last_update_if_letter_match"();



CREATE OR REPLACE TRIGGER "trg_words_docs_logs" AFTER INSERT OR DELETE OR UPDATE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."words_docs_logs_trg"();



CREATE OR REPLACE TRIGGER "trigger_themes_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."themes" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_update_user_role_with_update" AFTER INSERT OR UPDATE OF "contribution" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_role_with_update"();



CREATE OR REPLACE TRIGGER "trigger_wait_word_themes_themes_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."docs_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_wait_word_themes_themes_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."wait_word_themes" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_wait_words_themes_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."wait_words" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_word_themes_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."word_themes" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "trigger_words_last_modified" AFTER INSERT OR DELETE OR UPDATE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."update_last_modified"();



CREATE OR REPLACE TRIGGER "update_word_stats_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."tg_word_stats_changes"();



CREATE OR REPLACE TRIGGER "words_after_insert" AFTER INSERT OR DELETE ON "public"."words" FOR EACH ROW EXECUTE FUNCTION "public"."update_words_count"();



ALTER TABLE ONLY "public"."docs_logs"
    ADD CONSTRAINT "docs_logs_add_by_fkey" FOREIGN KEY ("add_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."docs_logs"
    ADD CONSTRAINT "docs_logs_docs_id_fkey" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."docs"
    ADD CONSTRAINT "docs_maker_fkey" FOREIGN KEY ("maker") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."docs_wait"
    ADD CONSTRAINT "docs_wait_req_by_fkey" FOREIGN KEY ("req_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_make_by_fkey" FOREIGN KEY ("make_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."logs"
    ADD CONSTRAINT "logs_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_month_contributions"
    ADD CONSTRAINT "user_month_contribution_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_star_docs"
    ADD CONSTRAINT "user_start_docs_docs_id_fkey" FOREIGN KEY ("docs_id") REFERENCES "public"."docs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_star_docs"
    ADD CONSTRAINT "user_start_docs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wait_word_themes"
    ADD CONSTRAINT "wait_word_themes_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wait_word_themes"
    ADD CONSTRAINT "wait_word_themes_wait_word_id_fkey" FOREIGN KEY ("wait_word_id") REFERENCES "public"."wait_words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wait_words"
    ADD CONSTRAINT "wait_words_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."wait_words"
    ADD CONSTRAINT "wait_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_approval_batches"
    ADD CONSTRAINT "word_approval_batches_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "public"."word_approval_operations"("operation_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_approval_operations"
    ADD CONSTRAINT "word_approval_operations_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."word_themes"
    ADD CONSTRAINT "word_themes_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_themes_wait"
    ADD CONSTRAINT "word_themes_wait_req_by_fkey" FOREIGN KEY ("req_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."word_themes_wait"
    ADD CONSTRAINT "word_themes_wait_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_themes_wait"
    ADD CONSTRAINT "word_themes_wait_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."word_themes"
    ADD CONSTRAINT "word_themes_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "public"."words"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."words"
    ADD CONSTRAINT "words_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



CREATE POLICY "Enable delete for admin only" ON "public"."docs_wait" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "Enable insert for admin only" ON "public"."docs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."docs_wait" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."word_themes_wait" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."notification" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."programs" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."word_first_letter_counts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."word_last_letter_counts" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."words_count" FOR SELECT USING (true);



CREATE POLICY "allow_delete_for_own_pending_requests_or_admin_r4" ON "public"."wait_words" FOR DELETE USING (((("requested_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("status" = 'pending'::"public"."request_status_enum")) OR (( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"]))));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."docs_logs" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."last_update" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."logs" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."themes" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."word_themes" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_delete_for_r4_admin" ON "public"."words" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_authenticated_users" ON "public"."wait_word_themes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_for_authenticated_users" ON "public"."wait_words" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."docs_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."last_update" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))
 LIMIT 1) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."themes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."word_themes" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_insert_for_r4_admin" ON "public"."words" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "allow_read_all" ON "public"."docs" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."docs_logs" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."docs_wait" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."last_update" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."logs" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."release_note" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."themes" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."user_month_contributions" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."user_star_docs" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."wait_word_themes" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."wait_words" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."word_themes" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."word_themes_wait" FOR SELECT USING (true);



CREATE POLICY "allow_read_all" ON "public"."words" FOR SELECT USING (true);



CREATE POLICY "delete_only_admin_or_r4" ON "public"."notification" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "delete_only_admin_or_r4" ON "public"."word_themes_wait" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "delete_own_user_start_docs" ON "public"."user_star_docs" FOR DELETE USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."docs_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."docs_wait" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_only_admin_or_r4" ON "public"."notification" FOR INSERT WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "insert_own_user_start_docs" ON "public"."user_star_docs" FOR INSERT WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."last_update" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "r4_and_admin_only" ON "public"."programs" FOR INSERT WITH CHECK ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "r4_and_admine_only" ON "public"."programs" FOR UPDATE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



CREATE POLICY "r_and_admin_only" ON "public"."programs" FOR DELETE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



ALTER TABLE "public"."release_note" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update_only_admin_or_r4" ON "public"."notification" FOR UPDATE USING ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = ( SELECT "auth"."uid"() AS "uid"))) = ANY (ARRAY['r4'::"public"."role_level", 'admin'::"public"."role_level"])));



ALTER TABLE "public"."user_month_contributions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_star_docs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wait_word_themes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wait_words" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_approval_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_approval_operations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_first_letter_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_last_letter_counts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_themes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."word_themes_wait" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."words" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."words_count" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";






































































































































































































REVOKE ALL ON FUNCTION "private"."assert_word_approval_admin"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."apply_word_approval_batch"("p_operation_id" "uuid", "p_batch_index" integer, "p_total_batches" integer, "p_payload_hash" "text", "p_entries" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."cancel_word_approval_operation"("p_operation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."combine_hangul"("cho" "text", "jung" "text", "jong" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."combine_hangul"("cho" "text", "jung" "text", "jong" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."combine_hangul"("cho" "text", "jung" "text", "jong" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."decompose_hangul"("hangul" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."decompose_hangul"("hangul" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decompose_hangul"("hangul" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrease_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."decrease_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrease_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_word_themes_bulk"("pairs" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_word_themes_bulk"("pairs" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_word_themes_bulk"("pairs" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_word_themes_wait_bulk"("pairs" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_word_themes_wait_bulk"("pairs" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_word_themes_wait_bulk"("pairs" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."duem"("letter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."duem"("letter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."duem"("letter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_process_word_docs_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_process_word_docs_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_process_word_docs_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_chosungs"("hangul" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_chosungs"("hangul" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_chosungs"("hangul" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_delete_requests_by_themeid"("input_theme_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_delete_requests_by_themeid"("input_theme_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_delete_requests_by_themeid"("input_theme_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_doc_rank"("doc_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_doc_rank"("doc_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_doc_rank"("doc_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_e"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_e"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_e"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_hunmin"("p_chosungs" "text", "p_limit" integer, "p_mission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_hunmin"("p_chosungs" "text", "p_limit" integer, "p_mission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_hunmin"("p_chosungs" "text", "p_limit" integer, "p_mission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_jaqi"("p_chosungs" "text", "p_theme_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_jaqi"("p_chosungs" "text", "p_theme_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_jaqi"("p_chosungs" "text", "p_theme_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_kung"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_kung"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_kung"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_s"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_s"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_korean_words_advanced_s"("p_start" "text", "p_end" "text", "p_ingjung" boolean, "p_mission" "text", "p_man" boolean, "p_jen" boolean, "p_eti" boolean, "p_length_min" integer, "p_length_max" integer, "p_sort_by" "text", "p_limit" integer, "p_duem" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_long_wait_words_data"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_long_wait_words_data"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_long_wait_words_data"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mission_mark"("input_word" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_mission_mark"("input_word" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mission_mark"("input_word" "text") TO "service_role";



GRANT ALL ON TABLE "public"."words" TO "anon";
GRANT ALL ON TABLE "public"."words" TO "authenticated";
GRANT ALL ON TABLE "public"."words" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mission_len3_words"("target_mask" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_mission_len3_words"("target_mask" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mission_len3_words"("target_mask" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_mission_words"("target_mask" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_mission_words"("target_mask" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_mission_words"("target_mask" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_monthly_rank"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_monthly_rank"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_monthly_rank"("uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_word_approval_operation"("p_operation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_words_by_theme"("theme_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_words_by_theme"("theme_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_words_by_theme"("theme_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_words_with_themes"("words_input" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_words_with_themes"("words_input" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_words_with_themes"("words_input" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."increase_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increase_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increase_word_stats"("p_first_letter" character, "p_last_letter" character, "p_k_canuse" boolean, "p_noin_canuse" boolean, "p_word_len" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_contribution"("target_id" "uuid", "inc_amount" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_contribution"("target_id" "uuid", "inc_amount" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_contribution"("target_id" "uuid", "inc_amount" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_doc_views"("doc_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."increment_doc_views"("doc_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_doc_views"("doc_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."insert_mission_words"() TO "anon";
GRANT ALL ON FUNCTION "public"."insert_mission_words"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."insert_mission_words"() TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON FUNCTION "public"."log_last_update_trigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_last_update_trigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_last_update_trigger"() TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."random_wait_word_ff"("prefixes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."random_wait_word_ff"("prefixes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_wait_word_ff"("prefixes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."random_wait_word_ll"("prefixes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."random_wait_word_ll"("prefixes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_wait_word_ll"("prefixes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."random_word_ff"("fir1" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."random_word_ff"("fir1" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_word_ff"("fir1" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."random_word_ll"("fir1" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."random_word_ll"("fir1" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."random_word_ll"("fir1" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_monthly_contribution"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_monthly_contribution"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_monthly_contribution"() TO "service_role";



GRANT ALL ON FUNCTION "public"."revers_duem"("letter" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."revers_duem"("letter" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revers_duem"("letter" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."start_word_approval_operation"("p_operation_id" "uuid", "p_input_hash" "text", "p_total_entries" integer, "p_total_batches" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_parent_last_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_parent_last_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_parent_last_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_word_stats_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_word_stats_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_word_stats_changes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_dec_first_letter_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_dec_first_letter_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_dec_first_letter_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_dec_last_letter_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_dec_last_letter_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_dec_last_letter_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_inc_first_letter_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_inc_first_letter_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_inc_first_letter_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_inc_last_letter_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_inc_last_letter_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_inc_last_letter_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_docs_last_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_docs_last_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_docs_last_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_docs_last_update_if_letter_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_docs_last_update_if_letter_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_docs_last_update_if_letter_match"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_modified"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_modified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_modified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_update"("docs_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_update"("docs_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_update"("docs_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_last_updates"("docs_ids" bigint[]) TO "anon";
GRANT ALL ON FUNCTION "public"."update_last_updates"("docs_ids" bigint[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_last_updates"("docs_ids" bigint[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_role_with_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_role_with_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_role_with_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_word_letter_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_word_letter_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_word_letter_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_words_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_words_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_words_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."words_docs_logs_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."words_docs_logs_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."words_docs_logs_trg"() TO "service_role";
























GRANT ALL ON TABLE "public"."docs" TO "anon";
GRANT ALL ON TABLE "public"."docs" TO "authenticated";
GRANT ALL ON TABLE "public"."docs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."docs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."docs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."docs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."docs_logs" TO "anon";
GRANT ALL ON TABLE "public"."docs_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."docs_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."docs_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."docs_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."docs_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."docs_wait" TO "anon";
GRANT ALL ON TABLE "public"."docs_wait" TO "authenticated";
GRANT ALL ON TABLE "public"."docs_wait" TO "service_role";



GRANT ALL ON SEQUENCE "public"."docs_wait_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."docs_wait_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."docs_wait_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."last_update" TO "anon";
GRANT ALL ON TABLE "public"."last_update" TO "authenticated";
GRANT ALL ON TABLE "public"."last_update" TO "service_role";



GRANT ALL ON TABLE "public"."logs" TO "anon";
GRANT ALL ON TABLE "public"."logs" TO "authenticated";
GRANT ALL ON TABLE "public"."logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notification" TO "anon";
GRANT ALL ON TABLE "public"."notification" TO "authenticated";
GRANT ALL ON TABLE "public"."notification" TO "service_role";



GRANT ALL ON SEQUENCE "public"."notification_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."notification_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."notification_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."programs" TO "anon";
GRANT ALL ON TABLE "public"."programs" TO "authenticated";
GRANT ALL ON TABLE "public"."programs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."programs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."release_note" TO "anon";
GRANT ALL ON TABLE "public"."release_note" TO "authenticated";
GRANT ALL ON TABLE "public"."release_note" TO "service_role";



GRANT ALL ON SEQUENCE "public"."release_note_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."release_note_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."release_note_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."themes" TO "anon";
GRANT ALL ON TABLE "public"."themes" TO "authenticated";
GRANT ALL ON TABLE "public"."themes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."themes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."themes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."themes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_month_contributions" TO "anon";
GRANT ALL ON TABLE "public"."user_month_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_month_contributions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_month_contribution_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_month_contribution_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_month_contribution_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_star_docs" TO "anon";
GRANT ALL ON TABLE "public"."user_star_docs" TO "authenticated";
GRANT ALL ON TABLE "public"."user_star_docs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."user_start_docs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."user_start_docs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."user_start_docs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."wait_word_themes" TO "anon";
GRANT ALL ON TABLE "public"."wait_word_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."wait_word_themes" TO "service_role";



GRANT ALL ON TABLE "public"."wait_words" TO "anon";
GRANT ALL ON TABLE "public"."wait_words" TO "authenticated";
GRANT ALL ON TABLE "public"."wait_words" TO "service_role";



GRANT ALL ON SEQUENCE "public"."wait_words_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."wait_words_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."wait_words_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."word_approval_batches" TO "service_role";



GRANT ALL ON TABLE "public"."word_approval_operations" TO "service_role";



GRANT ALL ON TABLE "public"."word_first_letter_counts" TO "anon";
GRANT ALL ON TABLE "public"."word_first_letter_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."word_first_letter_counts" TO "service_role";



GRANT ALL ON TABLE "public"."word_last_letter_counts" TO "anon";
GRANT ALL ON TABLE "public"."word_last_letter_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."word_last_letter_counts" TO "service_role";



GRANT ALL ON TABLE "public"."word_themes" TO "anon";
GRANT ALL ON TABLE "public"."word_themes" TO "authenticated";
GRANT ALL ON TABLE "public"."word_themes" TO "service_role";



GRANT ALL ON TABLE "public"."word_themes_wait" TO "anon";
GRANT ALL ON TABLE "public"."word_themes_wait" TO "authenticated";
GRANT ALL ON TABLE "public"."word_themes_wait" TO "service_role";



GRANT ALL ON TABLE "public"."words_count" TO "anon";
GRANT ALL ON TABLE "public"."words_count" TO "authenticated";
GRANT ALL ON TABLE "public"."words_count" TO "service_role";



GRANT ALL ON SEQUENCE "public"."words_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."words_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."words_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























drop extension if exists "pg_net";

revoke references on table "public"."word_approval_batches" from "anon";

revoke trigger on table "public"."word_approval_batches" from "anon";

revoke truncate on table "public"."word_approval_batches" from "anon";

revoke references on table "public"."word_approval_batches" from "authenticated";

revoke trigger on table "public"."word_approval_batches" from "authenticated";

revoke truncate on table "public"."word_approval_batches" from "authenticated";

revoke references on table "public"."word_approval_operations" from "anon";

revoke trigger on table "public"."word_approval_operations" from "anon";

revoke truncate on table "public"."word_approval_operations" from "anon";

revoke references on table "public"."word_approval_operations" from "authenticated";

revoke trigger on table "public"."word_approval_operations" from "authenticated";

revoke truncate on table "public"."word_approval_operations" from "authenticated";


  create policy "all_read_ok vi2prh_0"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'public_img'::text));



  create policy "allow_admin_or_r4 vi2prh_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'public_img'::text) AND (( SELECT users.role
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['r4'::public.role_level, 'admin'::public.role_level]))));



  create policy "allow_admin_or_r4 vi2prh_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'public_img'::text) AND (( SELECT users.role
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['r4'::public.role_level, 'admin'::public.role_level]))));



  create policy "allow_admin_or_r4 vi2prh_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'public_img'::text) AND (( SELECT users.role
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['r4'::public.role_level, 'admin'::public.role_level]))));



  create policy "allow_admin_or_r4 vi2prh_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'public_img'::text) AND (( SELECT users.role
   FROM public.users
  WHERE (users.id = ( SELECT auth.uid() AS uid))) = ANY (ARRAY['r4'::public.role_level, 'admin'::public.role_level]))));



