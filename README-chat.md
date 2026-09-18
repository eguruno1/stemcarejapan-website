# 상담채팅시스템 개발 실행 안내

## 포트 배치

이 머신에서는 5432 와 3000 을 다른 프로젝트가 쓰고 있어 계획서 기본값에서 조정했다.

| 서비스 | 주소 |
|---|---|
| 정적 홈페이지 | http://localhost:8080 |
| API 서버 | http://localhost:4000 |
| 관리자 화면 | http://localhost:3100 |
| PostgreSQL | localhost:5434 (컨테이너 내부는 5432) |

## 운영 문서

| 문서 | 내용 |
|---|---|
| `CHECKLIST.md` | 배포 전 체크리스트 |
| `deploy/DEPLOY.md` | 배포 절차 |
| `deploy/RUNBOOK.md` | 장애 대응 매뉴얼 |
| `deploy/backup/RESTORE-DRILL.md` | 월 1회 복구 리허설 |
| `apps/api/API.md` | API 레퍼런스 |

## 처음 한 번만 하는 준비

1. Node.js 22 LTS 설치 (`node -v` 로 확인)
2. Docker Desktop 설치 (`docker --version` 으로 확인)
3. 저장소 루트에서:

```bash
npm install
cp .env.example .env
npm run build -w packages/shared
docker compose up -d postgres
npm run db:generate -w apps/api
npm run db:migrate:deploy -w apps/api
npm run db:seed -w apps/api
```

## 매일 개발할 때

터미널을 3개 연다.

```bash
# 1번: 정적 홈페이지 (http://localhost:8080)
docker compose up -d web

# 2번: API 서버 (http://localhost:4000)
npm run dev:api

# 3번: 관리자 화면 (http://localhost:3100)
npm run dev:admin
```

## 자주 쓰는 명령

| 목적 | 명령 |
|---|---|
| API 테스트 실행 | `npm run test -w apps/api` |
| 고객·관리자 E2E | `npm run test:e2e` (PostgreSQL만 사전 실행) |
| 관리자 단위·상호작용 테스트 | `npm run test:admin` |
| 위젯 상태·폴링·입력 테스트 | `npm run test:widget` |
| E2E 를 눈으로 보며 디버깅 | `npm run test:e2e:ui` |
| DB 컨테이너 시작 | `npm run db:up` |
| DB 완전 초기화 | `docker compose down -v && docker compose up -d postgres` |
| 전체 빌드 | `npm run build` |
| DB 접속 | `docker compose exec postgres psql -U stemcare -d stemcare_chat` |

## 관리자 화면 사용법

주소: http://localhost:3100

초기 계정은 `npm run db:seed -w apps/api` 로 만든다.
기본값은 `admin@stemcarejapan.local` / `change-me-1234` 이며,
`.env` 의 `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` 로 바꿀 수 있다.

화면 구성:
- 왼쪽: 상담 목록 (상태 필터 / 정렬 / 읽지 않은 개수)
- 가운데: 메시지 (원문 + 번역문 동시 표시)
- 오른쪽: 상담 상태 조작, 고객 정보, 이전 상담 이력, AI 요약, 내부 메모
- 우상단 `설정`: 로그인한 운영자 정보 확인과 로그아웃

메시지·상태 변경은 Socket.IO 로 실시간 반영된다(연결 시 헤더에 `실시간 연결됨`).
소켓이 막힌 환경(방화벽 등)에서는 3초 폴링(목록은 5초)으로 조용히 대체된다.
소켓이 살아 있어도 이 폴링은 안전망으로 계속 돈다 — 서버 부담보다 "안 맞는 화면"이 더 비싸다.
탭이 백그라운드면 폴링을 쉬므로, 다른 창을 보고 있다가 돌아오면 한 박자 뒤에 갱신된다.

## 문제가 생겼을 때

**포트가 이미 사용 중이라고 나온다**
`lsof -i :4000` 으로 누가 쓰는지 확인하고 종료한다.

**관리자 화면에서 CORS 오류가 난다**
`.env` 의 `ADMIN_ORIGIN` 이 `http://localhost:3100` 인지 확인하고 API 서버를 재시작한다.

