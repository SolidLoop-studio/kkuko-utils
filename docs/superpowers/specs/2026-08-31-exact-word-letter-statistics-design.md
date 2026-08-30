# 정확한 단어 첫·끝 글자 통계 설계

## 1. 배경

`word_first_letter_counts`와 `word_last_letter_counts`는 `revers_duem()` 결과를 모두 증가시킨다. 따라서 현재 `k_count`, `n_count`와 쿵쿵따 카운트는 단어에 실제로 적힌 글자의 수가 아니라, 해당 글자에서 두음법칙을 적용해 연결할 수 있는 단어의 수를 나타낸다.

이 동작은 단어 상세, 검색 정렬, docs 등 게임 연결성을 계산하는 조회에는 필요하다. 반면 `/word/stats`의 “첫 글자별 통계”, “끝 글자별 통계”, “쿵쿵따 첫 글자별 통계”는 단어 자체에 실제로 나타난 글자만 집계해야 한다.

## 2. 목표

- 기존 두음 포함 카운트의 의미와 모든 기존 소비자 동작을 보존한다.
- `/word/stats`에는 실제 첫 글자와 끝 글자만 집계한 카운트를 제공한다.
- 단어 INSERT, DELETE, 관련 컬럼 UPDATE 이후 두 종류의 카운트를 같은 트랜잭션에서 유지한다.
- 기존 데이터는 `words` 원본으로부터 정확한 카운트를 다시 계산한다.

## 3. 범위 밖

- 기존 테이블 또는 기존 `count`, `k_count`, `n_count`, `len3_*` 컬럼의 이름 변경
- 단어 상세, 검색, docs가 사용하는 두음 포함 카운트의 의미 변경
- `/word/stats`의 레이아웃, 필터, 정렬 또는 링크 동작 변경
- 원격 Supabase 마이그레이션 실행과 `database.types.ts` 수동 편집

## 4. 데이터 모델

기존 두 테이블에 정확한 통계 전용 컬럼을 추가한다.

`word_first_letter_counts`:

- `exact_k_count integer not null default 0`
- `exact_k_count_updated_at timestamptz null`
- `exact_n_count integer not null default 0`
- `exact_n_count_updated_at timestamptz null`
- `exact_len3_k_count integer not null default 0`
- `exact_len3_k_count_updated_at timestamptz null`
- `exact_len3_n_count integer not null default 0`
- `exact_len3_n_count_updated_at timestamptz null`

`word_last_letter_counts`:

- `exact_k_count integer not null default 0`
- `exact_k_count_updated_at timestamptz null`
- `exact_n_count integer not null default 0`
- `exact_n_count_updated_at timestamptz null`

`exact_*` 카운트에는 `revers_duem()`을 적용하지 않는다. 예를 들어 `여...` 단어 하나는 기존 첫 글자 카운트에서 `여`, `려`, `녀`에 반영되지만 정확한 첫 글자 카운트에서는 `여`에만 반영된다.

타임스탬프는 해당 카운트가 실제로 변할 때만 갱신한다. 백필된 양수 카운트의 타임스탬프는 마이그레이션 실행 시각으로 설정하고, 0인 카운트의 타임스탬프는 `null`로 둔다.

## 5. 마이그레이션과 백필

forward migration 하나가 다음 작업을 한 트랜잭션에서 수행한다.

1. 정확한 통계 컬럼을 추가한다.
2. `words`를 `upper(left(word, 1))`, `upper(right(word, 1))` 기준으로 그룹화한다.
3. `k_canuse`, `noin_canuse`, `length(word) = 3` 조건부 집계로 정확한 카운트를 백필한다.
4. `increase_word_stats()`와 `decrease_word_stats()`를 교체해 기존 두음 포함 갱신과 정확한 갱신을 함께 수행한다.

기존 집계값에는 원래 글자와 두음 파생 글자의 기여분이 합쳐져 있으므로 `exact_*` 값을 기존 카운트에서 빼거나 역산하지 않는다.

현재 트리거는 원래 글자를 항상 기존 집계 테이블에 삽입하므로 모든 실제 첫·끝 글자 행이 이미 존재한다. 백필은 이 행을 갱신하며 기존 카운트는 변경하지 않는다.

## 6. 쓰기 동작

`tg_word_stats_changes()`의 공개 동작과 호출 구조는 유지한다.

- INSERT: 기존 두음 포함 카운트를 증가시키고 원래 첫·끝 글자의 `exact_*`를 한 번 증가시킨다.
- DELETE: 기존 두음 포함 카운트를 감소시키고 원래 첫·끝 글자의 `exact_*`를 한 번 감소시킨다.
- UPDATE: `word`, `k_canuse`, `noin_canuse` 중 하나가 바뀌면 OLD 값을 감소시킨 후 NEW 값을 증가시킨다.
- 모든 감소는 기존 방식과 같이 `greatest(0, ...)`를 사용해 음수가 되지 않게 한다.

기존 함수의 시그니처, 소유자, 실행 권한과 트리거 연결은 변경하지 않는다.

## 7. 조회 동작

`SupabaseWordStatisticsQueryGateway`만 정확한 컬럼을 선택하고 기존 `WordStatistics` DTO로 투영한다.

- 첫 글자: `exact_k_count`, `exact_n_count`, 해당 타임스탬프
- 끝 글자: `exact_k_count`, `exact_n_count`, 해당 타임스탬프
- 쿵쿵따: `exact_len3_k_count`, `exact_len3_n_count`, 해당 타임스탬프

DTO와 `/word/stats` 컴포넌트의 계약은 바꾸지 않는다. 다른 게이트웨이와 SQL 함수는 기존 컬럼을 계속 사용한다.

## 8. 테스트

데이터베이스 통합 테스트는 다음을 검증한다.

- 두음 대상 글자로 시작하거나 끝나는 단어를 추가하면 기존 카운트는 파생 글자에도 증가하지만 `exact_*`는 원래 글자에만 증가한다.
- 3글자 단어만 `exact_len3_*`에 반영된다.
- 삭제와 `k_canuse`/`noin_canuse` 변경이 정확한 카운트를 되돌린다.
- 정확한 카운트와 기존 두음 포함 카운트가 같은 트랜잭션에서 롤백된다.

Jest 어댑터 테스트는 정확한 컬럼을 선택하고 DTO로 투영하는지, 잘못된 정확한 값이나 타임스탬프가 기존의 안정적인 인프라 오류로 변환되는지 검증한다.

## 9. 배포

1. 마이그레이션을 Supabase에 먼저 적용한다.
2. 필요하면 원격 스키마 반영 후 `npm run gen-type`으로 타입을 재생성한다. 이 변경에서는 `database.types.ts`를 직접 편집하지 않는다.
3. 정확한 컬럼을 조회하는 애플리케이션을 배포한다.

애플리케이션을 먼저 배포하면 아직 존재하지 않는 컬럼 조회가 실패하므로 이 순서를 바꾸지 않는다.
