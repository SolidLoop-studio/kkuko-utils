alter table public.word_first_letter_counts
    add column exact_k_count integer not null default 0,
    add column exact_k_count_updated_at timestamptz,
    add column exact_n_count integer not null default 0,
    add column exact_n_count_updated_at timestamptz,
    add column exact_len3_k_count integer not null default 0,
    add column exact_len3_k_count_updated_at timestamptz,
    add column exact_len3_n_count integer not null default 0,
    add column exact_len3_n_count_updated_at timestamptz;

alter table public.word_last_letter_counts
    add column exact_k_count integer not null default 0,
    add column exact_k_count_updated_at timestamptz,
    add column exact_n_count integer not null default 0,
    add column exact_n_count_updated_at timestamptz;

with migration_time as (
    select now() as value
), exact_first as (
    select
        upper(left(word, 1))::character(1) as letter,
        count(*) filter (where k_canuse)::integer as k_count,
        count(*) filter (where noin_canuse)::integer as n_count,
        count(*) filter (where char_length(word) = 3 and k_canuse)::integer as len3_k_count,
        count(*) filter (where char_length(word) = 3 and noin_canuse)::integer as len3_n_count
    from public.words
    group by upper(left(word, 1))
)
update public.word_first_letter_counts as target
set
    exact_k_count = source.k_count,
    exact_k_count_updated_at = case when source.k_count > 0 then migration_time.value end,
    exact_n_count = source.n_count,
    exact_n_count_updated_at = case when source.n_count > 0 then migration_time.value end,
    exact_len3_k_count = source.len3_k_count,
    exact_len3_k_count_updated_at = case when source.len3_k_count > 0 then migration_time.value end,
    exact_len3_n_count = source.len3_n_count,
    exact_len3_n_count_updated_at = case when source.len3_n_count > 0 then migration_time.value end
from exact_first as source
cross join migration_time
where target.first_letter = source.letter;

with migration_time as (
    select now() as value
), exact_last as (
    select
        upper(right(word, 1))::character(1) as letter,
        count(*) filter (where k_canuse)::integer as k_count,
        count(*) filter (where noin_canuse)::integer as n_count
    from public.words
    group by upper(right(word, 1))
)
update public.word_last_letter_counts as target
set
    exact_k_count = source.k_count,
    exact_k_count_updated_at = case when source.k_count > 0 then migration_time.value end,
    exact_n_count = source.n_count,
    exact_n_count_updated_at = case when source.n_count > 0 then migration_time.value end
from exact_last as source
cross join migration_time
where target.last_letter = source.letter;

create or replace function public.increase_word_stats(
    p_first_letter character,
    p_last_letter character,
    p_k_canuse boolean,
    p_noin_canuse boolean,
    p_word_len integer
) returns void
language plpgsql
security definer
as $$
declare
    v_letter text;
    v_is_len3 boolean := (p_word_len = 3);
    v_now timestamptz := now() at time zone 'utc';
