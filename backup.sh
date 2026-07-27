#!/bin/sh
# Nightly SQLite backup. Runs inside the tiny alpine `backup` container.
# Uses sqlite3's online .backup so it is safe while the app is writing.
set -eu

DB=/data/budget.db
DIR=/data/backups
KEEP=14

apk add --no-cache sqlite >/dev/null 2>&1 || true
mkdir -p "$DIR"

while true; do
  if [ -f "$DB" ]; then
    TS=$(date +%Y%m%d-%H%M%S)
    sqlite3 "$DB" ".backup '$DIR/budget-$TS.db'" || cp "$DB" "$DIR/budget-$TS.db"
    # Prune all but the newest $KEEP backups.
    ls -1t "$DIR"/budget-*.db 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do rm -f "$f"; done
    echo "backup: wrote $DIR/budget-$TS.db"
  fi
  sleep 86400
done
