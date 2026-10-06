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

The intro plays once per browser tab session. To see it again, delete `msi_intro_seen` in DevTools → Application → Session Storage.

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

## Audit before a release

- `npm run audit:site` checks for:
  - brand words and placeholder words;
  - forbidden colours and fonts;
  - empty links;
  - an intro engine that differs from the approved mock.
- `python3 ../design/mock/contrast.py src/app/tokens.css` checks the WCAG contrast of the theme tokens.

## Production notes

- Set `API_URL` both for `npm run build` and for `npm run start`.
- Put a reverse proxy (nginx) in front of `next start`, and make it overwrite `X-Forwarded-For` with the client address: `proxy_set_header X-Forwarded-For $remote_addr;`. The reason:
  - Next passes an incoming `X-Forwarded-For` on to the API.
  - The API trusts that header when `MSI_TRUST_FORWARDED_FOR=true` and uses it for rate limits.
  - Without the overwrite, clients could choose their own IP.
- Browser storage keys:
  - `msi_theme` in localStorage, the guest's theme;
  - `msi_intro_seen` in sessionStorage, whether the intro has played.
