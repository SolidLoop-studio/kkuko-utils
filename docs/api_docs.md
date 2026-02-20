# API Server Documentation  
**API Version:** v1

---

## Base URL

| Environment | URL |
|------------|-----|
| Production | `https://api.solidloop-studio.xyz/api/v1` |

---

## Authentication

### Admin API
- 모든 `/admin/*` API는 **Supabase JWT 토큰**이 필요함
- `Authorization` 헤더에 Bearer Token 형식으로 전달

```

Authorization: <supabase_jwt_token>

````

---

## Admin API

### Crawler

#### GET /admin/crawler/health
크롤러 채널별 상태를 조회합니다.

**Response**

| Field | Type | Description |
|------|------|-------------|
| channels | `{ id: string; healthy: boolean }[]` | 채널별 헬스 상태 |

```ts
{
  channels: {
    id: string;
    healthy: boolean;
  }[];
}
````

---

#### POST /admin/crawler/session

크롤러의 세션 정보를 저장합니다.

**Request Body**

| Field        | Type   | Description |
| ------------ | ------ | ----------- |
| channelId    | string | 채널 ID       |
| jwtToken     | string | JWT 토큰      |
| refreshToken | string | Refresh 토큰  |

```ts
{
  channelId: string;
  jwtToken: string;
  refreshToken: string;
}
```

**Response**

```ts
{
  message: "Session saved successfully";
}
```

---

#### POST /admin/crawler/restart/:channelId

특정 채널의 크롤러를 재시작합니다.

**Path Parameter**

| Name      | Type   | Description |
| --------- | ------ | ----------- |
| channelId | string | 크롤러 채널 ID   |

**Response**

```ts
{
  status: "ok",
  channel: string
}
```

---

### Logs

#### GET /admin/logs/api-server

API 서버 로그를 조회합니다.

**Query Parameters**

| Name | Type   | Default | Description          |
| ---- | ------ | ------- | -------------------- |
| date | string | 오늘 날짜   | 로그 날짜 (`YYYY-MM-DD`) |

**Response**

* `text/plain`

---

#### GET /admin/logs/crawler

크롤러 로그를 조회합니다.

**Query Parameters**

| Name | Type   | Default | Description          |
| ---- | ------ | ------- | -------------------- |
| date | string | 오늘 날짜   | 로그 날짜 (`YYYY-MM-DD`) |

**Response**

* `text/plain`

---

### Item (Admin)

- 아이템 조회시 각 페이지당 최대 30개의 아이템입니다.

#### GET /admin/item/items

아이템 목록을 조회합니다.

**Query Parameters**

| Name   | Type   | Description      |
| ------ | ------ | ---------------- |
| page | number | 페이지 번호 |

---

**Response**

```ts
{
  items: {
    id: string;
    name: string;
    description: string;
    updatedAt: number;
    group: string;
    options: {
      gEXP?: number; // 획득 경험치
      hEXP?: number; // 분당 추가 경험치
      gMNY?: number; // 획득 핑
      hMNY?: number; // 분당 추가 핑
      [key: string]: number;
    };
  }[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}
```

---

#### GET /admin/item/items/group/:group

특정 그룹의 아이템 목록을 조회합니다.

**Path Parameter**
| Name  | Type   | Description   |
| ----- | ------ | ------------- |
| group | string | 아이템 그룹 이름 |

---
**Response**

```ts
{
  items: {
    id: string;
    name: string;
    description: string;
    updatedAt: number;
    group: string;
    options: {
      gEXP?: number; // 획득 경험치
      hEXP?: number; // 분당 추가 경험치
      gMNY?: number; // 획득 핑
      hMNY?: number; // 분당 추가 핑
      [key: string]: number;
    };
  }[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}
```

---

#### GET /admin/item/items/name/:name

특정 이름을 포함하는 아이템 목록을 조회합니다.

**Path Parameter**
| Name  | Type   | Description   |
| ----- | ------ | ------------- |
| name  | string | 아이템 이름 일부 |

---

**Response**

```ts
{
  items: {
    id: string;
    name: string;
    description: string;
    updatedAt: number;
    group: string;
    options: {
      gEXP?: number; // 획득 경험치
      hEXP?: number; // 분당 추가 경험치
      gMNY?: number; // 획득 핑
      hMNY?: number; // 분당 추가 핑
      [key: string]: number;
    };
  }[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}
```

---

#### POST /admin/item

아이템을 추가합니다.

**Request Body**
| Field       | Type   | Description    |
| ----------- | ------ | -------------- |
| id          | string | 아이템 ID       |
| name        | string | 아이템 이름     |
| description | string | 아이템 설명     |
| group       | string | 아이템 그룹 이름 |
| options     | object | 아이템 옵션     |

```ts
{
  id: string;
  name: string;
  description: string;
  group: string;
  options: object;
}
```

--- 
Response (201)

```ts
{
  id: string;
  group: string;
  name: string;
  description: string;
  updatedAt: number;
  options: object;
}
```

---

#### PUT /admin/item/:id

아이템 정보를 수정합니다.

**Path Parameter**
| Name | Type   | Description |
| ---- | ------ | ----------- |
| id   | string | 아이템 ID    |

**Request Body**
| Field       | Type   | Description    |
| ----------- | ------ | -------------- |
| name        | string | 아이템 이름     |
| description | string | 아이템 설명     |
| group       | string | 아이템 그룹 이름 |
| options     | object | 아이템 옵션     |

```ts
{
  name?: string;
  description?: string;
  group?: string;
  options?: object;
}
```

---
**Response (200)**

```ts
{
  id: string;
  group: string;
  name: string;
  description: string;
  updatedAt: number;
  options: object;
}
```

---

