# 상담채팅 API (Phase 1)

Base URL: `http://localhost:4000`

모든 실패 응답은 다음 형태다.

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "입력값을 확인해주세요.", "details": [] } }
```

## 공개 API (고객 위젯용)

고객은 로그인하지 않는다. 대신 상담 시작 시 받은 `visitorToken` 을
`X-Visitor-Token` 헤더에 넣어 자기 상담방임을 증명한다.

### POST /api/public/chat/start → 201

```json
{
  "name": "야마다 타로",
  "phone": "+81 90-1234-5678",
  "email": "yamada@example.com",
  "preferredLanguage": "ja",
  "serviceType": "korea_travel",
  "sourcePage": "/korea-travel/",
  "message": "来月、母と2人で韓国に行きたいです。",
  "privacyAgreed": true
}
```

응답:
```json
{ "roomId": "uuid", "customerId": "uuid", "visitorToken": "64자 hex", "status": "bot" }
```

`visitorToken` 은 **이 응답에서만 볼 수 있다.** 잃어버리면 상담방에 다시 못 들어간다.
반드시 `localStorage` 에 저장한다. 서버 DB에는 SHA-256 해시만 남는다.

### GET /api/public/chat/:roomId → 200
헤더: `X-Visitor-Token: <token>`

고객 응답에는 전화번호·이메일·운영자 메모·번역 내부 정보가 포함되지 않는다.

### POST /api/public/chat/:roomId/messages → 201
헤더: `X-Visitor-Token: <token>`
```json
{ "text": "ホテルの予約もお願いできますか。", "clientMessageId": "브라우저가 만든 uuid" }
```

같은 방·같은 발신자의 `clientMessageId`로 재전송하면 기존 메시지를 반환한다.
ID는 생략 가능하며, 지정하면 공백 제거 후 1~100자여야 한다. 다른 발신자가 사용한 ID는 `409 MESSAGE_ID_CONFLICT`다.
종료된 방의 전송은 재전송 여부와 관계없이 `409 ROOM_CLOSED`다.

## 관리자 API (운영자용)

로그인 후 발급되는 httpOnly 쿠키로 인증한다.
브라우저 `fetch` 는 반드시 `credentials: 'include'` 를 붙여야 쿠키가 전송된다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/admin/auth/login` | `{ email, password }` |
| POST | `/api/admin/auth/logout` | |
| GET | `/api/admin/auth/me` | 로그인 상태 확인 |
| GET | `/api/admin/chat-rooms` | `?status=&mine=&sort=` |
| GET | `/api/admin/chat-rooms/:roomId` | 상세 (열면 읽음 처리됨) |
| PATCH | `/api/admin/chat-rooms/:roomId/assign` | 내 상담으로 배정 |
| PATCH | `/api/admin/chat-rooms/:roomId/status` | `{ status }` |
| POST | `/api/admin/chat-rooms/:roomId/messages` | `{ originalText, originalLanguage, translatedText?, translatedLanguage? }` |
| POST | `/api/admin/chat-rooms/:roomId/notes` | `{ note }` |

## 주요 오류 코드

| code | status | 의미 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 입력값 형식 오류 |
| `UNAUTHORIZED` | 401 | 로그인/토큰 없음 |
| `INVALID_CREDENTIALS` | 401 | 이메일 또는 비밀번호 오류 |
| `FORBIDDEN` | 403 | 다른 사람의 상담방 |
| `OPERATOR_DISABLED` | 403 | 비활성 계정 |
| `NOT_FOUND` | 404 | 없는 상담방/경로 |
| `ROOM_CLOSED` | 409 | 종료된 상담 |
| `ALREADY_ASSIGNED` | 409 | 다른 운영자가 담당 중 |

## 초기 관리자 계정

```bash
npm run db:seed -w apps/api
```

기본값 `admin@stemcarejapan.local` / `change-me-1234`.
`.env` 의 `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` 로 바꿀 수 있다.
**운영 배포 전 반드시 변경한다.**

## 2026-09-18 검토 반영 계약

- 모든 관리자 인증 요청에서 DB의 계정 존재·활성 상태와 현재 역할을 재확인한다. 로그인 이후 삭제·비활성화된 계정은 기존 쿠키가 있어도 401이다.
- 배정·상태 변경·메시지 저장·상세 조회의 읽음 처리는 같은 상담방 행 잠금으로 직렬화한다. 방 생성과 첫 메시지도 한 트랜잭션이다.
- 동일 상태로 재요청하면 기존 종료 시각과 메시지를 유지한다. `closed`에서 다른 상태로 전환하면 `closedAt`을 지운다. 담당자 배정도 방을 다시 열 수 있다.
- `translatedText`, `translatedLanguage`는 둘 다 생략하거나 함께 보내야 한다. 공백뿐인 번역문은 400이다. 운영자 메시지도 `clientMessageId`를 지원한다.
- 시스템 메시지의 `messageType`은 `system`이다.
- 최근순 목록은 메시지가 없는 방을 마지막에 둔다. `oldest_waiting`은 마지막 메시지 오름차순이며 대기방만 보려면 `status=waiting`도 지정한다.
- 읽음 상태는 현재 방 단위로 공유한다. 운영자별 읽음 기록은 구현 범위 밖이다.
- 잘못된 JSON은 `400 INVALID_JSON`, 1MB 초과 요청은 `413 PAYLOAD_TOO_LARGE`다.
- 메시지 ID가 다른 발신자와 충돌하면 `409 MESSAGE_ID_CONFLICT`다.

