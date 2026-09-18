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
