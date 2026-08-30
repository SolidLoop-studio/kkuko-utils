begin;

create or replace function public.update_docs_last_update_if_letter_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
    target_letter char(1);
    target_word text;
begin
    if tg_op = 'DELETE' then
        target_word := old.word;
    else
        target_word := new.word;
    end if;

    target_letter := pg_catalog.substr(
        target_word, pg_catalog.length(target_word), 1
    );

    update public.docs
    set last_update = pg_catalog.now()
    where typez = 'letter'
      and pg_catalog.btrim(name) = target_letter;

    return null;
end;
$function$;

create or replace function public.request_word_deletion(p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    normalized_word text := pg_catalog.btrim(p_word);
    word_row public.words%rowtype;
    request_row public.wait_words%rowtype;
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_UNAUTHORIZED';
    end if;
    if normalized_word is null or normalized_word = '' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_INPUT';
    end if;

    select * into word_row
    from public.words as registered_word
    where registered_word.word = normalized_word
    for update;
    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_NOT_FOUND';
    end if;

    insert into public.wait_words (
        word, word_id, requested_by, request_type
    ) values (
        word_row.word, word_row.id, actor, 'delete'
    )
    returning * into request_row;

    return pg_catalog.jsonb_build_object(
        'requestId', request_row.id,
        'word', request_row.word,
        'requestType', request_row.request_type
    );
exception
    when unique_violation then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_CONFLICT';
end;
$function$;

create or replace function public.cancel_word_request(p_word text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
    actor uuid := auth.uid();
    normalized_word text := pg_catalog.btrim(p_word);
    request_row public.wait_words%rowtype;
begin
    if actor is null then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_UNAUTHORIZED';
    end if;
    if normalized_word is null or normalized_word = '' then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_INVALID_INPUT';
    end if;

    select * into request_row
    from public.wait_words as pending_request
    where pending_request.word = normalized_word
      and pending_request.requested_by = actor
      and pending_request.status = 'pending'
    for update;
    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'WORD_REQUEST_NOT_FOUND';
    end if;

    delete from public.wait_words as pending_request
    where pending_request.id = request_row.id
    returning * into request_row;

    return pg_catalog.jsonb_build_object(
        'requestId', request_row.id,
        'word', request_row.word,
        'requestType', request_row.request_type
    );
end;
$function$;

revoke all on function public.request_word_deletion(text) from public, anon;
revoke all on function public.cancel_word_request(text) from public, anon;
grant execute on function public.request_word_deletion(text) to authenticated;
grant execute on function public.cancel_word_request(text) to authenticated;

commit;
