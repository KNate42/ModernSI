#!/bin/sh
# Starts (or updates) the whole site with one command: makes .env on the first run, checks it, builds the images
# (or pulls the prebuilt ones), brings the stack up, waits until every service is healthy and prints where to go
# and how to log in.
#   ./scripts/up.sh                                   # first run: demo on http://localhost:8080
#   ./scripts/up.sh --site https://your.domain        # first run on a server (arguments go to new_env.py)
#   ./scripts/up.sh --small --site https://your.domain   # first run on a 1 GB server (low-memory mode)
#   ./scripts/up.sh --pull     # pull the prebuilt images from ghcr.io instead of building (the default with LOW_MEMORY=on)
#   ./scripts/up.sh --build    # build the images here (the default otherwise)
# With IMAGE_TAG=auto (the default) the pulled images are the ones built from this very checkout (sha-<commit>).
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
# --pull and --build are mine; everything else goes to new_env.py on the first run
images=""
for arg in "$@"; do
  shift
  case "$arg" in
    --pull) images=pull ;;
    --build) images=build ;;
    *) set -- "$@" "$arg" ;;
  esac
done
if [ ! -f .env ]; then
  python3 scripts/new_env.py "$@"
elif [ $# -gt 0 ]; then
  echo "Note: .env already exists, so $* is ignored. Edit .env to change the address or the mode."
fi
python3 scripts/new_env.py --check
env_value() {
  sed -n "s/^$1=//p" .env | tail -n 1
}

# MongoDB 8 and ClickHouse need a newer CPU than some cheap servers have; without it they crash in a loop
# with "Illegal instruction", so I say why before that happens
case "$(uname -m)" in
  x86_64 | amd64)
    if [ -r /proc/cpuinfo ] && ! grep -qw avx /proc/cpuinfo; then
      echo "Warning: this CPU has no AVX, which MongoDB 8 needs: mongo will crash with 'Illegal instruction'."
      echo "  Ask the provider for a CPU type with AVX (often called 'host' CPU), or pick another server."
    fi ;;
  aarch64 | arm64)
    if [ -r /proc/cpuinfo ] && { ! grep -qw atomics /proc/cpuinfo || ! grep -qw dcpop /proc/cpuinfo; }; then
      echo "Warning: this ARM CPU is older than ARMv8.2-A, which MongoDB 8 and ClickHouse need (a Raspberry Pi 4"
      echo "  is one of them): they will crash with 'Illegal instruction'. Ampere (Oracle A1) and AWS Graviton work."
    fi ;;
esac

if [ "$(env_value LOW_MEMORY)" = on ]; then
  # a 1 GB server lives on its swap file in short peaks: without one, the kernel kills a store instead
  if [ "$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo 1)" = 0 ]; then
    echo "Warning: this machine has no swap, which the low-memory mode needs for short peaks: run sudo ./scripts/swap.sh once."
  fi
  # the healthchecks of compose.small.yml use start_interval, which Docker Engine 25 and newer understand
  engine=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo 0)
  if [ "${engine%%.*}" -lt 25 ] 2>/dev/null; then
    echo "Warning: Docker Engine $engine is older than 25, so the first start waits longer for the healthchecks."
    echo "  Install a current Docker with: curl -fsSL https://get.docker.com | sh"
  fi
fi

if [ -z "$images" ]; then
  # There I never build on a low-memory server: the Next.js build alone needs more than 1 GB
  if [ "$(env_value LOW_MEMORY)" = on ]; then images=pull; else images=build; fi
fi
if [ "$images" = pull ]; then
  # IMAGE_TAG=auto pulls the images built from this checkout, so the code, compose files and configs here always
  # match the images; latest or a release tag like v1.2.0 pulls that one instead
  tag=${IMAGE_TAG:-$(env_value IMAGE_TAG)}
  tag=${tag:-auto}
  pull_tag=$tag
  if [ "$tag" = auto ]; then
    if commit=$(git rev-parse HEAD 2>/dev/null); then
      pull_tag=sha-$(echo "$commit" | cut -c1-7)
    else
      echo "Note: this is not a git checkout, so I pull the images tagged latest (IMAGE_TAG in .env picks another)"
      pull_tag=latest
    fi
  fi
  # only the two images of the site (api is the image of init and worker too); the stores are pulled by up
  # when missing, as in build mode, so an update does not depend on Docker Hub's pull limits
  if ! out=$(IMAGE_TAG=$pull_tag docker compose pull --quiet api web 2>&1); then
    echo "$out"
    echo "Ooops.. pulling the images $pull_tag failed."
    if echo "$out" | grep -qiE 'manifest unknown|not found'; then
      echo "The images for this commit are not on ghcr.io yet: the images workflow on GitHub needs 20-40 minutes"
      echo "after a push. Wait for it and run ./scripts/up.sh again, or set IMAGE_TAG=latest in .env to run the newest."
    else
      echo "If the error says 'denied' or 'unauthorized', the ghcr.io packages are private: make them public once,"
      echo "or docker login ghcr.io (see 'Prebuilt images' in README.md). ghcr.io also says 'denied' for an image that"
      echo "was never built: check that the images workflow has run for this commit."
    fi
    echo "To build here instead (needs 2 GB of RAM or swap): ./scripts/up.sh --build"
    exit 1
  fi
  if [ "$pull_tag" != "$tag" ]; then
    # the pulled images also get the tag auto, so plain docker compose commands find them without up.sh
    prefix=${IMAGE_PREFIX:-$(env_value IMAGE_PREFIX)}
    prefix=${prefix:-ghcr.io/knate42/modernsi}
    docker tag "$prefix-api:$pull_tag" "$prefix-api:$tag"
    docker tag "$prefix-web:$pull_tag" "$prefix-web:$tag"
    echo "images: $pull_tag"
  fi
  IMAGE_TAG=$tag docker compose up -d --no-build --wait --remove-orphans
else
  docker compose up -d --build --wait --remove-orphans
fi
# a Mailpit left from demo mode keeps running when its profile is switched off, so I remove it by hand
if [ "$(env_value DEMO)" != on ]; then
  docker compose --profile demo rm -sf mailpit >/dev/null 2>&1 || true
fi
site=$(env_value SITE_ADDRESS)
echo
docker compose logs --no-log-prefix init | sed -n '/^Demo logins/,$p;/^demo off/p'
echo
echo "ModernSI is up: ${site}"
if [ "$(env_value DEMO)" = on ]; then
  echo "E-mails (sign-up codes): http://127.0.0.1:$(env_value MAILPIT_PORT)"
fi
