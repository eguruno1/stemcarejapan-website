#!/bin/bash
set -euo pipefail
umask 077
BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=7
mkdir -p "$BACKUP_DIR"
run_backup() {
  local target="$BACKUP_DIR/stemcare_chat_$(date +%Y%m%d_%H%M%S).sql.gz"
  local temporary="$target.partial"
  if pg_dump -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip > "$temporary"; then
    mv "$temporary" "$target"
    echo "[backup] 완료: $target"
    find "$BACKUP_DIR" -name 'stemcare_chat_*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
  else
    rm -f "$temporary"
    echo '[backup] 실패: 기존 백업을 유지합니다.' >&2
    return 1
  fi
}
if [ "${BACKUP_ONCE:-0}" = 1 ]; then run_backup; exit $?; fi
run_backup || true
while true; do
  now=$(date +%s)
  next=$(date -d 'today 03:00' +%s)
  if [ "$next" -le "$now" ]; then next=$(date -d 'tomorrow 03:00' +%s); fi
  sleep $((next - now))
  run_backup || echo '[backup] 다음 회차에 재시도합니다.' >&2
done
