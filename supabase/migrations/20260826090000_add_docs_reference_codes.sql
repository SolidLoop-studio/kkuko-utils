begin;

alter table public.docs
    add column reference_code text;

create temporary table docs_reference_catalog (
    legacy_id bigint primary key,
    expected_name text not null unique,
    reference_code text not null unique
) on commit drop;

insert into pg_temp.docs_reference_catalog values
    (201, '한국어 끝말잇기 긴단어', 'ko.word-chain.long'),
    (202, '한국어 앞말잇기 긴단어', 'ko.reverse-word-chain.long'),
    (208, '한국어 끝말잇기 미션단어', 'ko.word-chain.mission'),
    (223, '한국어 앞말잇기 미션단어', 'ko.reverse-word-chain.mission'),
    (238, '한국어 쿵쿵따 미션단어', 'ko.kkungkkungtta.mission');

with letters(ordinal, letter, reference_key) as (values
    (1, '가', 'ga'), (2, '나', 'na'), (3, '다', 'da'),
    (4, '라', 'ra'), (5, '마', 'ma'), (6, '바', 'ba'),
    (7, '사', 'sa'), (8, '아', 'a'), (9, '자', 'ja'),
    (10, '차', 'cha'), (11, '카', 'ka'), (12, '타', 'ta'),
    (13, '파', 'pa'), (14, '하', 'ha')
), families(first_id, name_prefix, code_prefix) as (values
    (209, '한국어 끝말잇기 미션단어', 'ko.word-chain.mission'),
    (224, '한국어 앞말잇기 미션단어', 'ko.reverse-word-chain.mission'),
    (239, '한국어 쿵쿵따 미션단어', 'ko.kkungkkungtta.mission')
)
insert into pg_temp.docs_reference_catalog
select
    family.first_id + letter.ordinal - 1,
    family.name_prefix || ' - ' || letter.letter,
    family.code_prefix || '.' || letter.reference_key
from letters as letter cross join families as family;

do $backfill$
declare
    exact_match_count integer;
    assigned_count integer;
begin
    if exists (select 1 from public.docs) then
        select count(*)::integer
          into exact_match_count
          from public.docs as document
          join pg_temp.docs_reference_catalog as catalog
            on catalog.legacy_id = document.id
           and catalog.expected_name = document.name;

        if exact_match_count <> 47 then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REFERENCE_BACKFILL_MISMATCH';
        end if;

        update public.docs as document
           set reference_code = catalog.reference_code
          from pg_temp.docs_reference_catalog as catalog
         where document.id = catalog.legacy_id
           and document.name = catalog.expected_name;

        select count(*)::integer
          into assigned_count
          from public.docs
         where reference_code is not null;

        if assigned_count <> 47 then
            raise exception using
                errcode = 'P0001',
                message = 'DOCS_REFERENCE_BACKFILL_MISMATCH';
        end if;
    end if;
end;
$backfill$;

alter table public.docs
    add constraint docs_reference_code_format_check
    check (
        reference_code is null
        or reference_code ~ '^[a-z][a-z0-9]*([.-][a-z0-9]+)*$'
    );

alter table public.docs
    add constraint docs_reference_code_key unique (reference_code);

create function private.enforce_docs_reference_code_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
    if old.reference_code is not null
       and new.reference_code is distinct from old.reference_code then
        raise exception using
            errcode = 'P0001',
            message = 'DOCS_REFERENCE_CODE_IMMUTABLE';
    end if;

    return new;
end;
$function$;

create trigger trg_docs_reference_code_immutable
before update of reference_code on public.docs
for each row
execute function private.enforce_docs_reference_code_immutable();

revoke all on function private.enforce_docs_reference_code_immutable()
from public, anon, authenticated, service_role;

commit;
