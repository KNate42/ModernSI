# ModernSI

An independent international student network: ideas that become campus events, sections for
academic, international, community and personal life, and (next stages) a forum and chat.

ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.

- `backend/` — FastAPI API and worker, see `backend/README.md`
- `frontend/` — Next.js site, see `frontend/README.md`
- `design/mock/` — the static homepage and intro mock: the visual source of truth (palette, type, homepage), see Design below
- `compose.yml`, `.env.example`, `scripts/` — the whole site in one Docker stack, see below
- `compose.small.yml`, `infra/small/` — the low-memory mode for a server with 1 GB of RAM, see "Small server (1 GB)"
- `infra/` — Docker Compose files for the development and test stores, and the Caddy config
- `.github/workflows/images.yml` — builds the site's images for amd64 and arm64 and publishes them on ghcr.io
- `docs/` — specs and implementation plans

## Open it in one command

You need Docker (Docker Desktop on Windows and macOS, Docker Engine with the compose plugin 2.20 or newer on Linux), Python 3 and git.

```bash
git clone <this repository> modernsi
cd modernsi
./scripts/up.sh
```

(Downloaded the ZIP instead? Unpack it, open a terminal in the folder and run `sh scripts/up.sh`: a ZIP can lose the executable bit, which gives "Permission denied".)

The first run writes `.env` with fresh random passwords (`python3 scripts/new_env.py`), builds the images (a few minutes the first time), starts everything, waits until every service is healthy and prints the demo logins. Then open **http://localhost:8080**. On Windows without a shell, run the same steps by hand: `python scripts/new_env.py`, then `docker compose up -d --build --wait`.

**Port 8080 already taken?** Delete `.env` and run `./scripts/up.sh --site http://localhost:9080` (any free port). If you edit `.env` by hand instead, change `SITE_ADDRESS` and `HTTP_PORT` together; `up.sh` checks that they match.

What runs (`compose.yml`): Postgres, Redis, MongoDB, ClickHouse, the API, the worker, the Next.js site and Caddy in front of them. A one-shot `init` service applies the migrations and, in demo mode, creates the demo network, then exits; the API and the worker start after it. Only Caddy has a public port. The stores keep their data in named Docker volumes. One stack per machine: a second copy needs its own `COMPOSE_PROJECT_NAME` in `.env`, or it takes over the first one's containers and data.

### Demo mode

`.env` starts with `DEMO=on`: four made-up campuses on `demo.example`, 60 made-up students, ideas in every state, events this week and in the past, votes, RSVPs and the activity feed. Every person and campus in it is invented. On your own computer (`http://localhost...`) the password of every demo account is `modernsi-demo`:

| Role | E-mail |
|---|---|
| Student (has ideas of their own and plans this week) | `student@almaty.demo.example` |
| Student Government (sees the review queue at `/review`) | `gov@almaty.demo.example` |
| Curator (publishes events) | `curator@astana.demo.example` |
| Admin | `admin@almaty.demo.example` |

On any other address `new_env.py` puts a random `DEMO_PASSWORD` in `.env` instead, because this README is public; `./scripts/up.sh` and `docker compose logs init` print it.

You can also sign up yourself with any address on `almaty.demo.example`, `astana.demo.example`, `tashkent.demo.example` or `bishkek.demo.example`. No real e-mail is sent in demo mode: Mailpit catches it, and the code is on **http://127.0.0.1:8025** (only reachable from the machine itself; on a server see below).

Running `./scripts/up.sh` again is safe: the demo is created once, later runs only move the demo events back around today, so the homepage stays alive.

### Everyday commands

```bash
docker compose ps                     # what runs and whether it is healthy
docker compose logs -f api worker     # logs
docker compose logs init              # the demo logins again
docker compose down                   # stop (the data stays in the volumes)
docker compose down -v                # stop and delete all data
```

To change the address or the mode after the first run, edit `.env` and run `./scripts/up.sh` again (arguments to `up.sh` only count on the very first run). Never use `new_env.py --force` on a stack that has data: the new passwords would not open the old volumes.

