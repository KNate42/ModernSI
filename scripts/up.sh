#!/bin/sh
# Starts (or updates) the whole site with one command: makes .env on the first run, checks it, builds the images,
# brings the stack up, waits until every service is healthy and prints where to go and how to log in.
#   ./scripts/up.sh                                   # first run: demo on http://localhost:8080
#   ./scripts/up.sh --site https://your.domain        # first run on a server (arguments go to new_env.py)
# This work made by Anfinogentov Nikita
set -e
cd "$(dirname "$0")/.."
if ! docker compose version >/dev/null 2>&1; then
  echo "Ooops.. Docker with the compose plugin is needed (docker compose version must work)"
  exit 1
fi
# up --wait needs Compose 2.20 or newer
version=$(docker compose version --short | sed 's/^v//')
major=${version%%.*}
minor=$(echo "$version" | cut -d. -f2)
if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 20 ]; }; then
  echo "Ooops.. Docker Compose $version is too old, 2.20 or newer is needed"
  exit 1
fi
if [ ! -f .env ]; then
  python3 scripts/new_env.py "$@"
elif [ $# -gt 0 ]; then
  echo "Note: .env already exists, so $* is ignored. Edit .env to change the address or the mode."
fi
python3 scripts/new_env.py --check
docker compose up -d --build --wait --remove-orphans
# a Mailpit left from demo mode keeps running when its profile is switched off, so I remove it by hand
if ! grep -q '^DEMO=on' .env; then
  docker compose --profile demo rm -sf mailpit >/dev/null 2>&1 || true
fi
site=$(sed -n 's/^SITE_ADDRESS=//p' .env)
echo
docker compose logs --no-log-prefix init | sed -n '/^Demo logins/,$p;/^demo off/p'
echo
echo "ModernSI is up: ${site}"
if grep -q '^DEMO=on' .env; then
  echo "E-mails (sign-up codes): http://127.0.0.1:$(sed -n 's/^MAILPIT_PORT=//p' .env)"
fi
