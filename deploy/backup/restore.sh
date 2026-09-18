#!/bin/sh
set -eu

# 사용법: ./restore.sh <백업파일.sql.gz>
#
# 주의: 이 스크립트는 현재 DB 를 덮어쓴다.
# 운영 DB 에 실행하기 전에 반드시 현재 상태를 먼저 백업한다.

if [ $# -ne 1 ]; then
  echo "사용법: $0 <백업파일.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
  echo "파일을 찾을 수 없습니다: $BACKUP_FILE" >&2
  exit 1
fi

echo "복구 대상 DB: $POSTGRES_DB"
echo "복구할 백업: $BACKUP_FILE"
printf "정말 진행하시겠습니까? 현재 데이터가 모두 사라집니다. (yes 입력): "
read -r answer

if [ "$answer" != "yes" ]; then
  echo "취소했습니다."
  exit 0
fi

echo "[restore] 기존 스키마 삭제 중…"
psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[restore] 백업 복원 중…"
gunzip -c "$BACKUP_FILE" | psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "[restore] 완료. 테이블 확인:"
psql -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"