**DB에 연결이 안 된다**
`docker compose ps` 로 postgres 가 `healthy` 인지 확인한다.
`DATABASE_URL` 의 포트가 5434 인지도 확인한다.

**`@stemcare/shared` 를 못 찾는다**
`npm run build -w packages/shared` 를 실행한다. `package.json` 의 `main` 이
`dist/index.js` 를 가리키므로 빌드 전에는 찾지 못한다.

## Phase 0·1 검토 완료 (2026-09-18)

- Node.js 22, 홈페이지 8080 / API 4000 / 관리자 3100 / PostgreSQL 5434를 사용한다.
- 관리자도 루트 `.env`를 읽는다. `NEXT_PUBLIC_API_URL` 변경 후 개발 서버를 재시작하고 배포용 빌드는 다시 생성한다.
- API·shared는 CommonJS이며 관리자 앱은 Next.js의 `module: esnext`, `moduleResolution: bundler` 설정을 유지한다.
- `npm test`는 별도 테스트 DB만 초기화한다. `TEST_DATABASE_URL`은 필수이며 DB 이름은 `_test`로 끝나고 개발 DB와 달라야 한다. 직접 Vitest를 실행해도 같은 검사가 적용된다.
- Phase 0 당시 관리자는 API 연결 확인 화면이었다. 현재 Phase 2 고객 위젯과 Phase 3 관리자 업무 화면이 구현되었으며 Socket.IO·AI는 Phase 4·5 범위다.
- 초기 관리자 비밀번호 변경 UI는 아직 없다. 운영용 초기 계정은 seed 전에 `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`를 지정한다. seed 재실행은 기존 계정의 비밀번호를 바꾸지 않는다.
- 완료 내역과 검증 근거는 `docs/plans/working/`의 Phase 0·1 문서에 기록한다. `docs/`는 현재 Git 제외 대상이다.

## Phase 4: 실시간(Socket.IO) (2026-09-18)

- 고객 위젯·관리자 화면 모두 Socket.IO 로 연결한다. 실패(CDN 차단, 방화벽 등)하면
  자동으로 폴링으로 대체되고, 화면은 어느 쪽으로 동작하는지 신경 쓸 필요가 없다.
- 소켓 이벤트는 `chat:` 접두어(메시지·입력중·핸드오프), 목록 갱신은 `rooms:` 접두어를 쓴다.
  자세한 이벤트 목록은 `apps/api/API.md` 참고.
- **소켓 인증은 auth.roomId+visitorToken(고객)을 쿠키보다 먼저 확인한다.** 브라우저 쿠키는
  포트를 구분하지 않으므로, 운영자로 로그인해 둔 브라우저로 고객 위젯(다른 포트)을 열면
  그 소켓 연결에도 운영자 쿠키가 함께 실려 온다. roomId/visitorToken 이 있으면 쿠키가
  뭐가 와 있든 고객으로 인증해야 한다 — 순서를 바꾸면 안 된다.
- 메시지 저장 로직은 여전히 `createMessageRow` 한 곳뿐이다. HTTP 라우트와 소켓 핸들러가
  같은 함수를 부르고, 저장 성공 후에만 브로드캐스트한다.
- 운영자가 방을 열어(소켓으로 그 방에 join 한) 있는 동안 온 고객 메시지는 unread 로
  쌓이지 않는다. 접속 상태(담당자 온라인 여부)는 DB에 저장하지 않고 그때그때
  Socket.IO 연결 목록을 세어 계산한다 — 서버가 죽어도 "접속 중"이 영원히 남지 않는다.
- 소켓으로 보낸 메시지가 서버에서 거부되면(방 종료 등) `chat:error` 에 그 메시지의
  `clientMessageId` 가 함께 온다. 없으면 위젯의 "전송 중" 말풍선이 ack(성공)도
  error(실패)도 못 받고 영원히 멈춰 있는다.

## Phase 2·3 검토 반영 (2026-09-18)

