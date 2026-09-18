# 복구 리허설 (월 1회 실행)

**"백업이 있다"와 "복구할 수 있다"는 다르다.** 실제로 복구해본 적이 없는 백업은
없는 것과 같다. 한 달에 한 번, 아래 절차를 그대로 실행한다.

## 준비: 리허설용 DB 만들기

운영 DB 를 건드리지 않고 별도 DB 에 복구해본다.

```bash
cd deploy

# 1) 리허설용 DB 생성
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS restore_drill;"
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE restore_drill;"
```

## 실행

```bash
# 2) 가장 최근 백업 파일 확인
docker compose -f docker-compose.prod.yml exec backup ls -lt /backups | head -5

# 3) 리허설 DB 에 복구
docker compose -f docker-compose.prod.yml exec backup sh -c \
  'gunzip -c /backups/$(ls -t /backups | head -1) | psql -h postgres -U $POSTGRES_USER -d restore_drill'
```

## 검증 (모두 통과해야 한다)

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d restore_drill -c "\dt"
# → 6개 테이블 + _prisma_migrations 가 보인다

docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d restore_drill -c "SELECT count(*) FROM chat_rooms;"
# → 운영 DB 와 비슷한 건수

docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d restore_drill -c "SELECT count(*) FROM messages;"
# → 0 이 아니다

docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d restore_drill \
  -c "SELECT id, status, created_at FROM chat_rooms ORDER BY created_at DESC LIMIT 3;"
# → 최근 상담이 실제로 들어 있다
```

## 정리

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE restore_drill;"
```

## 기록

| 날짜 | 실행자 | 백업 파일 | 결과 | 비고 |
|---|---|---|---|---|
| | | | | |

리허설이 실패하면 **배포보다 우선순위가 높은 문제**다. 즉시 원인을 찾는다.
