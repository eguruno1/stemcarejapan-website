#!/bin/bash
set -euo pipefail
umask 077
if [ $# -ne 1 ] || [ ! -f "$1" ]; then echo "사용법: $0 <백업파일.sql.gz>" >&2; exit 1; fi
BACKUP_FILE=$1
# 파손된 압축 파일은 DB를 변경하기 전에 거절한다.
gzip -t "$BACKUP_FILE"
temporary=$(mktemp)
trap 'rm -f "$temporary"' EXIT
printf 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;\n' > "$temporary"
gunzip -c "$BACKUP_FILE" >> "$temporary"
echo "복구 대상 DB: $POSTGRES_DB"
printf '현재 데이터를 교체합니다. 사전 백업을 확인했다면 yes 입력: '
read -r answer
if [ "$answer" != yes ]; then echo '취소했습니다.'; exit 0; fi
# SQL 오류가 나면 DROP SCHEMA까지 모두 롤백한다.
psql -X -h "${PGHOST:-postgres}" -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --set ON_ERROR_STOP=on --single-transaction --file "$temporary"
echo '[restore] 완료'