begin
    foreach v_letter in array public.revers_duem(p_first_letter)
    loop
        insert into public.word_first_letter_counts (
            first_letter, count, count_updated_at,
            k_count, k_count_updated_at,
            n_count, n_count_updated_at,
            len3_count, len3_count_updated_at,
            len3_k_count, len3_k_count_updated_at,
            len3_n_count, len3_n_count_updated_at
        )
        values (
            v_letter, 1, v_now,
            case when p_k_canuse then 1 else 0 end, v_now,
            case when p_noin_canuse then 1 else 0 end, v_now,
            case when v_is_len3 then 1 else 0 end, v_now,
            case when v_is_len3 and p_k_canuse then 1 else 0 end, v_now,
            case when v_is_len3 and p_noin_canuse then 1 else 0 end, v_now
        )
        on conflict (first_letter) do update set
            count = word_first_letter_counts.count + 1,
            count_updated_at = v_now,
            k_count = word_first_letter_counts.k_count + case when p_k_canuse then 1 else 0 end,
            k_count_updated_at = case when p_k_canuse then v_now else word_first_letter_counts.k_count_updated_at end,
            n_count = word_first_letter_counts.n_count + case when p_noin_canuse then 1 else 0 end,
            n_count_updated_at = case when p_noin_canuse then v_now else word_first_letter_counts.n_count_updated_at end,
            len3_count = word_first_letter_counts.len3_count + case when v_is_len3 then 1 else 0 end,
            len3_count_updated_at = case when v_is_len3 then v_now else word_first_letter_counts.len3_count_updated_at end,
            len3_k_count = word_first_letter_counts.len3_k_count + case when v_is_len3 and p_k_canuse then 1 else 0 end,
            len3_k_count_updated_at = case when v_is_len3 and p_k_canuse then v_now else word_first_letter_counts.len3_k_count_updated_at end,
            len3_n_count = word_first_letter_counts.len3_n_count + case when v_is_len3 and p_noin_canuse then 1 else 0 end,
            len3_n_count_updated_at = case when v_is_len3 and p_noin_canuse then v_now else word_first_letter_counts.len3_n_count_updated_at end;
    end loop;

    update public.word_first_letter_counts
    set
        exact_k_count = exact_k_count + case when p_k_canuse then 1 else 0 end,
        exact_k_count_updated_at = case when p_k_canuse then v_now else exact_k_count_updated_at end,
        exact_n_count = exact_n_count + case when p_noin_canuse then 1 else 0 end,
        exact_n_count_updated_at = case when p_noin_canuse then v_now else exact_n_count_updated_at end,
        exact_len3_k_count = exact_len3_k_count + case when v_is_len3 and p_k_canuse then 1 else 0 end,
        exact_len3_k_count_updated_at = case when v_is_len3 and p_k_canuse then v_now else exact_len3_k_count_updated_at end,
        exact_len3_n_count = exact_len3_n_count + case when v_is_len3 and p_noin_canuse then 1 else 0 end,
        exact_len3_n_count_updated_at = case when v_is_len3 and p_noin_canuse then v_now else exact_len3_n_count_updated_at end
    where first_letter = p_first_letter;

    foreach v_letter in array public.revers_duem(p_last_letter)
    loop
        insert into public.word_last_letter_counts (
            last_letter, count, count_updated_at,
            k_count, k_count_updated_at,
            n_count, n_count_updated_at
        )
        values (
            v_letter, 1, v_now,
            case when p_k_canuse then 1 else 0 end, v_now,
            case when p_noin_canuse then 1 else 0 end, v_now
        )
        on conflict (last_letter) do update set
            count = word_last_letter_counts.count + 1,
            count_updated_at = v_now,
            k_count = word_last_letter_counts.k_count + case when p_k_canuse then 1 else 0 end,
            k_count_updated_at = case when p_k_canuse then v_now else word_last_letter_counts.k_count_updated_at end,
            n_count = word_last_letter_counts.n_count + case when p_noin_canuse then 1 else 0 end,
            n_count_updated_at = case when p_noin_canuse then v_now else word_last_letter_counts.n_count_updated_at end;
    end loop;

    update public.word_last_letter_counts
    set
        exact_k_count = exact_k_count + case when p_k_canuse then 1 else 0 end,
        exact_k_count_updated_at = case when p_k_canuse then v_now else exact_k_count_updated_at end,
        exact_n_count = exact_n_count + case when p_noin_canuse then 1 else 0 end,
        exact_n_count_updated_at = case when p_noin_canuse then v_now else exact_n_count_updated_at end
    where last_letter = p_last_letter;
end;
$$;

create or replace function public.decrease_word_stats(
    p_first_letter character,
    p_last_letter character,
    p_k_canuse boolean,
    p_noin_canuse boolean,
    p_word_len integer
) returns void
language plpgsql
security definer
as $$
declare
    v_letter text;
    v_is_len3 boolean := (p_word_len = 3);
    v_now timestamptz := now() at time zone 'utc';
