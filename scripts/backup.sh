#!/bin/sh
# Nightly backup of what cannot be rebuilt: Postgres (accounts, ideas, events) and MongoDB (profiles, pictures).
# Writes dated files to backups/ in the repository folder and deletes the ones older than KEEP_DAYS (14).
#   ./scripts/backup.sh
# For every night at 03:10, a line in /etc/cron.d/modernsi (with your path and user):
#   10 3 * * * you cd /home/you/modernsi && ./scripts/backup.sh >> backups/backup.log 2>&1
# Redis (sessions) and ClickHouse (the activity feed and request logs) are not backed up: after a restore
# people log in again and the feed starts over.
# This work made by Anfinogentov Nikita
set -e
cd "$(dirname "$0")/.."
keep=${KEEP_DAYS:-14}
mkdir -p backups
chmod 700 backups
stamp=$(date +%F-%H%M)
docker compose exec -T postgres pg_dump -U modernsi -Fc modernsi > "backups/$stamp.pgdump"
docker compose exec -T mongo sh -c 'mongodump --quiet --archive -u modernsi -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' > "backups/$stamp.mongo"
find backups -name '*.pgdump' -mtime +"$keep" -delete
find backups -name '*.mongo' -mtime +"$keep" -delete
echo "backup $stamp done: $(du -ch backups/"$stamp".* | tail -1 | cut -f1)"
