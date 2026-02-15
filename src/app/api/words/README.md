
---

## 엔드포인트
- **URL**: `/api/words/search`
- **Method**: `GET`
- **Description**: 모드별 필터링 및 정렬 옵션을 적용한 단어 리스트 반환

---

## 쿼리 파라미터

### 1. 필수 및 공통 옵션
| 파라미터 | 타입 | 설명 | 기본값 |
| :--- | :--- | :--- | :--- |
| `mode` | `string` | 게임 모드 (`kor-start`, `kor-end`, `kung`, `hunmin`, `jaqi`) | `kor-start` |
| `q` | `string` | **검색어.** 모드에 따라 시작자, 끝자, 또는 초성으로 동작 | - |
| `limit` | `number` | 최대 검색 결과 수 | `100` |
| `sortBy` | `string` | 정렬 기준 (`abc`: 가나다순, `length`: 글자수순, `attack`: 한방단어) | `length` |

### 2. 세부 필터링 (Advanced Options)
| 파라미터 | 타입 | 설명 | 기본값 |
| :--- | :--- | :--- | :--- |
| `manner` | `string` | 단어 필터 (`man`: 매너어, `jen`: 전어, `eti`: 에티켓) | `man` |
| `minLength` | `number` | 최소 글자 수 | `2` |
| `maxLength` | `number` | 최대 글자 수 | `100` |
| `duem` | `boolean` | 두음법칙 적용 여부 (`true`/`false`) | `true` |
| `mission` | `string` | 포함해야 할 특정 글자 (미션 파괴용) | `""` |
| `themeId` | `number` | `jaqi` 모드 사용 시 필수 테마 고유 ID | - |

---

## 예제

### A. 일반적인 끝말잇기 (시작 단어 찾기)
`가`로 시작하는 매너어 50개 검색 (글자수 순 정렬)
```http request
GET /api/words/search?mode=kor-start&q=가&manner=man&limit=50&sortBy=length
```
### B. 쿵쿵따 모드
`나`로 시작하는 3글자 단어 검색 (자동으로 3글자로 설정)
```http request
GET /api/words/search?mode=hunmin&q=ㄱㄴ
```
### C. 훈민정음 (초성 퀴즈)
`ㄱㄴ` 초성을 가진 단어 검색
```http request
GET /api/words/search?mode=hunmin&q=ㄱㄴ
```

## Response Status Code

 * 200: OK
 * 400: Bad Request
   * 필수 파라미터(q) 누락
   * 훈민정음 모드에서 2글자가 아닌 쿼리 전송
   * 주제어 모드에서 themeId 누락
 * 500: Internal Server Error
   * 서버 내부 또는 데이터베이스 오류.