## Put it on a server

Any Linux VPS with 4 GB of RAM, or 2 GB plus a swap file (the images are built on the server, and the Next.js build next to running MongoDB and ClickHouse needs the room), and a domain name. Swap on a 2 GB server: `sudo ./scripts/swap.sh` (a 2 GB swap file, kept after reboots; running it again changes nothing). Only 1 GB of RAM? See [Small server (1 GB)](#small-server-1-gb).

1. **DNS.** Point an `A` record (and `AAAA` for IPv6) of your domain, for example `modernsi.example.org`, at the server's address.
2. **Firewall.** Open only 22 (SSH), 80 and 443 (TCP, plus 443/UDP for HTTP/3). For example with ufw: `ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443 && ufw enable`. The stores have no host ports, so nothing else needs to be open.
3. **Docker.** Install Docker Engine and the compose plugin (`curl -fsSL https://get.docker.com | sh` on Ubuntu or Debian). Then let your user run it: `sudo usermod -aG docker $USER`, log out and back in (or run the commands below with `sudo`).
4. **The code and the settings.**
   ```bash
   git clone <this repository> modernsi && cd modernsi
   python3 scripts/new_env.py --site https://modernsi.example.org --live
   ```
   then fill in `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` in `.env` with your mail provider's SMTP details (port 587 with STARTTLS; port 465 is not supported). With an `https://` address the ports become 80 and 443, Caddy gets a Let's Encrypt certificate by itself (the DNS record must already point at the server), redirects http to https, and the session cookie is `Secure`.
5. **Start:** `./scripts/up.sh`. The first certificate takes a few seconds; `docker compose logs caddy` shows it. If SMTP is still empty, `up.sh` stops and says so, because sign-up codes would never arrive.
6. **The first university and admin**, inside the running API container (`exec`, not `run`: `run` would start the one-shots and a second API next to the first, which a small server has no room for):
   ```bash
   docker compose exec api modernsi add-domain uni.edu --label Almaty --country KZ
   docker compose exec api modernsi create-admin --email you@uni.edu --name "Your Name"
   ```

### A demo on the server first

Leave out `--live` in step 4 to show the demo on your domain. Then **anyone who finds the site can log in as the demo admin** with the demo password, so `new_env.py` makes a random one (it is in `.env` and in the output of `up.sh`); keep the demo to a short look. Mailpit stays on the server's own 127.0.0.1: to read sign-up codes, open a tunnel from your computer with `ssh -L 8025:127.0.0.1:8025 you@your-server` and browse **http://127.0.0.1:8025**.

### Going live after a demo

The clean way, which also deletes the demo content (and everything else in the volumes):

```bash
docker compose down -v
rm .env
python3 scripts/new_env.py --site https://modernsi.example.org --live   # then fill in SMTP in .env
./scripts/up.sh
```

Keeping the volumes also works: set `DEMO=off`, `COMPOSE_PROFILES=` (empty) and the SMTP lines in `.env`, then `./scripts/up.sh`. With DEMO off, `init` blocks every account on `*.demo.example` (the demo admin included), ends their sessions and switches the demo domains off, and `up.sh` removes Mailpit. The demo ideas, events and feed stay visible, so on a real site prefer the clean way.

### Updating

```bash
git pull
./scripts/up.sh
```

The images are rebuilt (in the low-memory mode: pulled), `init` applies new migrations, and only the services that changed are recreated; the data stays in the volumes. Update with `up.sh`, not a bare `docker compose pull`, which only knows the image names and not the commit they belong to. Coming from a version before the prebuilt images? The old images are not needed any more: `docker image rm modernsi-backend:local modernsi-web:local` frees about 700 MB.

### Small server (1 GB)

A free or very cheap server with 1 GB of RAM (x86-64 or ARM) runs the site in the low-memory mode: every service gets a memory cap and a small config (`compose.small.yml`, `infra/small/`), and the images are not built on the server (the Next.js build alone needs more than 1 GB) but pulled ready-made from ghcr.io. The caps are upper limits, not reservations: together they come to 912 MB (888 MB without the demo's Mailpit) while the stack really uses about half of that, and the swap file takes the rare moment when several services peak at once. So in this mode swap is required, not optional.

First check the CPU, because MongoDB 8 and ClickHouse do not start on older ones (they crash in a loop with "Illegal instruction"; `up.sh` warns about it too):

```bash
uname -m                                                  # x86_64 or aarch64
grep -o -w -m1 avx /proc/cpuinfo                          # x86_64: must print avx
grep -o -w -E 'atomics|dcpop' /proc/cpuinfo | sort -u     # aarch64: must print both (ARMv8.2-A or newer)
```

Oracle Cloud's free Ampere A1 and AWS Graviton servers pass; a Raspberry Pi 4 and some cheap KVM servers with a plain "QEMU" CPU model do not. A container VPS (OpenVZ, LXC) cannot have its own swap, so it does not work either.

```bash
git clone <this repository> modernsi && cd modernsi
sudo ./scripts/swap.sh                                              # once: 2 GB of swap, required in this mode
python3 scripts/new_env.py --small --site https://modernsi.example.org   # add --live for the real site
./scripts/up.sh                                                     # pulls the images, starts, waits until healthy
```

`--small` puts `LOW_MEMORY=on` and the `COMPOSE_FILE` line that loads `compose.small.yml` into `.env`; `up.sh` checks that the two agree, and warns when the machine has no swap. `new_env.py` and `up.sh` suggest the mode by themselves on a machine with less than 1.5 GB. Everything else (DNS, firewall, SMTP, the first admin with `docker compose exec`) is the same as in the steps above.

What to expect:

- The first start takes a few minutes: about 1 GB of images is downloaded (most of it MongoDB and ClickHouse; on disk they take about 4 GB, so keep 10 GB free). Later starts take under a minute.
- The site itself is as fast as usual for a handful of visitors. Under a burst Caddy lets at most 8 requests at a time through to the Next.js server and 16 to the API, so pages wait a moment instead of a service running out of memory. A login takes 64 MB for its password check, so many logins at the same moment are checked one after another (the rest of the site keeps answering meanwhile).
- Pages with the activity feed and the stats read from ClickHouse with small caches, so they can be a little slower. A very heavy query fails with a memory error instead of taking the server down.
- In a test of the whole demo (all four demo logins, the review queue, a sign-up with the e-mail code) squeezed into 720 MB with no swap, about what a 1 GB server has left after the kernel and Docker, the stack used about 510 MB at rest (`docker stats`) and up to about 490 MB of process memory plus file cache under a burst of 40 page loads and 24 logins right after the first start, with every container under its cap and nothing killed.

How much memory does it use? `docker stats` shows each service against its cap (`MEM USAGE / LIMIT`), `free -m` the whole machine. A service that ran out of its cap is killed by the kernel and restarts by itself; the kernel log keeps every such kill (`sudo dmesg | grep -i "killed process"`), and `docker inspect -f '{{.RestartCount}}' modernsi-site-api-1` counts the restarts (`docker inspect` shows `"OOMKilled": true` only until the restart).

To go back to the normal mode on a bigger server, set `LOW_MEMORY=off`, delete the `COMPOSE_FILE` line in `.env` and run `./scripts/up.sh`; the data stays.

### Prebuilt images

`.github/workflows/images.yml` builds `ghcr.io/knate42/modernsi-api` and `ghcr.io/knate42/modernsi-web` for amd64 and arm64 on every push to the default branch, on tags like `v1.2.0` and when started by hand (Actions, images, Run workflow). Every build is tagged `sha-<commit>`; once both images are built, `latest` (the default branch) or the release tag moves to them. A build takes 20-40 minutes (arm64 is built under emulation).

`IMAGE_TAG` in `.env` picks what `up.sh` pulls. The default, `auto`, pulls the images of the commit the server has checked out, so the code, the compose files and the configs always match the images; right after a push `up.sh` says when they are still being built. `IMAGE_TAG=latest` runs the newest build instead, and for a release check out the tag and pin it: `git checkout v1.2.0`, then `IMAGE_TAG=v1.2.0`.

GitHub makes new packages private, and a server cannot pull a private package without a login. Once, after the first build: open the repository on GitHub, then Packages, `modernsi-api`, Package settings, Change visibility, Public; the same for `modernsi-web`. Or keep them private and log the server in with a personal access token (classic) that has only `read:packages`:

```bash
echo <token> | docker login ghcr.io -u <your GitHub user> --password-stdin
```

`./scripts/up.sh --pull` pulls in the normal mode too, and `./scripts/up.sh --build` builds on the server even in the low-memory mode (it needs 2 GB of RAM or swap). A fork publishes its own images under its own name: set `IMAGE_PREFIX=ghcr.io/<owner>/modernsi` in `.env`.

### Backups

All data lives in four volumes: `modernsi-site_pg` (the source of truth), `modernsi-site_mongo` (profiles and pictures), `modernsi-site_redis` (sessions) and `modernsi-site_clickhouse` (the activity feed and request logs). `./scripts/backup.sh` dumps the important two into dated files in `backups/` and deletes the ones older than 14 days. Run it every night from cron, for example in `/etc/cron.d/modernsi`:

```
10 3 * * * you cd /home/you/modernsi && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Copy `backups/` off the server too (for example with `rsync` from your computer), and keep a copy of `.env`: its passwords open the volumes. Redis and ClickHouse are not in the backup: after a restore everybody logs in again and the activity feed starts from empty.

Restore (the site is down for a minute):

```bash
docker compose stop api worker web
docker compose exec -T postgres pg_restore -U modernsi -d modernsi --clean --if-exists < backups/<date>.pgdump
docker compose exec -T mongo sh -c 'mongorestore --archive --drop -u modernsi -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin' < backups/<date>.mongo
./scripts/up.sh
```

## Design

The look follows the owner's "Visual identity" slide: the palette is taken from the slide literally (navy and night, cream, teal, crimson for the one loud button, butter as the warm accent, royal and periwinkle for the gradient frames), in a light and a dark theme. The page is a "sticker book": 3px outlines, hard shadows, small tilted stickers, marker underlines and short handwritten notes, with real data from the API on the homepage ("This week" spine: next event with a countdown, the week, the idea wall).

- Fonts: Bricolage Grotesque (headings), Manrope (text) and Caveat (notes), self-hosted from npm packages.
- `design/mock/` holds the approved static mock. `design/mock/styles.css` is the master copy of the colour tokens; `frontend/src/app/tokens.css` copies them verbatim.
- `python3 design/mock/contrast.py frontend/src/app/tokens.css` is the palette guard: WCAG contrast of every pair, and a palette that follows the slide (no black-and-white, no neutral grey, no peach or beige). Without an argument it checks the mock.
- `npm run audit:site` in `frontend/` keeps the banned words, pure black, placeholder text and empty links out, and checks that the intro engine is still a byte-for-byte copy of the mock's.
- `frontend/tests/e2e/routes.spec.ts` opens every route in both themes on a desktop and a phone and runs axe-core on each; with `SHOTS_DIR` set it saves the screenshots (see `frontend/README.md`).
- The decisions and the contract are in `docs/superpowers/specs/2026-10-07-visual-refresh-design.md`; the measured results of the last check are in `docs/superpowers/reports/visual-refresh-audit.txt`.

## GitHub Pages

Pages serves only the repository root, so it shows the static mock, not the app (the mock is the design reference, with sample data): the backend and the Next.js site need a real host.
`index.html`, `styles.css`, `page.js`, `intro.js`, `fonts/` and `.nojekyll` in the root are a copy of `design/mock`, which stays the source of truth.
After editing the mock, run `python3 design/sync_pages.py`; `python3 design/sync_pages.py --check` tells whether the copy has drifted.

Author: Anfinogentov Nikita
