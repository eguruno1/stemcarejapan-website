# 상담채팅시스템 개발 실행 안내

## 포트 배치

이 머신에서는 5432 와 3000 을 다른 프로젝트가 쓰고 있어 계획서 기본값에서 조정했다.

| 서비스 | 주소 |
|---|---|
| 정적 홈페이지 | http://localhost:8080 |
| API 서버 | http://localhost:4000 |
| 관리자 화면 | http://localhost:3100 |
| PostgreSQL | localhost:5434 (컨테이너 내부는 5432) |

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
| DB 컨테이너 시작 | `npm run db:up` |
| DB 완전 초기화 | `docker compose down -v && docker compose up -d postgres` |
| 전체 빌드 | `npm run build` |
| DB 접속 | `docker compose exec postgres psql -U stemcare -d stemcare_chat` |

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
- 현재 관리자 화면은 API 연결 확인 화면이다. 고객 위젯·운영자 업무 화면·Socket.IO·AI 기능은 Phase 2~5에서 구현한다.
- 초기 관리자 비밀번호 변경 UI는 아직 없다. 운영용 초기 계정은 seed 전에 `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`를 지정한다. seed 재실행은 기존 계정의 비밀번호를 바꾸지 않는다.
- 완료 내역과 검증 근거는 `docs/plans/working/`의 Phase 0·1 문서에 기록한다. `docs/`는 현재 Git 제외 대상이다.
