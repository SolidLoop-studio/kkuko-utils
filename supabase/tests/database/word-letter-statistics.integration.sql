begin;

select no_plan();

create temporary table word_letter_statistics_snapshot as
select
    letter,
    coalesce((
        select k_count
          from public.word_first_letter_counts
         where first_letter = letter
    ), 0) as first_playable_k_count,
    coalesce((
        select exact_k_count
          from public.word_first_letter_counts
         where first_letter = letter
    ), 0) as first_exact_k_count,
    coalesce((
        select exact_n_count
          from public.word_first_letter_counts
         where first_letter = letter
    ), 0) as first_exact_n_count,
    coalesce((
        select exact_len3_k_count
          from public.word_first_letter_counts
         where first_letter = letter
    ), 0) as first_exact_len3_k_count,
    coalesce((
        select exact_len3_n_count
          from public.word_first_letter_counts
         where first_letter = letter
    ), 0) as first_exact_len3_n_count,
    coalesce((
        select k_count
          from public.word_last_letter_counts
         where last_letter = letter
    ), 0) as last_playable_k_count,
    coalesce((
        select exact_k_count
          from public.word_last_letter_counts
         where last_letter = letter
    ), 0) as last_exact_k_count,
    coalesce((
        select exact_n_count
          from public.word_last_letter_counts
         where last_letter = letter
    ), 0) as last_exact_n_count
from unnest(array['여', '려', '녀']) as letter;

select is(
    coalesce((
        select exact_k_count
          from public.word_first_letter_counts
         where first_letter = '여'
    ), 0),
    (select count(*)::integer
       from public.words
      where upper(left(word, 1)) = '여'
        and k_canuse),
    'the migrated exact first-letter count is rebuilt from literal words'
);
select is(
    coalesce((
        select exact_n_count
          from public.word_last_letter_counts
         where last_letter = '여'
    ), 0),
    (select count(*)::integer
       from public.words
      where upper(right(word, 1)) = '여'
        and noin_canuse),
    'the migrated exact last-letter count is rebuilt from literal words'
);

insert into public.words (word, k_canuse, noin_canuse) values
    ('여¤나', true, true),
    ('가¤여', true, false);

select is(
    (select exact_k_count from public.word_first_letter_counts where first_letter = '여')
        - (select first_exact_k_count from word_letter_statistics_snapshot where letter = '여'),
    1,
    'the literal first letter receives one exact acknowledged count'
);
select is(
    (select exact_n_count from public.word_first_letter_counts where first_letter = '여')
        - (select first_exact_n_count from word_letter_statistics_snapshot where letter = '여'),
    1,
    'the literal first letter receives one exact not-acknowledged count'
);
select is(
    (select exact_len3_k_count from public.word_first_letter_counts where first_letter = '여')
        - (select first_exact_len3_k_count from word_letter_statistics_snapshot where letter = '여'),
    1,
    'a literal three-letter first letter receives one exact kkungkkungtta count'
);
select is(
    (select exact_len3_n_count from public.word_first_letter_counts where first_letter = '여')
        - (select first_exact_len3_n_count from word_letter_statistics_snapshot where letter = '여'),
    1,
    'a literal three-letter first letter receives one exact not-acknowledged kkungkkungtta count'
);
select is(
    (select exact_k_count from public.word_first_letter_counts where first_letter = '려')
        - (select first_exact_k_count from word_letter_statistics_snapshot where letter = '려'),
    0,
    'a reverse-duem first letter does not receive the exact count'
);
select is(
    (select exact_k_count from public.word_first_letter_counts where first_letter = '녀')
        - (select first_exact_k_count from word_letter_statistics_snapshot where letter = '녀'),
    0,
    'the second reverse-duem first letter does not receive the exact count'
);
select results_eq(
    $$
        select letter,
               current_count - before_count as delta
          from (
              select snapshot.letter,
                     snapshot.first_playable_k_count as before_count,
                     stats.k_count as current_count
                from word_letter_statistics_snapshot as snapshot
                join public.word_first_letter_counts as stats
                  on stats.first_letter = snapshot.letter
          ) as deltas
         order by letter
    $$,
    $$ values ('녀'::text, 1), ('려'::text, 1), ('여'::text, 1) $$,
    'the existing first-letter counts keep all reverse-duem playable variants'
);