- `/`, `/stemcell/`, `/korea-travel/` 모두 상담 시작 폼을 제공한다. 서비스 페이지는 해당 분야를 미리 선택한다.
- 위젯은 3초, 관리자 상세는 3초, 목록은 5초마다 폴링한다. 네트워크 왕복·백그라운드 탭·서버 오류 때문에 실제 표시까지 정확히 3초를 보장하지는 않는다.
- 일시적인 서버 오류는 고객 세션을 유지한 채 재연결한다. 401/403/404일 때만 세션 만료로 처리한다.
- 고객·관리자 모두 IME 입력 확정 Enter를 전송으로 취급하지 않는다. 관리자 전송 실패 후 같은 본문·언어로 재시도하면 같은 메시지 ID를 사용한다.
- 자동 스크롤은 갱신 전 맨 아래 100px 이내일 때만 한다. 이전 내용을 읽는 중에는 직접 전송·패널 재열기도 위치를 유지하며, 새 메시지 버튼으로 최신 위치에 이동한다.
- 관리자 API의 401은 인증 상태를 해제한다. 로그아웃 요청 실패는 오류로 표시하며 성공했다고 가장하지 않는다.
- 이전 상담은 **동일 customerId**의 다른 방 최대 20건이다. 현재 공개 상담 시작은 새 customerId를 생성하므로 이름·연락처가 같다고 자동으로 묶지 않는다. 안전한 재방문 고객 식별·연결은 별도 후속 설계가 필요하다.
- 담당자 연결 버튼은 현재 요청 문장을 전송한다. 자동 대기 전환·AI 중단·운영시간 처리는 Phase 5 범위다.
- 설정 화면은 계정 확인·로그아웃만 제공한다. 번역·요약은 기존 저장값을 표시하며 자동 생성하지 않는다.

### E2E 실행 환경

`npm run test:e2e`는 shared/API를 빌드하고 테스트용 홈페이지(127.0.0.1:18081), API(14001), 관리자(13101)를 자동 실행·종료한다. 일반 개발 서버를 재사용하지 않는다. 관리자 테스트 산출물은 `.next-e2e/`로 분리한다.

`.env`의 `TEST_DATABASE_URL`이 필요하며 Phase 1과 동일한 안전 검사를 적용한다. 테스트 전용 운영자를 upsert하고 테스트 상담을 이 DB에 생성한다. API 테스트와 같은 DB를 사용하므로 **동시에 실행하지 않는다**. 개발 DB의 seed 계정이나 비밀번호에는 의존하지 않는다. Chromium 설치가 필요하면 `npx playwright install chromium`을 실행한다.

위젯 API 기본 주소는 localhost 환경의 4000 포트, 그 외에는 같은 출처다. 필요할 때 모듈 로드 전에 `window.STEMCARE_CHAT_API_URL`을 설정할 수 있고, E2E는 이를 이용해 테스트 API를 지정한다. 실제 배포에서는 접속 가능한 API와 CORS 설정을 먼저 준비해야 한다.

### Phase 4~6 검토 반영 (2026-09-18)

- 위젯: 소켓 연결/입장 실패와 끊김 시 REST fallback, 세션별 이벤트 격리. 인계 요청은 `/api/public/chat/:roomId/handoff`의 확정 응답으로 처리한다.
- AI: 방별 작업 순서 보장, 응답 저장 직전 방 잠금/상태/최신 메시지 재검사. 초기 문의도 번역하고 운영자 요청·민감 문의는 waiting 전환한다.
- 운영: 메시지·요약·메모·평가 삭제를 방별 트랜잭션으로 처리하고 재개방 여부를 재확인한다. 연락처 180일 처리는 대화 본문까지 완전 익명화하는 기능이 아니다.
- 검증: E2E 전용 포트는 홈페이지 18081, API 14001, 관리자 13101이다. 자동 테스트는 OpenAI 키를 강제로 비워 외부 AI 호출을 하지 않는다.
- 백업/복구는 Bash + pipefail, 완성된 백업만 공개, 복구 SQL 오류는 전체 롤백한다. `python3 tests/ops/test_backup_scripts.py`로 실패 경로를 확인한다.
- 운영자 설정은 `next.config.mjs`이며, 이미지 빌드/실행에 같은 `/admin` basePath를 전달한다.
- 실제 AI 품질, 공개 HTTPS 발급·갱신 스케줄, 운영 서버 배포 승인은 별도 확인 대상이다. [배포 절차](deploy/DEPLOY.md)와 [체크리스트](CHECKLIST.md)를 따른다.
