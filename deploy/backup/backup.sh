#!/bin/sh
set -eu

# 매일 새벽 3시에 백업하고 7일치만 보관한다.
# 컨테이너 안에서 무한 루프로 돌며, 다음 3시까지 잠든다.

BACKUP_DIR=/backups
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

run_backup() {
  timestamp=$(date +%Y%m%d_%H%M%S)
  target="$BACKUP_DIR/stemcare_chat_$timestamp.sql.gz"

  echo "[backup] 시작: $target"

  # -Fc 대신 평문 SQL 을 쓰는 이유: 사람이 열어볼 수 있고 복구가 단순하다.
  if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$target"; then
    echo "[backup] 완료: $(du -h "$target" | cut -f1)"
  else
    echo "[backup] 실패!" >&2
    rm -f "$target"
    return 1
  fi

  # 오래된 백업 삭제
  find "$BACKUP_DIR" -name 'stemcare_chat_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
  echo "[backup] 보관 중인 백업: $(ls -1 "$BACKUP_DIR" | wc -l) 개"
}

# 컨테이너 시작 시 한 번 백업한다. (설정이 맞는지 바로 알 수 있다)
run_backup || true

while true; do
  # 다음 새벽 3시까지 대기
  now=$(date +%s)
  next=$(date -d 'tomorrow 03:00' +%s 2>/dev/null || date -v+1d -v3H -v0M -v0S +%s)
  sleep $((next - now))

  run_backup || echo "[backup] 이번 회차 실패. 다음 회차에 재시도합니다." >&2
done
