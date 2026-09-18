# 운영 배포 절차

## 준비물

- 도메인 (예: `chat.stemcarejapan.example`) 이 서버 IP 를 가리키도록 DNS A 레코드 설정
- Docker 와 Docker Compose 가 설치된 리눅스 서버
- OpenAI API 키

## 1. 소스 준비

```bash
git clone <저장소> stemcarejapan-website
cd stemcarejapan-website/deploy
cp .env.prod.example .env
```

`.env` 를 열어 값을 채운다. 특히:

```bash
# 안전한 비밀번호와 시크릿 생성
openssl rand -base64 32   # POSTGRES_PASSWORD 에 사용
openssl rand -base64 48   # JWT_SECRET 에 사용
```

## 2. HTTPS 인증서 발급 (최초 1회)

먼저 HTTP 만으로 nginx 를 띄워 인증서를 받는다.

```bash
docker compose -f docker-compose.prod.yml up -d nginx
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d $DOMAIN --email 운영자@이메일 --agree-tos --no-eff-email
docker compose -f docker-compose.prod.yml restart nginx
```

인증서 발급 전에는 nginx 가 443 서버 블록의 인증서 파일을 찾지 못해 시작에 실패할 수 있다.
그 경우 `deploy/nginx/site.conf` 의 443 서버 블록을 잠시 주석 처리해 80(HTTP)만으로 먼저 띄운 뒤,
인증서 발급이 끝나면 주석을 풀고 `restart nginx` 한다.

## 3. 전체 배포

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

모든 서비스가 `running` 이어야 한다.

## 4. 관리자 계정 생성

```bash
docker compose -f docker-compose.prod.yml exec api \
  npx tsx apps/api/prisma/seed.ts
```

`.env` 의 `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` 로 계정이 만들어진다(비워두면
`admin@stemcarejapan.local` / `change-me-1234` 로 만들어지므로 반드시 채워둔다).
**로그인 후 즉시 비밀번호를 변경한다.** (비밀번호 변경 화면은 아직 없다 - DB 나 시드
스크립트 재실행으로 바꾼다.)

## 5. 동작 확인

```bash
curl -sI https://$DOMAIN | head -1                # 200
curl -s https://$DOMAIN/api/health                # {"status":"ok",...}
```

브라우저로:
- `https://$DOMAIN/` → 홈페이지, 우하단 상담 위젯
- `https://$DOMAIN/korea-travel/` → 상담 시작
- `https://$DOMAIN/admin` → 운영자 로그인

개발자도구 Network → WS 탭에서 `socket.io` 연결이 `101` 인지 확인한다.

## 6. 업데이트 배포

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

마이그레이션은 API 컨테이너가 시작될 때 자동 적용된다.

## 로그 보기

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f nginx
```

로그는 pino 가 JSON 한 줄로 찍는다 (Task 2). 고객 이름·전화·이메일·상담 본문은
`maskPersonalData` 가 걸러내므로 로그만 봐서는 나오지 않는다 - 실제 내용 확인이
필요하면 DB 에서 직접 조회한다.

## 백업/복구

`deploy/backup/backup.sh` 가 `backup` 컨테이너에서 주기적으로 덤프를 만든다.
자세한 절차와 복구 방법은 [`backup/README.md`](./backup/README.md) 를 참고한다.
**"설정했다"가 아니라 "복구해봤다"로 확인한다** - 배포 직후 한 번은 반드시
`restore.sh` 를 실제로 실행해 복구가 되는지 확인한다.

## 롤백

```bash
git checkout <이전-커밋>
docker compose -f docker-compose.prod.yml up -d --build
```

**주의**: DB 마이그레이션은 자동으로 되돌아가지 않는다. 컬럼을 삭제하는 마이그레이션을
배포한 뒤 롤백하려면 백업에서 복구해야 한다. 그래서 컬럼 삭제는
"코드에서 사용 중단" → "며칠 관찰" → "다음 배포에서 삭제" 순서로 나눠서 한다.

## 배포 전 체크리스트

실제 배포 전 반드시 [`../CHECKLIST.md`](../CHECKLIST.md) 를 전부 통과했는지 확인한다.
