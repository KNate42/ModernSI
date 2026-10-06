# ModernSI

An independent international student network: ideas that become campus events, sections for
academic, international, community and personal life, and (next stages) a forum and chat.

ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.

- `backend/` — FastAPI API and worker, see `backend/README.md`
- `frontend/` — Next.js site, see `frontend/README.md`
- `design/mock/` — static homepage and intro mock used for design sign-off
- `infra/` — Docker Compose files for the stores
- `docs/` — specs and implementation plans

## GitHub Pages

Pages serves only the repository root, so it shows the static mock, not the app: the backend and the Next.js site need a real host.
`index.html`, `styles.css`, `page.js`, `intro.js` and `.nojekyll` in the root are a copy of `design/mock`, which stays the source of truth.
After editing the mock, run `python3 design/sync_pages.py`; `python3 design/sync_pages.py --check` tells whether the copy has drifted.

Author: Anfinogentov Nikita