## Phase 3: 고객별 이전 상담 이력

`GET /api/admin/chat-rooms/:roomId/customer-history` (운영자 쿠키 인증 필요)

응답은 `{ history: CustomerHistoryItem[] }`다. 각 항목은 `roomId`, `status`, `serviceType`, `startedAt`, `closedAt`, `messageCount`를 포함한다. 현재 방을 제외한 동일 `customerId`의 방을 최근 생성순으로 최대 20개 반환한다. 없는 방은 404이며 이력 조회 자체는 읽음 상태를 바꾸지 않는다.

공개 상담 시작은 매번 새 고객을 생성한다. 이름·연락처로 다른 고객 레코드의 방을 자동 병합하지 않는다. 따라서 이 API는 동일 고객 레코드에 연결된 방의 이력을 제공하며 재방문자 식별 기능은 별도 구현이 필요하다.

## Phase 4: 실시간 (Socket.IO)

HTTP API는 그대로 유지된다. Socket.IO는 폴백 없는 환경(방화벽 등)에서도 계속 쓸 수 있도록
REST를 대체하지 않고 얹는다. 저장 로직은 여전히 `createMessageRow` 한 곳뿐이며, HTTP 라우트도
소켓 핸들러도 같은 함수를 거친 뒤에만 브로드캐스트한다.

### 연결 인증 (핸드셰이크 `auth`)

| 신원 | 필드 | 비고 |
|---|---|---|
| 고객 | `roomId`, `visitorToken` | REST의 `X-Visitor-Token`과 같은 값 |
| 운영자 | `operatorToken` 또는 관리자 쿠키 | 관리자 앱은 쿠키만 쓴다(`withCredentials: true`) |

인증 실패는 연결 자체를 거부한다(`connect_error`). **`roomId`+`visitorToken`이 함께 오면
쿠키가 무엇이든 항상 고객으로 인증한다** — 브라우저 쿠키는 포트를 구분하지 않으므로, 운영자로
로그인해 둔 브라우저로 고객 위젯(다른 포트)을 열면 그 소켓에도 운영자 쿠키가 실려 온다.

### 이벤트 (클라이언트 → 서버)

| 이벤트 | payload | 설명 |
|---|---|---|
| `chat:join` | `{ roomId }` | 고객은 자기 방만, 운영자는 아무 방이나 |
| `chat:message` | `{ roomId, text, clientMessageId }` | HTTP `POST .../messages`와 같은 저장 로직 |
| `chat:typing` | `{ roomId, isTyping }` | 나를 제외한 같은 방 참가자에게만 전달 |
| `chat:handoff-request` | `{ roomId, reason? }` | `bot` 상태일 때만 `waiting`으로 전환 (재요청은 무시) |

### 이벤트 (서버 → 클라이언트)

| 이벤트 | payload | 설명 |
|---|---|---|
| `chat:joined` | `{ roomId, status, assignedOperatorId, messages }` | join 성공 응답 |
| `chat:message` | `{ message }` | 고객에게는 `toMessageDTO(row, 'customer')`, 운영자에게는 `'operator'` — 절대 같은 객체를 보내지 않는다 |
| `chat:message:ack` | `{ clientMessageId, message }` | 보낸 사람 본인에게만 |
| `chat:status` | `{ roomId, status, assignedOperatorId }` | 배정·상태 변경(HTTP 경유 포함) |
| `chat:presence` | `{ roomId, operatorOnline, anyOperatorOnline }` | DB에 저장하지 않고 현재 소켓 연결을 세어 계산 |
| `chat:error` | `{ code, message, clientMessageId? }` | `chat:message`/`chat:handoff-request` 실패 시 원래 요청의 `clientMessageId`를 함께 돌려준다 — 없으면 위젯이 어떤 "전송 중" 말풍선을 실패로 바꿔야 할지 알 수 없다 |
| `rooms:updated` / `rooms:new` | `{ roomId }` | `operators` 방 전체(운영자 목록 화면 갱신용) |

### unread와 소켓

운영자 소켓이 그 방(`room:<roomId>`)에 join 되어 있는 동안 고객 메시지가 도착하면
`operatorLastReadAt`을 즉시 갱신한다. 방을 열어둔 채 실시간으로 대화하는 동안 unread 배지가
계속 올라가는 것을 막기 위해서다.

### 폴백

소켓 연결이 5초 안에 되지 않거나 CDN이 차단되면 두 클라이언트 모두 조용히 REST 폴링으로
전환한다(고객 위젯 3초, 관리자 목록 5초·상세 3초). 소켓이 살아 있어도 관리자 화면의 폴링은
안전망으로 계속 돈다.