#### DELETE /admin/item/:id

아이템을 삭제합니다.

**Path Parameter**
| Name | Type   | Description |
| ---- | ------ | ----------- |
| id   | string | 아이템 ID    |

---
**Response (204)**
No Content - 성공적으로 삭제됨

---
### User (Admin)

#### GET /admin/user/users
등록된 사용자 목록을 조회합니다.

**Query Parameters**
| Name  | Type   | Description      |
| ----- | ------ | ---------------- |
| page  | number | 페이지 번호       |

**Response**

```ts
{
  items: {
    id: string;
    nickname: string;
    exp: number;
    observedAt: string; // ISO format
    exordial: string;
    level: number;
    isPublic: boolean;
    isLastOnlineHidden: boolean;
  }[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}
```

---
#### PUT /admin/user/public-status/:id
특정 사용자의 공개 상태를 수정합니다.

**Path Parameter**
| Name | Type   | Description |
| ---- | ------ | ----------- |
| id   | string | 사용자 ID    |

**Request Body**
| Field        | Type   | Description     |
| ------------ | ------ | --------------- |
| isPublic     | boolean| 공개 여부       |

```ts
{
  isPublic: boolean;
}
```

**Response (200)**

```ts
{
  id: string;
  nickname: string;
  exp: number;
  observedAt: string; // ISO format
  exordial: string;
  level: number;
  isPublic: boolean;
  isLastOnlineHidden: boolean;
}
```

---

## User API

### GET /profile/total

등록된 총 사용자 수를 조회합니다.

**Response**

```ts
{
  data: {
    totalUsers: number;
  },
  status: 200;
}
```

---

### GET /profile/:query

유저 프로필 정보를 조회합니다.

**Path Parameter**

| Name  | Type   | Description   |
| ----- | ------ | ------------- |
| query | string | 닉네임 또는 사용자 ID |

**Query Parameters**

| Name | Type   | Description | Values       |
| ---- | ------ | ----------- | ------------ |
| type | string | query의 유형   | `nick`, `id` |

---

#### Response (200)

```ts
{
  data: {
    user: {
      id: string;
      nickname: string;
      exp: number;
      observedAt: string; // ISO format
      exordial: string;
      level: number;
      isPublic: boolean;
      isLastOnlineHidden: boolean;
    };
    equipment: {
      userId: string;
      slot: string;
      itemId: string;
    }[];
    record: {
      id: string;
      userId: string;
      modeId: string;
      total: number;
      win: number;
      exp: number;
      playtime: number; // ms
    }[];
    presence: {
      userId: string;
      channelId: string | null;
      roomId: string | null;
      crawlerId: string;
      updatedAt: string | null; // ISO format, if isLastOnlineHidden is true then null
    };
  };
  status: 200;
}
```

#### Error Codes

| Status | Description |
| ------ | ----------- |
| 403    | 유저 정보가 비공개  |
| 404    | 등록되지 않은 유저  |

---
### GET /profile/nickname/:nickname

유저 정보를 조회합니다. 중복된 닉네임을 처리하기 위함입니다.

**Path Parameter**

| Name  | Type   | Description   |
| ----- | ------ | ------------- |
| nickname | string | 닉네임 |

---

#### Response (200)

```ts
{
  data: {
    user: {
      id: string;
      nickname: string;
      exp: number;
      observedAt: string; // ISO format
      exordial: string;
      level: number;
      isPublic: boolean;
      isLastOnlineHidden: boolean;
    };
    equipment: {
      userId: string;
      slot: string;
      itemId: string;
    }[];
    record: {
      id: string;
      userId: string;
      modeId: string;
      total: number;
      win: number;
      exp: number;
      playtime: number; // ms
    }[];
    presence: {
      userId: string;
      channelId: string | null;
      roomId: string | null;
      crawlerId: string;
      updatedAt: string | null; // ISO format, if isLastOnlineHidden is true then null
    };
  }[];
  status: 200;
}
```

---

## Item API

### GET /item

아이템 정보를 조회합니다.

**Query Parameters**

| Name  | Type   | Description        |
| ----- | ------ | ------------------ |
| query | string | 조회할 아이템 ID (쉼표 구분) |

**Response**

```ts
{
  data: {
    id: string;
    name: string;
    description: string;
    updatedAt: number;
    group: string;
    options: {
      gEXP?: number; // 획득 경험치
      hEXP?: number; // 분당 추가 경험치
      gMNY?: number; // 획득 핑
      hMNY?: number; // 분당 추가 핑
      [key: string]: number;
    };
  };
  status: 200;
}
```

---

## Mode API

### GET /mode

전체 모드 정보를 조회합니다.

**Response**

```ts
{
  data: {
    modeId: string;
    modeName: string;
    group: string;
  }[];
  status: 200;
}
```

---

## Ranking API

### GET /ranking/:mode

모드별 랭킹을 조회합니다.

**Path Parameter**

| Name | Type   | Description              |
| ---- | ------ | ------------------------ |
| mode | string | 모드 ID (`ALL` 사용 시 전체 합산) |

**Query Parameters**

| Name   | Type   | Default | Description               |
| ------ | ------ | ------- | ------------------------- |
| page   | number | 1       | 페이지 번호                    |
| option | string | -       | `win` (승리 수), `exp` (경험치), `total` (총 플레이 판 수) |

---

**Response**

```ts
{
  data: {
    rank: number;
    userRecord: {
      id: number;
      userId: string;
      modeId: string;
      total: number;
      win: number;
      exp: number;
      playtime: number;
    };
    userInfo: {
      id: string;
      nickname: string;
      exp: number;
      observedAt: string;
      exordial: string;
      level: number;
    };
  };
  status: 200;
}
```
