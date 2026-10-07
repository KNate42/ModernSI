# ModernSI

An independent international student network: ideas that become campus events, sections for
academic, international, community and personal life, and (next stages) a forum and chat.

ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.

- `backend/` — FastAPI API and worker, see `backend/README.md`
- `frontend/` — Next.js site, see `frontend/README.md`
- `design/mock/` — the static homepage and intro mock: the visual source of truth (palette, type, homepage), see Design below
- `infra/` — Docker Compose files for the stores
- `docs/` — specs and implementation plans

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