select is(
    (select exact_k_count from public.word_last_letter_counts where last_letter = '여')
        - (select last_exact_k_count from word_letter_statistics_snapshot where letter = '여'),
    1,
    'the literal last letter receives one exact acknowledged count'
);
select is(
    (select exact_k_count from public.word_last_letter_counts where last_letter = '려')
        - (select last_exact_k_count from word_letter_statistics_snapshot where letter = '려'),
    0,
    'a reverse-duem last letter does not receive the exact count'
);
select results_eq(
    $$
        select letter,
               current_count - before_count as delta
          from (
              select snapshot.letter,
                     snapshot.last_playable_k_count as before_count,
                     stats.k_count as current_count
                from word_letter_statistics_snapshot as snapshot
                join public.word_last_letter_counts as stats
                  on stats.last_letter = snapshot.letter
          ) as deltas
         order by letter
    $$,
    $$ values ('녀'::text, 1), ('려'::text, 1), ('여'::text, 1) $$,
    'the existing last-letter counts keep all reverse-duem playable variants'
);

update public.words
   set word = '려¤나',
       noin_canuse = false
 where word = '여¤나';

select is(
    (select exact_k_count from public.word_first_letter_counts where first_letter = '여')
        - (select first_exact_k_count from word_letter_statistics_snapshot where letter = '여'),
    0,
    'changing the word removes the old literal first-letter exact count'
);
select is(
    (select exact_k_count from public.word_first_letter_counts where first_letter = '려')
        - (select first_exact_k_count from word_letter_statistics_snapshot where letter = '려'),
    1,
    'changing the word adds the new literal first-letter exact count'
);
select is(
    (select exact_n_count from public.word_first_letter_counts where first_letter = '려')
        - (select first_exact_n_count from word_letter_statistics_snapshot where letter = '려'),
    0,
    'changing noin_canuse does not add an exact not-acknowledged count to the new letter'
);

delete from public.words where word in ('려¤나', '가¤여');

select results_eq(
    $$
        select snapshot.letter,
               stats.exact_k_count,
               snapshot.first_exact_k_count,
               last_stats.exact_k_count,
               snapshot.last_exact_k_count
          from word_letter_statistics_snapshot as snapshot
          join public.word_first_letter_counts as stats
            on stats.first_letter = snapshot.letter
          join public.word_last_letter_counts as last_stats
            on last_stats.last_letter = snapshot.letter
         order by snapshot.letter
    $$,
    $$
        select letter,
               first_exact_k_count,
               first_exact_k_count,
               last_exact_k_count,
               last_exact_k_count
          from word_letter_statistics_snapshot
         order by letter
    $$,
    'deleting the fixtures restores every exact acknowledged count'
);

do $rollback_test$
begin
    begin
        insert into public.words (word, k_canuse, noin_canuse)
        values ('여¤라', true, true);
        raise exception 'FORCED_WORD_STATISTICS_ROLLBACK';
    exception
        when raise_exception then
            null;
    end;
end;
$rollback_test$;

select results_eq(
    $$
        select stats.exact_k_count,
               snapshot.first_exact_k_count,
               stats.k_count,
               snapshot.first_playable_k_count
          from word_letter_statistics_snapshot as snapshot
          join public.word_first_letter_counts as stats
            on stats.first_letter = snapshot.letter
         where snapshot.letter = '여'
    $$,
    $$ values (
        (select first_exact_k_count from word_letter_statistics_snapshot where letter = '여'),
        (select first_exact_k_count from word_letter_statistics_snapshot where letter = '여'),
        (select first_playable_k_count from word_letter_statistics_snapshot where letter = '여'),
        (select first_playable_k_count from word_letter_statistics_snapshot where letter = '여')
    ) $$,
    'a failed word transaction rolls back exact and playable counts together'
);

select * from finish();
rollback;
