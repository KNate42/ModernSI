# ModernSI — frontend

<!-- This work made by Anfinogentov Nikita -->

The Next.js 16 site of ModernSI. Server components call the API directly at `API_URL`. The browser talks to `/api/*`, which Next rewrites to the same backend, so the session cookie stays on the site's own origin.

## Run locally

1. Start the stores and the backend, as `../backend/README.md` describes:
   - `docker compose -f ../infra/docker-compose.yml up -d`;
   - `uv run modernsi dev` in `backend/`.
2. Install the dependencies: `npm install`.
3. Run `cp .env.example .env.local`. Change `API_URL` if the backend is not on port 8040.
4. Start the site with `npm run dev`, then open http://localhost:3000.

The fonts are npm packages (`@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/manrope`, `@fontsource/caveat`), so `npm install` brings them and neither the build nor the site calls Google Fonts.

### Seeing the intro again

The intro plays once per browser tab session. To see it again, do one of these:

- open any page with `?intro` (for example http://localhost:3000/?intro);
- delete `msi_intro_seen` in DevTools → Application → Session Storage and reload;
- open the site in a new tab or window.

`?still=1` shows the calm version of the site (no long animations), like the system setting "reduce motion". The intro then shows its short form too.

## Tests

The end-to-end tests run against a real backend and worker on the test stores:

```bash
docker compose -f ../infra/docker-compose.test.yml up -d --wait
npm run test:e2e
```

Playwright starts two servers:
- the backend on port 8100, seeded by `backend/tests/e2e_seed.py`;
- a production build of the site on port 3100.

Do not run the backend's pytest at the same time. Both use the test stores, and the seed wipes them.

When the bundled Playwright browser is not installed, point `CHROMIUM_PATH` at any Chromium binary.

### The specs

| Spec | What it checks |
|---|---|
| `home.spec.ts` | the homepage on live data, its empty and busy states (against a stand-in API), motion, layout, API down |
| `ideas.spec.ts`, `events.spec.ts`, `personal.spec.ts`, `auth.spec.ts` | the user flows: idea path, events and RSVP, personal page, sign-up and login |
| `shell.spec.ts`, `audit.spec.ts`, `intro.spec.ts` | header, footer, theme switch, phone bar, mobile menu, every internal link, the intro |
| `a11y.spec.ts` | axe on the inner pages, one crimson button per page, a clean console |
| `routes.spec.ts` | every route of the site, see below |

### Every route in both themes and on both screens

`tests/e2e/routes.spec.ts` opens every route of the site (public, signed-in as a student, an author, Student Government, a curator and an unconfirmed account, the 404 pages and the error page) in the light and the dark theme (chosen through `localStorage.msi_theme` while the system scheme is the opposite one), on a desktop (1440x900) and on a phone (390x844). For each page it checks:

- axe-core with the `wcag2a` and `wcag2aa` tags finds no violations (what axe cannot decide, such as text on a dotted band, is listed as "needs review" in the summary and is judged on the screenshot);
- the page does not scroll sideways and nothing sticks out of the screen unseen;
- the console has no errors or warnings, so there is no hydration mismatch;
- the chosen theme really is on `<html>`.

It takes about five minutes. With `SHOTS_DIR` set it also saves a full-page screenshot per route, theme and viewport (`<route>-<theme>-<viewport>.png`, for example `ideas-dark-phone.png`) and `routes-summary.json` with the axe numbers:

```bash
SHOTS_DIR=tests/e2e/shots npx playwright test tests/e2e/routes.spec.ts
```

`tests/e2e/shots` is ignored by git. In the phone screenshots the fixed bottom bar shows up once, near the first screen height: that is how a full-page capture draws a fixed element, not a layout fault.

## Where the styles live

- `src/app/tokens.css`: the colour tokens (copied from the mock, checked by the palette guard) and the layout tokens.
- `src/app/globals.css`: the base, stickers, buttons, header, footer, phone bar and intro, shared by every page.
- `src/app/pages.css`: the inner pages: the hero band, cards, tickets, the idea path, forms, messages, empty states and skeletons.
- `src/app/home.css`: the homepage, scoped under `.home`.

An inner page starts with `PageHero` (or `FormShell` for a form) and keeps to the sticker language: 3px outlines, hard shadows, tilt only on small stickers, the three cool tints (`teal`, `sky`, `steel`) and one crimson button per page.

## Audit before a release

- `npm run audit:site` checks for:
  - brand words and placeholder words;
  - the old term "Hub" and the words the voice bans (ecosystem, seamless, empower, leverage, digital hub, solutions, platform);
  - pure black (`#000`, `rgba(0,0,0)`) and forbidden fonts;
  - empty links;
  - an intro engine that differs from the approved mock.
- `python3 ../design/mock/contrast.py src/app/tokens.css` is the palette check. It reads the theme tokens and checks the WCAG contrast of every text and surface pair, and that the palette follows the slide: no black-and-white, no neutral grey, no warm peach or beige backgrounds. Run it without the argument to check the mock itself. The tokens in `tokens.css` are a verbatim copy of the mock's, so change them in `design/mock/styles.css` first.
- `python3 ../design/sync_pages.py --check` tells whether the GitHub Pages copy in the repository root still matches `design/mock`.
- `tests/e2e/routes.spec.ts` and `tests/e2e/a11y.spec.ts` run axe-core on the routes in both themes, on a desktop and on a phone (see above).

## Production notes

- The root `compose.yml` runs the site from `Dockerfile`: a Next.js standalone build (`NEXT_OUTPUT=standalone`) served by `node server.js` as the non-root `node` user, with Caddy in front. Caddy sends `/api/*` straight to the API and everything else here, and overwrites `X-Forwarded-For` (see `../infra/caddy/Caddyfile`).
- Set `API_URL` both for `npm run build` and for `npm run start`.
- Without the compose stack, put a reverse proxy (nginx) in front of `next start`, and make it overwrite `X-Forwarded-For` with the client address: `proxy_set_header X-Forwarded-For $remote_addr;`. The reason:
  - Next passes an incoming `X-Forwarded-For` on to the API.
  - The API trusts that header when `MSI_TRUST_FORWARDED_FOR=true` and uses it for rate limits.
  - Without the overwrite, clients could choose their own IP.
- Fonts are self-hosted from npm (see the top), so the build needs no network access to Google.
- Browser storage keys:
  - `msi_theme` in localStorage, the guest's theme;
  - `msi_intro_seen` in sessionStorage, whether the intro has played.