begin
    foreach v_letter in array public.revers_duem(p_first_letter)
    loop
        update public.word_first_letter_counts
        set
            count = greatest(0, count - 1),
            count_updated_at = v_now,
            k_count = greatest(0, k_count - case when p_k_canuse then 1 else 0 end),
            k_count_updated_at = case when p_k_canuse then v_now else k_count_updated_at end,
            n_count = greatest(0, n_count - case when p_noin_canuse then 1 else 0 end),
            n_count_updated_at = case when p_noin_canuse then v_now else n_count_updated_at end,
            len3_count = greatest(0, len3_count - case when v_is_len3 then 1 else 0 end),
            len3_count_updated_at = case when v_is_len3 then v_now else len3_count_updated_at end,
            len3_k_count = greatest(0, len3_k_count - case when v_is_len3 and p_k_canuse then 1 else 0 end),
            len3_k_count_updated_at = case when v_is_len3 and p_k_canuse then v_now else len3_k_count_updated_at end,
            len3_n_count = greatest(0, len3_n_count - case when v_is_len3 and p_noin_canuse then 1 else 0 end),
            len3_n_count_updated_at = case when v_is_len3 and p_noin_canuse then v_now else len3_n_count_updated_at end
        where first_letter = v_letter;
    end loop;

    update public.word_first_letter_counts
    set
        exact_k_count = greatest(0, exact_k_count - case when p_k_canuse then 1 else 0 end),
        exact_k_count_updated_at = case when p_k_canuse then v_now else exact_k_count_updated_at end,
        exact_n_count = greatest(0, exact_n_count - case when p_noin_canuse then 1 else 0 end),
        exact_n_count_updated_at = case when p_noin_canuse then v_now else exact_n_count_updated_at end,
        exact_len3_k_count = greatest(0, exact_len3_k_count - case when v_is_len3 and p_k_canuse then 1 else 0 end),
        exact_len3_k_count_updated_at = case when v_is_len3 and p_k_canuse then v_now else exact_len3_k_count_updated_at end,
        exact_len3_n_count = greatest(0, exact_len3_n_count - case when v_is_len3 and p_noin_canuse then 1 else 0 end),
        exact_len3_n_count_updated_at = case when v_is_len3 and p_noin_canuse then v_now else exact_len3_n_count_updated_at end
    where first_letter = p_first_letter;

    foreach v_letter in array public.revers_duem(p_last_letter)
    loop
        update public.word_last_letter_counts
        set
            count = greatest(0, count - 1),
            count_updated_at = v_now,
            k_count = greatest(0, k_count - case when p_k_canuse then 1 else 0 end),
            k_count_updated_at = case when p_k_canuse then v_now else k_count_updated_at end,
            n_count = greatest(0, n_count - case when p_noin_canuse then 1 else 0 end),
            n_count_updated_at = case when p_noin_canuse then v_now else n_count_updated_at end
        where last_letter = v_letter;
    end loop;

    update public.word_last_letter_counts
    set
        exact_k_count = greatest(0, exact_k_count - case when p_k_canuse then 1 else 0 end),
        exact_k_count_updated_at = case when p_k_canuse then v_now else exact_k_count_updated_at end,
        exact_n_count = greatest(0, exact_n_count - case when p_noin_canuse then 1 else 0 end),
        exact_n_count_updated_at = case when p_noin_canuse then v_now else exact_n_count_updated_at end
    where last_letter = p_last_letter;
end;
$$;

alter function public.increase_word_stats(character, character, boolean, boolean, integer) owner to postgres;
alter function public.decrease_word_stats(character, character, boolean, boolean, integer) owner to postgres;

comment on column public.word_first_letter_counts.exact_k_count is
    'Number of k_canuse words whose literal first letter matches first_letter.';
comment on column public.word_first_letter_counts.exact_n_count is
    'Number of noin_canuse words whose literal first letter matches first_letter.';
comment on column public.word_first_letter_counts.exact_len3_k_count is
    'Number of three-letter k_canuse words whose literal first letter matches first_letter.';
comment on column public.word_first_letter_counts.exact_len3_n_count is
    'Number of three-letter noin_canuse words whose literal first letter matches first_letter.';
comment on column public.word_last_letter_counts.exact_k_count is
    'Number of k_canuse words whose literal last letter matches last_letter.';
comment on column public.word_last_letter_counts.exact_n_count is
    'Number of noin_canuse words whose literal last letter matches last_letter.';
