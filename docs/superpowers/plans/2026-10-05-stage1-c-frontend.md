# ModernSI — Stage 1C: Frontend — Implementation Plan

**Goal:** The Next.js site for stage 1: intro, header with the five sections, homepage, sign-up/login, ideas (propose, vote, review, team), events, section overview pages, profile and settings — wired to the stage 1 API.

**Architecture:** Next.js 16 App Router. Server Components fetch the API directly (`API_URL`) and forward the visitor's cookie; Client Components mutate through `/api/*`, which `next.config.ts` rewrites to the FastAPI backend, so the session cookie stays first-party. Design tokens and the intro engine come from the approved mock (Plan A). Playwright runs end-to-end against the real backend and worker on the test stores.

**Tech Stack:** Next.js 16.3.8, React 19.2, TypeScript 5, GSAP 3.15.0, `server-only`, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-10-05-stage1-foundation-home-design.md` (sections 6, 7, 8, 9, 10). Depends on Plan A (`design/mock/*`, approved by the user) and Plan B (backend complete, all tests green).

## Global Constraints

- **Read the Next 16 docs first.** Next.js 16 differs from older versions. Before writing a file that uses an API, read the matching guide in `frontend/node_modules/next/dist/docs/`. Facts this plan relies on, verified in those docs:
  - `params` and `searchParams` are Promises;
  - `cookies()` is async;
  - `error.tsx` receives `{ error, retry }` (not `reset`);
  - `global-error.tsx` must render its own `<html>`/`<body>`;
  - server `fetch` is not cached unless asked.
- **Brand ban.** No university names, crests, palettes or fonts. Forbidden colours: `#AB0520 #0C234B #001C48 #1E5288 #8B0015 #EF4056 #81D3EB #378DBD #007D84 #70B865 #A95C42`. No "Arizona", "Wildcat", "Bear Down", "UofA" anywhere in UI or code.
- **Tokens and engine come verbatim from Plan A.** Tokens are copied from `design/mock/styles.css`, and the intro engine is `design/mock/intro.js` copied unchanged.
- **Interface copy.** English UI. No dead links, no `href="#"`, no "coming soon" / "TBD" / "lorem". Stage-2 items appear as descriptive text, never as links or buttons.
- **Header.** Order: Academic · International · Community · Personal, a thin divider, then Forum.
- **Footer.** Must contain verbatim: "ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university."
- **Intro.**
  - Plays once per browser session (`sessionStorage` key `msi_intro_seen`, wrapped in try/catch).
  - Skip button, click anywhere or Esc ends it.
  - `prefers-reduced-motion` → short fade.
  - The overlay is controlled by `html[data-intro="1"]`, which an inline head script sets before paint. Without JS there is no intro, and the content is always server-rendered underneath.
- **Theme.**
  - Follows `prefers-color-scheme` by default.
  - Guests: the choice is stored in `localStorage` (`msi_theme`).
  - Signed-in users: the choice is stored in the profile (`theme`), and the server sets `data-theme` on `<html>`.
- **Empty states.** Hero counters only when `show_counters`. "On the Hub" hidden with no events. Feed hidden with fewer than 3 items. Campus network hidden with no campuses. With no ideas, the "How it works" example appears instead of the list.
- **Times.** Rendered in the visitor's timezone by a client component (`LocalTime`). Sent to the API as ISO strings with a timezone (`toISOString()`).
- **Layout.** No horizontal scroll at 360 px. 16 px minimum side gutter.
- **Code style.** TypeScript in standard Next.js style (camelCase, typed props). Every file starts with a comment: one line on its purpose + `This work made by Anfinogentov Nikita`. No `Co-Authored-By` in commits.

## Review Focus

- `?next=` on the login page pointing off-site (`//evil.example`, `https://evil.example`) → ignored, the user lands on `/personal`. Test in Task C3.
- The API being down while a page renders (fetch throws, not just 5xx) → the header still renders as a guest, optional blocks hide, and pages needing data show `error.tsx` with a retry button, not a blank screen. Test in Task C6.
- Event time typed in `datetime-local` (no timezone) → converted to an absolute instant in the visitor's timezone before sending; the event page shows the same wall-clock time back. Test in Task C5.
- Double-clicking Vote / Join / RSVP → one request in flight, the button is disabled while pending, the count never jumps by two. Test in Task C4.
- The theme toggled by a guest and then the page reloaded → no flash of the wrong theme (the inline script applies `msi_theme` before paint). Test in Task C7.

---

## File Structure

```
frontend/
  package.json  next.config.ts  tsconfig.json  playwright.config.ts  .env.example  README.md
  public/icon.svg
  scripts/audit.mjs                 brand/placeholder/colour/dead-link/engine-copy audit
  src/app/
    tokens.css  globals.css  layout.tsx  page.tsx  error.tsx  not-found.tsx  global-error.tsx
    about/  academic/  international/  community/  personal/  forum/          section and info pages
    ideas/page.tsx  ideas/new/page.tsx  ideas/[id]/page.tsx  ideas/[id]/edit/page.tsx
    events/page.tsx  events/new/page.tsx  events/[id]/page.tsx
    review/page.tsx
    join/ verify/ login/ forgot/ reset/ request-campus/                      auth pages
    profile/[id]/page.tsx  settings/page.tsx
  src/components/
    intro/engine.js  intro/IntroOverlay.tsx
    Header.tsx  UserMenu.tsx  ThemeToggle.tsx  Footer.tsx  Logo.tsx  LocalTime.tsx
    HeroNet.tsx  Pillars.tsx  Steps.tsx  IdeaCard.tsx  IdeaList.tsx  EventCard.tsx  FeedList.tsx  CampusList.tsx  Progress.tsx  Topics.tsx
    forms/useSubmit.ts  forms/Field.tsx  forms/FormError.tsx
    auth/JoinForm.tsx  auth/VerifyForm.tsx  auth/LoginForm.tsx  auth/ForgotForm.tsx  auth/ResetForm.tsx  auth/RequestCampusForm.tsx
    ideas/IdeaForm.tsx  ideas/VoteButton.tsx  ideas/TeamButton.tsx  ideas/DecisionForm.tsx  ideas/ResubmitButton.tsx  ideas/ReportButton.tsx
    events/EventForm.tsx  events/RsvpButton.tsx
    settings/SettingsForm.tsx  settings/AvatarUpload.tsx  settings/LogoutEverywhere.tsx
  src/lib/
    types.ts  errors.ts  server-api.ts  client-api.ts  query.ts  format.ts  feed-text.ts
  tests/e2e/
    start-backend.sh  helpers.ts  shell.spec.ts  intro.spec.ts  auth.spec.ts  ideas.spec.ts  events.spec.ts  home.spec.ts  personal.spec.ts  audit.spec.ts
backend/tests/e2e_seed.py           wipes the test stores, allows uni.edu, creates staff accounts
docs/superpowers/reports/stage1-audit.txt   measured audit results for the stage delivery
```

---

### Task C1: Scaffold, tokens, API clients, site shell, e2e harness

**Files:**
- Create: the Next.js app in `frontend/` (generated), then the files listed below
- Create: `frontend/next.config.ts` (replace), `frontend/.env.example`, `frontend/public/icon.svg`, `frontend/playwright.config.ts`
- Create: `frontend/src/app/tokens.css`, `globals.css` (replace), `layout.tsx` (replace), `page.tsx` (replace, temporary shell), `error.tsx`, `not-found.tsx`, `global-error.tsx`
- Create: `frontend/src/lib/types.ts`, `errors.ts`, `server-api.ts`, `client-api.ts`, `query.ts`, `format.ts`
- Create: `frontend/src/components/Logo.tsx`, `Header.tsx`, `UserMenu.tsx`, `ThemeToggle.tsx`, `Footer.tsx`, `LocalTime.tsx`
- Create: `frontend/tests/e2e/start-backend.sh`, `helpers.ts`, `shell.spec.ts`
- Create: `backend/tests/e2e_seed.py`
- Modify: `design/mock/contrast.py` (accept a path argument)

**Interfaces:**
- Consumes: Plan A tokens; Plan B API.
- Produces:
  - Server: `apiGet<T>(path)`, `apiTry<T>(path)` (null on 401/403/404/5xx/unreachable), `getMe()` (cached per request).
  - Client: `api<T>(path, { method?, json?, form? })` throwing `ApiError`, `errorText(error)`.
  - `class ApiError { status, code, message, fields }`.
  - `qs(params)` → `"?a=1&b=2"`.
  - Labels: `categoryLabels`, `statusLabels`, `roleLabels`, `scopeText(scope, campus)`.
  - Components: `<LocalTime iso mode="datetime"|"date"|"relative" />`, `<Header me />`, `<Footer />`, `<LogoMark />`.
  - CSS classes: `wrap`, `btn`, `btn-primary`, `btn-ghost`, `btn-small`, `card`, `eyebrow`, `muted`, `section`, `page-head`, `field`, `input`, `badge`, `chips`, `chip`, `prose`, `notice`, `empty`, `grid-2`, `stack`.
  - E2E: helpers `uniqueEmail`, `codeFor`, `skipIntro`, `signUpInBrowser`, `apiUser`, `loginInBrowser`, `STAFF`.

- [ ] **Step 1: Generate the app and install dependencies**

Run:
```bash
npx --yes create-next-app@16.3.8 frontend --ts --app --src-dir --no-tailwind --eslint --import-alias "@/*" --use-npm --disable-git --yes
cd frontend && npm install gsap@3.15.0 server-only && npm install -D @playwright/test@1.63.0 && npx playwright install chromium
rm -f src/app/page.module.css src/app/favicon.ico public/*.svg
```
Expected: `frontend/` with `src/app/layout.tsx`, `AGENTS.md`, `node_modules/next/dist/docs/`. Keep `AGENTS.md`/`CLAUDE.md` (Next re-creates them) and commit them.

- [ ] **Step 2: Config, env, icon**

`frontend/next.config.ts`:

```ts
// Next.js config: /api/* is proxied to the FastAPI backend, so the session cookie stays on this origin.
// This work made by Anfinogentov Nikita
import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:8040";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
```

`frontend/.env.example`:

```bash
# Where the FastAPI backend listens. Server components call it directly; the browser goes through the /api rewrite.
API_URL=http://localhost:8040
```

`frontend/public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0B0B0D"/><path d="M16 16 C20 11 24 9 28 8 M16 16 C11 19 8 23 6 27 M16 16 C19 20 23 22 27 23" stroke="#9B85FF" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="16" cy="16" r="4" fill="#F4F2EE"/></svg>
```

- [ ] **Step 3: Tokens and global styles**

`frontend/src/app/tokens.css`: copy the first three blocks of `design/mock/styles.css` verbatim — the `:root { … }` block, the `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { … } }` block and the `:root[data-theme="light"] { … }` block — with this header comment on top:

```css
/*
 * Theme tokens, copied verbatim from the approved mock (design/mock/styles.css).
 * This work made by Anfinogentov Nikita
 */
```

`frontend/src/app/globals.css`: start with this header, then paste everything from `design/mock/styles.css` **after** the three token blocks (from `* { box-sizing: border-box; }` to the end), then change the `body` rule's `font-family` to `var(--font-manrope), system-ui, sans-serif`, change the `.intro` rule's `display: grid` to `display: none`, and append the additions below:

```css
/*
 * Global styles: layout, components and the intro overlay. Based on the approved mock.
 * This work made by Anfinogentov Nikita
 */
```

Additions (append at the end of `globals.css`):

```css
/* intro overlay is shown only when the head script flags a first visit */
html[data-intro="1"] .intro { display: grid; }
.intro-word, .intro-welcome, .intro-skip { font-family: var(--font-manrope), system-ui, sans-serif; }

main { min-height: 60vh; }
.section { padding: clamp(40px, 7vw, 88px) 0; border-top: 1px solid var(--border); }
.section:first-child { border-top: 0; }
.page-head { padding: clamp(40px, 7vw, 80px) 0 24px; }
.page-head h1 { font-size: clamp(32px, 5vw, 56px); font-weight: 800; letter-spacing: -0.03em; }
.page-head p { color: var(--muted); max-width: 60ch; margin: 12px 0 0; font-size: 18px; }
.stack > * + * { margin-top: 16px; }
.grid-2 { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 900px) { .grid-2 { grid-template-columns: 1fr; } }
.btn-ghost { background: transparent; }
.btn-small { padding: 8px 14px; font-size: 14px; }
.btn[disabled], .btn[aria-disabled="true"] { opacity: .55; cursor: not-allowed; }
.badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--muted); }
.badge-accent { border-color: var(--accent-text); color: var(--accent-text); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; }
.chip { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--border); color: var(--fg); font-weight: 600; font-size: 14px; }
.chip:hover { text-decoration: none; border-color: var(--fg); }
.chip[aria-current="page"] { background: var(--fg); color: var(--bg); border-color: var(--fg); }
.prose { line-height: 1.7; overflow-wrap: anywhere; }
.prose a { text-decoration: underline; }
.notice { padding: 14px 16px; border-radius: 12px; border: 1px solid var(--border); background: var(--surface); }
.notice-error { border-color: var(--accent-text); }
.empty { color: var(--muted); padding: 24px 0; }
.link-more { display: inline-block; margin-top: 16px; font-weight: 700; }
.breadcrumbs { font-size: 14px; color: var(--muted); margin-bottom: 16px; }

/* forms */
.form { display: grid; gap: 18px; max-width: 520px; }
.field { display: grid; gap: 6px; }
.field label, .field legend { font-weight: 700; font-size: 14px; }
.field fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 8px; }
.input, .textarea, .select {
  width: 100%; font: inherit; color: var(--fg); background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.textarea { min-height: 140px; resize: vertical; }
.input:focus, .textarea:focus, .select:focus { outline: 2px solid var(--accent-text); outline-offset: 1px; }
.hint { color: var(--muted); font-size: 13px; }
.field-error { color: var(--accent-text); font-size: 13px; font-weight: 600; }
.radio { display: flex; gap: 8px; align-items: center; font-weight: 500; }

/* header additions */
.nav a[aria-current="page"] { background: var(--surface); }
.nav-auth { display: none; }
@media (max-width: 900px) {
  .hide-sm { display: none; }
  .nav.open .nav-auth { display: flex; gap: 8px; margin-top: 16px; }
}
.user-menu { position: relative; }
.user-button { display: inline-flex; align-items: center; gap: 8px; padding: 4px 12px 4px 4px; border-radius: 999px; border: 1px solid var(--border); background: transparent; color: var(--fg); font: inherit; font-weight: 600; cursor: pointer; max-width: 200px; }
.user-button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: var(--on-accent); display: inline-grid; place-items: center; font-weight: 800; flex: none; object-fit: cover; }
.avatar-lg { width: 96px; height: 96px; font-size: 36px; }
.menu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 220px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 6px; display: grid; z-index: 30; }
.menu a, .menu button { text-align: left; padding: 10px 12px; border-radius: 8px; color: var(--fg); background: transparent; border: 0; font: inherit; cursor: pointer; }
.menu a:hover, .menu button:hover { background: var(--bg); text-decoration: none; }
@media (max-width: 560px) { .user-button span:last-child { display: none; } .user-button { padding: 4px; } }

/* idea and event bits */
.idea-card h3 { margin: 12px 0 6px; font-size: 20px; }
.idea-card p { margin: 0; color: var(--muted); }
.idea-card .meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 16px; font-size: 14px; color: var(--muted); }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.team-list { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 8px; }
.team-list li { display: flex; gap: 10px; align-items: center; }
.aside { position: sticky; top: 88px; }
```

- [ ] **Step 4: Shared library code**

`frontend/src/lib/types.ts`:

```ts
// Shapes returned by the ModernSI API (mirrors backend schemas).
// This work made by Anfinogentov Nikita

export type Role = "student" | "student_gov" | "curator" | "admin";
export type Category = "event" | "academic" | "club" | "research" | "volunteering" | "campus_life";
export type Scope = "campus" | "network";
export type IdeaStatus = "open" | "in_review" | "needs_changes" | "rejected" | "forming_team" | "live" | "done" | "expired";

export type Author = { id: string; display_name: string; campus_label: string | null };

export type Me = Author & { email: string; role: Role; status: "pending" | "active" | "blocked" };

export type IdeaCard = {
  id: string; title: string; summary: string; category: Category; scope: Scope; campus_label: string | null;
  status: IdeaStatus; vote_count: number; vote_threshold: number; team_size: number; team_min: number;
  author: Author; created_at: string; expires_at: string;
};

export type IdeaDetail = IdeaCard & {
  body_md: string; body_html: string; review_note: string | null; is_hidden: boolean;
  my_vote: boolean; in_team: boolean; is_author: boolean; can_edit: boolean; team: Author[];
};

export type Page<T> = { items: T[]; next_cursor: string | null };

export type EventItem = {
  id: string; title: string; description_md: string; description_html: string; starts_at: string; ends_at: string;
  location_text: string | null; online_url: string | null; campus_label: string | null; going_count: number;
  idea_id: string | null; idea_title: string | null; created_by: Author; i_am_going: boolean; is_past: boolean;
};

export type FeedKind = "user_verified" | "idea_created" | "idea_reached_review" | "idea_decided" | "team_formed" | "event_published";

export type FeedItem = {
  id: string; kind: FeedKind; at: string; actor_id: string | null; idea_id: string | null; event_id: string | null;
  campus_label: string | null; data: Record<string, string | null>;
};

export type Stats = { students: number; campuses: number; ideas_to_events: number; show_counters: boolean };

export type Campus = { campus_label: string; country_code: string; students: number };

export type Profile = {
  id: string; display_name: string; campus_label: string | null; role: Role; joined_at: string; bio: string;
  languages: string[]; interests: string[]; links: string[]; theme: "system" | "light" | "dark"; has_avatar: boolean; extended: boolean;
};
```

`frontend/src/lib/errors.ts`:

```ts
// One error type for every API call, built from the backend's {"error": {code, message, fields}} body.
// This work made by Anfinogentov Nikita

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  code: string;
  fields: FieldError[];

  constructor(status: number, code: string, message: string, fields: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => null);
  const error = body?.error;
  return new ApiError(
    response.status,
    error?.code ?? "http_error",
    error?.message ?? "Something went wrong. Please try again.",
    error?.fields ?? [],
  );
}
```

`frontend/src/lib/server-api.ts`:

```ts
// Server-side API access: calls the backend directly and forwards the visitor's cookies.
// This work made by Anfinogentov Nikita
import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { ApiError, toApiError } from "./errors";
import type { Me } from "./types";

const apiUrl = process.env.API_URL ?? "http://localhost:8040";

export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(apiUrl + path, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as T;
}

// For blocks that may quietly disappear: a guest, a missing record, a store outage or an unreachable API
// hides the block instead of breaking the whole page.
export async function apiTry<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status >= 500 || [401, 403, 404].includes(error.status))) return null;
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export const getMe = cache(() => apiTry<Me>("/api/auth/me"));
```

`frontend/src/lib/client-api.ts`:

```ts
// Browser-side API access through the /api rewrite. Throws ApiError with the backend's code and message.
// This work made by Anfinogentov Nikita
import { ApiError, toApiError } from "./errors";

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; json?: unknown; form?: FormData };

export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      credentials: "same-origin",
      headers: options.json !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
    });
  } catch {
    throw new ApiError(0, "network_error", "No connection to the server. Check your internet and try again.");
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
```

`frontend/src/lib/query.ts`:

```ts
// Builds query strings, repeating keys for arrays (category=a&category=b) like the API expects.
// This work made by Anfinogentov Nikita

type Value = string | number | boolean | null | undefined | Array<string | number>;

export function qs(params: Record<string, Value>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, String(item)));
    else search.append(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
```

`frontend/src/lib/format.ts`:

```ts
// Human labels for API enums.
// This work made by Anfinogentov Nikita
import type { Category, IdeaStatus, Role, Scope } from "./types";

export const categoryLabels: Record<Category, string> = {
  event: "Event",
  academic: "Academic initiative",
  club: "Club",
  research: "Research project",
  volunteering: "Volunteering",
  campus_life: "Campus life",
};

export const statusLabels: Record<IdeaStatus, string> = {
  open: "Collecting support",
  in_review: "In review",
  needs_changes: "Needs changes",
  rejected: "Not approved",
  forming_team: "Gathering a team",
  live: "On the Hub",
  done: "Done",
  expired: "Expired",
};

export const roleLabels: Record<Role, string> = {
  student: "Student",
  student_gov: "Student Government",
  curator: "Curator",
  admin: "Admin",
};

export function scopeText(scope: Scope, campus: string | null): string {
  return scope === "network" ? "whole network" : campus ?? "own campus";
}
```

- [ ] **Step 5: Shell components**

`frontend/src/components/Logo.tsx`:

```tsx
// The node mark: a dot with three curved threads, the still frame of the intro burst.
// This work made by Anfinogentov Nikita

export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 16 C20 11 24 9 28 8 M16 16 C11 19 8 23 6 27 M16 16 C19 20 23 22 27 23" stroke="var(--accent-text)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="16" cy="16" r="4.5" fill="currentColor" />
    </svg>
  );
}
```

`frontend/src/components/LocalTime.tsx`:

```tsx
// Shows a time in the visitor's timezone. The server renders UTC first; the browser swaps in local time.
// This work made by Anfinogentov Nikita
"use client";
import { useEffect, useState } from "react";

type Mode = "datetime" | "date" | "relative";

function format(iso: string, mode: Mode, timeZone?: string): string {
  const date = new Date(iso);
  if (mode === "relative") {
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [["day", 86400], ["hour", 3600], ["minute", 60]];
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    for (const [unit, size] of units) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return "just now";
  }
  const options: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { day: "numeric", month: "short", year: "numeric", timeZone }
      : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone };
  return new Intl.DateTimeFormat("en-GB", options).format(date) + (timeZone === "UTC" && mode === "datetime" ? " UTC" : "");
}

export function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: Mode }) {
  const [text, setText] = useState(() => (mode === "relative" ? format(iso, "date", "UTC") : format(iso, mode, "UTC")));
  useEffect(() => {
    setText(format(iso, mode));
  }, [iso, mode]);
  return <time dateTime={iso}>{text}</time>;
}
```

`frontend/src/components/ThemeToggle.tsx`:

```tsx
// Light/dark switch. Guests keep the choice in localStorage; signed-in users also save it to their profile.
// This work made by Anfinogentov Nikita
"use client";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";

export function ThemeToggle({ signedIn }: { signedIn: boolean }) {
  async function toggle() {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = current === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("msi_theme", next);
    } catch {
      // storage blocked: the choice lasts until reload
    }
    if (!signedIn) return;
    try {
      const profile = await api<Profile>("/api/profiles/me");
      const { bio, languages, interests, links } = profile;
      await api("/api/profiles/me", { method: "PUT", json: { bio, languages, interests, links, theme: next } });
    } catch {
      // unconfirmed accounts cannot save a profile yet; the local choice still applies
    }
  }

  return (
    <button className="icon-btn" type="button" onClick={toggle} aria-label="Switch colour theme">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
    </button>
  );
}
```

`frontend/src/components/UserMenu.tsx`:

```tsx
// Account menu in the header: profile, settings, review queue for Student Government, log out.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";
import type { Me } from "@/lib/types";

export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const reviewer = me.role === "student_gov" || me.role === "admin";
  return (
    <div className="user-menu" ref={box}>
      <button className="user-button" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="avatar" aria-hidden="true">{me.display_name.slice(0, 1).toUpperCase()}</span>
        <span>{me.display_name}</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          {me.status === "pending" && <Link role="menuitem" href="/verify" onClick={() => setOpen(false)}>Confirm your e-mail</Link>}
          <Link role="menuitem" href={`/profile/${me.id}`} onClick={() => setOpen(false)}>My profile</Link>
          <Link role="menuitem" href="/personal" onClick={() => setOpen(false)}>Personal</Link>
          {reviewer && <Link role="menuitem" href="/review" onClick={() => setOpen(false)}>Review queue</Link>}
          <Link role="menuitem" href="/settings" onClick={() => setOpen(false)}>Settings</Link>
          <button role="menuitem" type="button" onClick={logout}>Log out</button>
        </div>
      )}
    </div>
  );
}
```

`frontend/src/components/Header.tsx`:

```tsx
// Site header: logo, the four directions plus Forum, theme switch, account or Join/Log in, mobile menu.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Me } from "@/lib/types";
import { LogoMark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const sections = [
  { href: "/academic", label: "Academic" },
  { href: "/international", label: "International" },
  { href: "/community", label: "Community" },
  { href: "/personal", label: "Personal" },
];

export function Header({ me }: { me: Me | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const current = (href: string) => (pathname === href || pathname.startsWith(href + "/") ? "page" : undefined);

  return (
    <header className="header">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="ModernSI home">
          <LogoMark />
          ModernSI
        </Link>
        <nav id="main-nav" className={open ? "nav open" : "nav"} aria-label="Main">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} aria-current={current(section.href)}>{section.label}</Link>
          ))}
          <span className="divider" aria-hidden="true" />
          <Link href="/forum" aria-current={current("/forum")}>Forum</Link>
          {!me && (
            <div className="nav-auth">
              <Link className="btn" href="/login">Log in</Link>
              <Link className="btn btn-primary" href="/join">Join</Link>
            </div>
          )}
        </nav>
        <div className="header-actions">
          <ThemeToggle signedIn={Boolean(me)} />
          {me ? (
            <UserMenu me={me} />
          ) : (
            <>
              <Link className="btn btn-ghost hide-sm" href="/login">Log in</Link>
              <Link className="btn btn-primary hide-sm" href="/join">Join</Link>
            </>
          )}
          <button className="icon-btn menu-btn" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="main-nav" onClick={() => setOpen((value) => !value)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {open ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M3 7h18M3 17h18" />}
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
```

`frontend/src/components/Footer.tsx`:

```tsx
// Site footer with the independence statement required by the brand ban.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <nav aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/academic">Academic</Link>
          <Link href="/international">International</Link>
          <Link href="/community">Community</Link>
          <Link href="/personal">Personal</Link>
          <Link href="/forum">Forum</Link>
          <Link href="/ideas">Ideas</Link>
          <Link href="/events">Events</Link>
          <Link href="/request-campus">Add your university</Link>
        </nav>
        <p>ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Layout, temporary home, error pages**

`frontend/src/app/layout.tsx`:

```tsx
// Root layout: font, theme (profile for users, localStorage for guests), intro flag, header and footer.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { apiTry, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";
import "./tokens.css";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ModernSI", template: "%s · ModernSI" },
  description: "An independent international student network where student ideas become campus events.",
  icons: { icon: "/icon.svg" },
};

// Runs before paint: applies a guest's saved theme and flags a first visit in this session for the intro.
const bootScript = `(function(){var d=document.documentElement;try{if(!d.dataset.theme){var t=localStorage.getItem("msi_theme");if(t==="light"||t==="dark")d.dataset.theme=t}}catch(e){}try{if(sessionStorage.getItem("msi_intro_seen")!=="1")d.dataset.intro="1"}catch(e){d.dataset.intro="1"}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const profile = me ? await apiTry<Profile>("/api/profiles/me") : null;
  const theme = profile && profile.theme !== "system" ? profile.theme : undefined;
  return (
    <html lang="en" className={manrope.variable} data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>
        <Header me={me} />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

`frontend/src/app/page.tsx` (temporary, replaced in Task C6):

```tsx
// Homepage. Task C6 fills in the sections.
// This work made by Anfinogentov Nikita

export default function Home() {
  return (
    <section className="hero">
      <div className="wrap">
        <p className="eyebrow">An independent international student network</p>
        <h1>One hub. Every campus.</h1>
        <p className="lead">A digital ecosystem built around the student experience.</p>
      </div>
    </section>
  );
}
```

`frontend/src/app/not-found.tsx`:

```tsx
// 404 page.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap page-head">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The link may be old, or the page was removed.</p>
      <p><Link className="btn btn-primary" href="/">Back to the hub</Link></p>
    </div>
  );
}
```

`frontend/src/app/error.tsx`:

```tsx
// Error boundary for pages: a clear message and a retry button instead of a blank screen.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="wrap page-head">
      <p className="eyebrow">Something went wrong</p>
      <h1>This page could not load</h1>
      <p>The hub may be busy or briefly offline. Try again in a moment.</p>
      <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={() => retry()}>Try again</button>
        <Link className="btn" href="/">Back to the hub</Link>
      </p>
    </div>
  );
}
```

`frontend/src/app/global-error.tsx`:

```tsx
// Last-resort error page when the root layout itself fails; it carries its own minimal styles.
// This work made by Anfinogentov Nikita
"use client";

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0B0B0D", color: "#F4F2EE", fontFamily: "system-ui, sans-serif" }}>
        <title>ModernSI is unavailable</title>
        <div style={{ padding: 24, maxWidth: 480 }}>
          <h1>ModernSI is briefly unavailable</h1>
          <p style={{ color: "#A3A1AB" }}>Please try again in a minute.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "12px 20px", borderRadius: 999, border: 0, background: "#7C5CFF", color: "#0B0B0D", fontWeight: 700 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 7: Let the contrast check read the app's tokens**

In `design/mock/contrast.py`, replace the first line of `main()`:

```python
    css = Path(__file__).with_name("styles.css").read_text()
```

with

```python
    # an optional path lets me check the app's tokens.css with the same rules
    css = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).with_name("styles.css")).read_text()
```

Run: `python3 design/mock/contrast.py frontend/src/app/tokens.css`
Expected: `all pairs pass`.

- [ ] **Step 8: E2E harness**

`backend/tests/e2e_seed.py`:

```python
"""
Seeds the test stores for the Playwright run: wipes them, allows uni.edu, creates the staff accounts.
Never point this at real data: it truncates every table.
This work made by Anfinogentov Nikita
"""
import asyncio

import httpx
from sqlalchemy import text

from modernsi import models
from modernsi.auth.models import User
from modernsi.auth.passwords import hash_password
from modernsi.campuses.service import add_domain
from modernsi.core.config import get_settings
from modernsi.core.db import utcnow
from modernsi.core.stores import stores
from modernsi.feed.schema import CLICKHOUSE_TABLES, ensure_schema

staff = [
    ("gov@uni.edu", "Gov Member", "student_gov"),
    ("curator@uni.edu", "Campus Curator", "curator"),
    ("admin@uni.edu", "Hub Admin", "admin"),
]
password = "e2e password 123"


async def main():
    settings = get_settings()
    if "25432" not in settings.postgres_dsn:
        raise SystemExit("Ooops.. e2e_seed only runs against the test stores (port 25432)")
    hub = stores(settings)
    try:
        tables = ", ".join(table.name for table in models.Base.metadata.sorted_tables)
        async with hub.engine.begin() as conn:
            await conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
        await hub.redis.flushdb()
        await hub.mongo_client.drop_database(settings.mongo_db)
        client = await hub.get_clickhouse()
        await ensure_schema(client)
        for table in CLICKHOUSE_TABLES:
            await client.command(f"TRUNCATE TABLE IF EXISTS {table}")
        async with httpx.AsyncClient() as http:
            await http.delete("http://localhost:28025/api/v1/messages")
        async with hub.sessions() as db:
            domain = await add_domain(db, "uni.edu", "Almaty", "KZ")
            for email, name, role in staff:
                user = User(email=email, password_hash=hash_password(password), display_name=name, role=role, status="active", verified_at=utcnow())
                user.domain = domain
                db.add(user)
            await db.commit()
    finally:
        await hub.close()


asyncio.run(main())
```

`frontend/tests/e2e/start-backend.sh`:

```sh
#!/bin/sh
# Starts the API and the worker on the test stores for Playwright.
# Small thresholds (2 votes, team of 2) let one test walk an idea all the way to an event.
# This work made by Anfinogentov Nikita
set -e
cd "$(dirname "$0")/../../../backend"
export MSI_POSTGRES_DSN="postgresql+asyncpg://modernsi:modernsi@localhost:25432/modernsi"
export MSI_REDIS_URL="redis://localhost:26379/0"
export MSI_MONGO_URL="mongodb://localhost:27117"
export MSI_MONGO_DB="modernsi_e2e"
export MSI_CLICKHOUSE_PORT=28123
export MSI_SMTP_PORT=21025
export MSI_SITE_URL="http://localhost:3100"
export MSI_ALLOWED_ORIGINS='["http://localhost:3100"]'
export MSI_TRUST_FORWARDED_FOR=true
export MSI_VOTE_THRESHOLD=2
export MSI_TEAM_MIN=2
export MSI_STATS_MIN_STUDENTS=1
export MSI_RL_REGISTER_PER_HOUR=1000
export MSI_RL_LOGIN_PER_15MIN=1000
export MSI_RL_IDEAS_PER_DAY=1000
uv run alembic upgrade head
uv run python -m tests.e2e_seed
uv run modernsi worker &
worker=$!
trap 'kill $worker 2>/dev/null' EXIT INT TERM
uv run uvicorn modernsi.app:create_app --factory --port 8100
```

`frontend/playwright.config.ts`:

```ts
// End-to-end tests against the real backend and worker on the test stores (infra/docker-compose.test.yml).
// Do not run at the same time as backend pytest: both use the same test stores.
// This work made by Anfinogentov Nikita
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "sh tests/e2e/start-backend.sh", url: "http://localhost:8100/api/health", timeout: 180_000, reuseExistingServer: false },
    { command: "npm run build && npm run start -- --port 3100", url: "http://localhost:3100", timeout: 300_000, reuseExistingServer: false, env: { API_URL: "http://localhost:8100" } },
  ],
});
```

`frontend/tests/e2e/helpers.ts`:

```ts
// Shared e2e helpers: unique accounts, codes from Mailpit, signing in through the UI or the API.
// This work made by Anfinogentov Nikita
import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const BASE = "http://localhost:3100";
export const MAILPIT = "http://localhost:28025";
export const PASSWORD = "correct horse battery";
export const STAFF = { gov: "gov@uni.edu", curator: "curator@uni.edu", admin: "admin@uni.edu", password: "e2e password 123" };

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@uni.edu`;
}

export async function codeFor(email: string, subjectPart = "code"): Promise<string> {
  const mail = await request.newContext({ baseURL: MAILPIT });
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      const list = await (await mail.get("/api/v1/messages")).json();
      const message = list.messages.find(
        (item: { To: { Address: string }[]; Subject: string }) =>
          item.To.some((to) => to.Address === email) && item.Subject.includes(subjectPart),
      );
      if (message) return message.Subject.match(/\b(\d{6})\b/)[1];
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } finally {
    await mail.dispose();
  }
  throw new Error(`no ${subjectPart} mail for ${email}`);
}

export async function skipIntro(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("msi_intro_seen", "1");
    } catch {
      // ignore
    }
  });
}

export async function signUpInBrowser(page: Page, email: string, name: string) {
  await page.goto("/join");
  await page.getByLabel("University e-mail").fill(email);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify/);
  await page.getByLabel("Confirmation code").fill(await codeFor(email));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/personal/);
}

export async function loginInBrowser(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// A confirmed student driven through the API (other voters, team members).
export async function apiUser(name: string): Promise<{ context: APIRequestContext; email: string }> {
  const email = uniqueEmail(name.toLowerCase().replace(/\s+/g, "-"));
  const context = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const registered = await context.post("/api/auth/register", { data: { email, password: PASSWORD, display_name: name } });
  expect(registered.status()).toBe(201);
  const verified = await context.post("/api/auth/verify", { data: { code: await codeFor(email) } });
  expect(verified.status()).toBe(200);
  return { context, email };
}

// Staff accounts from e2e_seed, logged in through the API.
export async function apiLogin(email: string, password: string): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const response = await context.post("/api/auth/login", { data: { email, password } });
  expect(response.status()).toBe(200);
  return context;
}
```

`frontend/tests/e2e/shell.spec.ts`:

```ts
// Site shell: header order, footer statement, 404 page.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { skipIntro } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("header shows the four directions, then Forum", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  // the mobile-only Log in / Join links inside the nav are display:none on desktop, so they are not in this list
  await expect(nav.getByRole("link")).toHaveText(["Academic", "International", "Community", "Personal", "Forum"]);
  await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
});

test("footer carries the independence statement", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText(
    "ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.",
  );
});

test("unknown pages show a 404 with a way back", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the hub" }).click();
  await expect(page).toHaveURL("/");
});
```

- [ ] **Step 9: Type-check, build, run the shell tests**

Run:
```bash
cd frontend && npx tsc --noEmit && npm run build
docker compose -f ../infra/docker-compose.test.yml up -d --wait
npx playwright test shell.spec.ts
```
Expected:
- `tsc` prints nothing;
- the build finishes with `✓ Compiled successfully`;
- the 3 shell tests pass.


- [ ] **Step 10: Commit**

```bash
git add frontend backend/tests/e2e_seed.py design/mock/contrast.py
git commit -m "Scaffold Next.js frontend: tokens, API clients, header, footer, error pages, e2e harness"
```

---

### Task C2: Intro overlay

**Files:**
- Create: `frontend/src/components/intro/engine.js` (copy of `design/mock/intro.js`), `frontend/src/components/intro/IntroOverlay.tsx`
- Modify: `frontend/src/app/layout.tsx` (render `<IntroOverlay />` first in `<body>`)
- Test: `frontend/tests/e2e/intro.spec.ts`

**Interfaces:**
- Consumes: `playIntro({ overlay, gsap, reducedMotion, onDone })` → `{ skip() }` from Plan A; `html[data-intro="1"]` set by the boot script.
- Produces: `<IntroOverlay />`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/intro.spec.ts`:

```ts
// Intro: plays on the first visit of a session, ends by itself in ~6 s, can be skipped, respects reduced motion.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";

test("plays once per session and ends by itself", async ({ page }) => {
  await page.goto("/");
  const overlay = page.locator(".intro");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("[data-intro-word]")).toHaveText("ModernSI");
  await expect(page.getByRole("heading", { name: "One hub. Every campus." })).toBeAttached();
  await expect(overlay).toHaveCount(0, { timeout: 9_000 });
  expect(await page.evaluate(() => document.body.classList.contains("intro-lock"))).toBe(false);
  await page.reload();
  await expect(page.locator(".intro")).toBeHidden();
});

test("Skip ends it at once", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.locator(".intro")).toHaveCount(0, { timeout: 2_000 });
});

test("Esc ends it", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".intro")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".intro")).toHaveCount(0, { timeout: 2_000 });
});

test("reduced motion gets a short fade", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".intro")).toHaveCount(0, { timeout: 2_000 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test intro.spec.ts`
Expected: FAIL — `.intro` not found.

- [ ] **Step 3: Implement**

Run: `cp design/mock/intro.js frontend/src/components/intro/engine.js` (from the repo root; create the folder first). Do not edit the copy — the audit in Task C8 checks it is byte-identical.

`frontend/src/components/intro/IntroOverlay.tsx`:

```tsx
// Intro overlay. The head script decides whether this visit gets the intro; here I only play it.
// The engine is the approved mock's intro.js, shared byte-for-byte.
// This work made by Anfinogentov Nikita
"use client";
import gsap from "gsap";
import { useEffect, useRef, useState } from "react";
import { playIntro } from "./engine.js";

export function IntroOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // React may run this effect twice in development; the intro must start only once
    if (started.current) return;
    started.current = true;
    const root = document.documentElement;
    const overlay = overlayRef.current;
    if (!overlay || root.dataset.intro !== "1") {
      setDone(true);
      return;
    }
    const skipButton = overlay.querySelector<HTMLButtonElement>("[data-intro-skip]");
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.classList.add("intro-lock");
    skipButton?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        skipButton?.focus();
      }
      if (event.key === "Escape") intro.skip();
    };
    const onClick = () => intro.skip();

    const intro = playIntro({
      overlay,
      gsap,
      reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
      onDone() {
        try {
          sessionStorage.setItem("msi_intro_seen", "1");
        } catch {
          // storage blocked: the intro plays again on the next visit
        }
        delete root.dataset.intro;
        document.body.classList.remove("intro-lock");
        document.removeEventListener("keydown", onKey);
        overlay.removeEventListener("click", onClick);
        setDone(true);
        previousFocus?.focus?.();
      },
    });
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", onClick);
  }, []);

  if (done) return null;
  return (
    <div className="intro" ref={overlayRef} role="dialog" aria-label="ModernSI intro">
      <canvas aria-hidden="true" />
      <div className="intro-word" data-intro-word>ModernSI</div>
      <div className="intro-dot" data-intro-dot aria-hidden="true" />
      <div className="intro-welcome" data-intro-welcome>Welcome!</div>
      <button className="intro-skip" type="button" data-intro-skip>Skip intro</button>
    </div>
  );
}
```

`frontend/src/components/intro/engine.d.ts` (types for the shared JS engine):

```ts
// Types for the framework-free intro engine copied from the mock.
// This work made by Anfinogentov Nikita
import type gsapType from "gsap";

export const INTRO_TIMING: Record<string, number>;
export function playIntro(options: {
  overlay: HTMLElement;
  gsap: typeof gsapType;
  reducedMotion?: boolean;
  onDone: () => void;
}): { skip(): void };
```

In `frontend/src/app/layout.tsx` add `import { IntroOverlay } from "@/components/intro/IntroOverlay";` and make `<IntroOverlay />` the first child of `<body>`.

- [ ] **Step 4: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test intro.spec.ts shell.spec.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "Add the intro overlay with the shared mock engine"
```

---

### Task C3: Auth pages

**Files:**
- Create: `frontend/src/components/forms/useSubmit.ts`, `forms/Field.tsx`, `forms/FormError.tsx`
- Create: `frontend/src/components/auth/JoinForm.tsx`, `VerifyForm.tsx`, `LoginForm.tsx`, `ForgotForm.tsx`, `ResetForm.tsx`, `RequestCampusForm.tsx`
- Create: `frontend/src/app/join/page.tsx`, `verify/page.tsx`, `login/page.tsx`, `forgot/page.tsx`, `reset/page.tsx`, `request-campus/page.tsx`
- Modify: `frontend/src/lib/query.ts` (add `safeNext`), `frontend/src/app/globals.css` (append auth styles)
- Test: `frontend/tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes:
  - `api`, `ApiError`, `qs`, `firstParam`, `getMe` from C1;
  - API: `POST /api/auth/register {email, password, display_name}`, `POST /api/auth/verify {code}`, `POST /api/auth/verify/resend`, `POST /api/auth/login {email, password}` → `Me`, `POST /api/auth/password/forgot {email}`, `POST /api/auth/password/reset {email, code, password}`, `POST /api/campuses/requests {domain, university_name, requester_email}`;
  - error codes `domain_not_allowed`, `domain_already_allowed`, `invalid_credentials`, `validation_error` (with `fields[].field` = `email` / `display_name` / `password` / …).
- Produces:
  - `useSubmit()` → `{ pending, error, run(work), fieldError(name), setError }`; `run` ignores calls while one is in flight;
  - `<Field label error? hint? multiline? …inputProps />` — a labelled input or textarea;
  - `<FormError error />` — `role="alert"` notice, nothing when `error` is null;
  - `safeNext(next)` → a same-site path or `/personal`;
  - CSS: `auth`, `lead-sm`, `below`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/auth.spec.ts`:

```ts
// Sign-up, unknown universities, login, safe redirects and password reset, all through the UI.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiUser, codeFor, loginInBrowser, signUpInBrowser, skipIntro, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("an unknown university is sent to the campus request", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("University e-mail").fill("aru@far-away.edu");
  await page.getByLabel("Your name").fill("Aru");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Your university is not on ModernSI yet.")).toBeVisible();
  await page.getByRole("link", { name: "Ask us to add it" }).click();
  await expect(page).toHaveURL(/\/request-campus\?email=aru%40far-away\.edu/);
  await expect(page.getByLabel("Your university e-mail")).toHaveValue("aru@far-away.edu");
  await expect(page.getByLabel("E-mail domain")).toHaveValue("far-away.edu");
  await page.getByLabel("University name").fill("Far Away University");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("Thanks! We will write to aru@far-away.edu as soon as far-away.edu is on the network.")).toBeVisible();
});

test("sign up, log out and log back in", async ({ page }) => {
  const email = uniqueEmail("dana");
  await signUpInBrowser(page, email, "Dana");
  await page.getByRole("button", { name: "Dana" }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
  await loginInBrowser(page, email, PASSWORD);
  await expect(page).toHaveURL(`${BASE}/personal`);
  await expect(page.getByRole("button", { name: "Dana" })).toBeVisible();
});

test("a wrong password shows the API's message and stays on the page", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(STAFF.gov);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Wrong e-mail or password")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("next= is followed only for paths on this site", async ({ page }) => {
  for (const next of ["//evil.example", "https://evil.example/steal", "/\\evil.example"]) {
    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("E-mail").fill(STAFF.curator);
    await page.getByLabel("Password").fill(STAFF.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(`${BASE}/personal`);
  }
  await page.context().clearCookies();
  await page.goto(`/login?next=${encodeURIComponent("/ideas?sort=trending")}`);
  await page.getByLabel("E-mail").fill(STAFF.curator);
  await page.getByLabel("Password").fill(STAFF.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas?sort=trending`);
});

test("a forgotten password is reset with a code from the e-mail", async ({ page }) => {
  const { context, email } = await apiUser("Reset Me");
  await context.dispose();
  await page.goto("/forgot");
  await page.getByLabel("E-mail").fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
  await page.getByRole("link", { name: "Enter the code" }).click();
  await expect(page.getByLabel("E-mail")).toHaveValue(email);
  await page.getByLabel("Reset code").fill(await codeFor(email, "Reset"));
  await page.getByLabel("New password").fill("a brand new password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1/);
  await expect(page.getByText("Your password is changed. Log in with the new one.")).toBeVisible();
  await loginInBrowser(page, email, "a brand new password");
});

test("signed-in visitors skip the join page", async ({ page }) => {
  await loginInBrowser(page, STAFF.curator, STAFF.password);
  await page.goto("/join");
  await expect(page).toHaveURL(`${BASE}/personal`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test auth.spec.ts`
Expected: FAIL — `/join` is a 404, the label "University e-mail" is not found.

- [ ] **Step 3: Form helpers**

Append to `frontend/src/lib/query.ts`:

```ts

// Where to go after login. Only same-site paths: "//host", "/\host" and absolute URLs would send people off the site.
export function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/personal";
  return next;
}
```

`frontend/src/components/forms/useSubmit.ts`:

```ts
// Form submission state: one request at a time, the API's message and per-field errors.
// This work made by Anfinogentov Nikita
"use client";
import { useRef, useState } from "react";
import { ApiError } from "@/lib/errors";

export function useSubmit() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function run(work: () => Promise<void>) {
    // a second click while the first request is in flight is ignored, so nothing is sent twice
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, "unknown", "Something went wrong. Please try again."));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function fieldError(name: string): string | undefined {
    return error?.fields.find((item) => item.field === name)?.message;
  }

  return { pending, error, run, fieldError, setError };
}
```

`frontend/src/components/forms/Field.tsx`:

```tsx
// A labelled input or textarea with an optional hint and the API's error for this field.
// This work made by Anfinogentov Nikita
"use client";
import { useId } from "react";

type Common = { label: string; error?: string; hint?: string };
type InputProps = Common & { multiline?: false } & React.InputHTMLAttributes<HTMLInputElement>;
type AreaProps = Common & { multiline: true } & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field(props: InputProps | AreaProps) {
  const id = useId();
  const { label, error, hint, multiline, ...rest } = props;
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  const shared = { id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea className="textarea" {...shared} {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input className="input" {...shared} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  );
}
```

`frontend/src/components/forms/FormError.tsx`:

```tsx
// The form-level error notice. Field errors are shown next to their fields as well.
// This work made by Anfinogentov Nikita
import type { ApiError } from "@/lib/errors";

export function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <div className="notice notice-error" role="alert">
      {error.fields.length ? "Some fields need fixing — see the notes below them." : error.message}
    </div>
  );
}
```

Append to `frontend/src/app/globals.css`:

```css

/* auth pages */
.auth { padding: clamp(40px, 7vw, 80px) 0; }
.auth h1 { font-size: clamp(32px, 5vw, 48px); font-weight: 800; letter-spacing: -0.03em; }
.lead-sm { color: var(--muted); margin: 12px 0 28px; max-width: 52ch; }
.below { margin-top: 24px; color: var(--muted); }
.form .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.link-button { background: none; border: 0; padding: 0; font: inherit; color: var(--accent-text); font-weight: 700; cursor: pointer; }
.link-button:hover { text-decoration: underline; }
```

- [ ] **Step 4: Auth forms**

`frontend/src/components/auth/JoinForm.tsx`:

```tsx
// Sign-up form. An unknown university domain leads to the campus request instead of a dead end.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { qs } from "@/lib/query";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function JoinForm() {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/register", { method: "POST", json: { email, display_name: name, password } });
      router.push("/verify");
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {error?.code === "domain_not_allowed" ? (
        <div className="notice notice-error" role="alert">
          <p style={{ margin: "0 0 8px" }}>Your university is not on ModernSI yet.</p>
          <Link href={`/request-campus${qs({ email: email.trim() })}`}>Ask us to add it</Link>
        </div>
      ) : (
        <FormError error={error} />
      )}
      <Field label="University e-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Your name" autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} error={fieldError("display_name")} />
      <Field label="Password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/auth/VerifyForm.tsx`:

```tsx
// E-mail confirmation: the 6-digit code, plus a way to get a new one.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function VerifyForm({ email }: { email: string }) {
  const router = useRouter();
  const confirm = useSubmit();
  const resend = useSubmit();
  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    confirm.run(async () => {
      await api("/api/auth/verify", { method: "POST", json: { code: code.trim() } });
      router.push("/personal");
      router.refresh();
    });
  }

  function onResend() {
    setResent(false);
    resend.run(async () => {
      await api("/api/auth/verify/resend", { method: "POST" });
      setResent(true);
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={confirm.error ?? resend.error} />
      {resent && <div className="notice" role="status">We sent a new code to {email}.</div>}
      <Field label="Confirmation code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} error={confirm.fieldError("code")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={confirm.pending}>{confirm.pending ? "Checking…" : "Confirm"}</button>
        <button className="link-button" type="button" onClick={onResend} disabled={resend.pending}>Send a new code</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/auth/LoginForm.tsx`:

```tsx
// Login form. Unconfirmed accounts go to the code page; everyone else to a safe "next" path.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { safeNext } from "@/lib/query";
import type { Me } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function LoginForm({ next, reset }: { next?: string; reset: boolean }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const me = await api<Me>("/api/auth/login", { method: "POST", json: { email, password } });
      router.push(me.status === "pending" ? "/verify" : safeNext(next));
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {reset && !error && <div className="notice" role="status">Your password is changed. Log in with the new one.</div>}
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Logging in…" : "Log in"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/auth/ForgotForm.tsx`:

```tsx
// Asks for a password reset code. The answer is the same whether or not the address has an account.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { qs } from "@/lib/query";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function ForgotForm() {
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/password/forgot", { method: "POST", json: { email } });
      setSentTo(email.trim());
    });
  }

  if (sentTo) {
    return (
      <div className="notice" role="status">
        <p style={{ margin: "0 0 8px" }}>If {sentTo} has an account, a reset code is on its way. It works for 15 minutes.</p>
        <Link href={`/reset${qs({ email: sentTo })}`}>Enter the code</Link>
      </div>
    );
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send reset code"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/auth/ResetForm.tsx`:

```tsx
// Sets a new password with the code from the e-mail, then sends the person to log in.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function ResetForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/auth/password/reset", { method: "POST", json: { email, code: code.trim(), password } });
      router.push("/login?reset=1");
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} error={fieldError("email")} />
      <Field label="Reset code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} error={fieldError("code")} />
      <Field label="New password" type="password" autoComplete="new-password" required minLength={10} hint="At least 10 characters." value={password} onChange={(event) => setPassword(event.target.value)} error={fieldError("password")} />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Set new password"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/auth/RequestCampusForm.tsx`:

```tsx
// Asks the admins to add a university. The domain is filled in from the e-mail until the person edits it.
// This work made by Anfinogentov Nikita
"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
}

export function RequestCampusForm({ initialEmail }: { initialEmail: string }) {
  const { pending, error, run, fieldError } = useSubmit();
  const [email, setEmail] = useState(initialEmail);
  const [university, setUniversity] = useState("");
  const [domain, setDomain] = useState(domainOf(initialEmail));
  const [domainEdited, setDomainEdited] = useState(false);
  const [sent, setSent] = useState<{ email: string; domain: string } | null>(null);

  function onEmail(value: string) {
    setEmail(value);
    if (!domainEdited) setDomain(domainOf(value));
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api("/api/campuses/requests", { method: "POST", json: { domain, university_name: university, requester_email: email } });
      setSent({ email: email.trim(), domain: domain.trim().toLowerCase() });
    });
  }

  if (sent) {
    return <div className="notice" role="status">Thanks! We will write to {sent.email} as soon as {sent.domain} is on the network.</div>;
  }
  return (
    <form className="form" onSubmit={onSubmit}>
      {error?.code === "domain_already_allowed" ? (
        <div className="notice" role="status">
          <p style={{ margin: "0 0 8px" }}>Good news: {domain} is already on the network.</p>
          <Link href="/join">Create your account</Link>
        </div>
      ) : (
        <FormError error={error} />
      )}
      <Field label="Your university e-mail" type="email" autoComplete="email" required value={email} onChange={(event) => onEmail(event.target.value)} error={fieldError("requester_email")} />
      <Field label="University name" required minLength={2} maxLength={160} value={university} onChange={(event) => setUniversity(event.target.value)} error={fieldError("university_name")} />
      <Field
        label="E-mail domain" required hint="The part after @ in student addresses, for example uni.edu." value={domain}
        onChange={(event) => { setDomainEdited(true); setDomain(event.target.value); }} error={fieldError("domain")}
      />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Auth pages**

`frontend/src/app/join/page.tsx`:

```tsx
// Sign-up page. Signed-in visitors are sent on.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/auth/JoinForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Join" };

export default async function JoinPage() {
  const me = await getMe();
  if (me) redirect(me.status === "pending" ? "/verify" : "/personal");
  return (
    <div className="wrap auth">
      <p className="eyebrow">Join the network</p>
      <h1>Create your account</h1>
      <p className="lead-sm">Sign up with your university e-mail. Anyone can read ModernSI; members propose ideas, vote and join teams.</p>
      <JoinForm />
      <p className="below">Already a member? <Link href="/login">Log in</Link></p>
    </div>
  );
}
```

`frontend/src/app/verify/page.tsx`:

```tsx
// E-mail confirmation page for accounts that are signed in but not confirmed yet.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/auth/VerifyForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Confirm your e-mail" };

export default async function VerifyPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/verify");
  if (me.status !== "pending") redirect("/personal");
  return (
    <div className="wrap auth">
      <p className="eyebrow">One more step</p>
      <h1>Confirm your e-mail</h1>
      <p className="lead-sm">We sent a 6-digit code to {me.email}. It works for 15 minutes.</p>
      <VerifyForm email={me.email} />
    </div>
  );
}
```

`frontend/src/app/login/page.tsx`:

```tsx
// Login page. ?next= brings people back where they were; ?reset=1 confirms a password change.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { firstParam, safeNext } from "@/lib/query";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Log in" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = firstParam(params.next);
  const me = await getMe();
  if (me) redirect(me.status === "pending" ? "/verify" : safeNext(next));
  return (
    <div className="wrap auth">
      <p className="eyebrow">Welcome back</p>
      <h1>Log in</h1>
      <p className="lead-sm">Use the university e-mail you signed up with.</p>
      <LoginForm next={next} reset={firstParam(params.reset) === "1"} />
      <p className="below">
        <Link href="/forgot">Forgot your password?</Link> · New here? <Link href="/join">Create an account</Link>
      </p>
    </div>
  );
}
```

`frontend/src/app/forgot/page.tsx`:

```tsx
// Password reset, step one: ask for a code.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/ForgotForm";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPage() {
  return (
    <div className="wrap auth">
      <p className="eyebrow">Password</p>
      <h1>Reset your password</h1>
      <p className="lead-sm">Enter your e-mail and we will send a 6-digit reset code.</p>
      <ForgotForm />
      <p className="below">Remembered it? <Link href="/login">Log in</Link></p>
    </div>
  );
}
```

`frontend/src/app/reset/page.tsx`:

```tsx
// Password reset, step two: the code and a new password.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/ResetForm";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Set a new password" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ResetPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="wrap auth">
      <p className="eyebrow">Password</p>
      <h1>Set a new password</h1>
      <p className="lead-sm">Enter the code from the e-mail and choose a new password. Every device will be logged out.</p>
      <ResetForm initialEmail={firstParam(params.email) ?? ""} />
      <p className="below">No code yet? <Link href="/forgot">Send one</Link></p>
    </div>
  );
}
```

`frontend/src/app/request-campus/page.tsx`:

```tsx
// Request to add a university to the network.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { RequestCampusForm } from "@/components/auth/RequestCampusForm";
import { firstParam } from "@/lib/query";

export const metadata: Metadata = { title: "Add your university" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function RequestCampusPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <div className="wrap auth">
      <p className="eyebrow">Campus network</p>
      <h1>Add your university</h1>
      <p className="lead-sm">
        ModernSI opens sign-up university by university. Tell us where you study; once the admins add your e-mail domain,
        we will write to you and you can join.
      </p>
      <RequestCampusForm initialEmail={firstParam(params.email) ?? ""} />
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test auth.spec.ts shell.spec.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "Add sign-up, confirmation, login, password reset and campus request pages"
```

---

### Task C4: Ideas — list, proposal form, idea page, voting, review, team

**Files:**
- Create: `frontend/src/components/Progress.tsx`, `IdeaCard.tsx`, `IdeaList.tsx`
- Create: `frontend/src/components/ideas/IdeaForm.tsx`, `VoteButton.tsx`, `TeamButton.tsx`, `DecisionForm.tsx`, `ResubmitButton.tsx`, `ReportButton.tsx`
- Create: `frontend/src/app/ideas/page.tsx`, `ideas/new/page.tsx`, `ideas/[id]/page.tsx`, `ideas/[id]/edit/page.tsx`, `review/page.tsx`
- Modify: `frontend/src/lib/server-api.ts` (add `apiFind`), `frontend/src/lib/query.ts` (add `isUuid`), `frontend/src/app/globals.css` (append)
- Test: `frontend/tests/e2e/ideas.spec.ts`

**Interfaces:**
- Consumes:
  - C1: `apiGet`, `apiTry`, `getMe`, `api`, `qs`, `firstParam`, `categoryLabels`, `statusLabels`, `roleLabels`, `scopeText`, `LocalTime`, types `IdeaCard`, `IdeaDetail`, `Page`, `EventItem`, `Me`;
  - C3: `useSubmit`, `Field`, `FormError`;
  - API:
    - `GET /api/ideas?sort=new|trending|closest&category=&status=&mine=&cursor=&limit=` → `Page<IdeaCard>`; a bad cursor is `422 bad_cursor`;
    - `POST /api/ideas {title, summary, body_md, category, scope}` → `IdeaDetail`; `PATCH /api/ideas/{id}` (same fields, all optional; changing category while `open` is `409 category_locked`);
    - `GET /api/ideas/{id}` → `IdeaDetail` or `404 idea_not_found`;
    - `POST|DELETE /api/ideas/{id}/vote` → `{vote_count, status, my_vote}`;
    - `POST /api/ideas/{id}/decision {decision: "approve"|"reject"|"needs_changes", note}` → `IdeaDetail` (`note` required unless approving: `422 note_required`);
    - `POST /api/ideas/{id}/resubmit` → `IdeaDetail`;
    - `POST|DELETE /api/ideas/{id}/team` → `{team_size, in_team, status}`;
    - `POST /api/ideas/{id}/report {reason}` → `{}` or `409 already_reported`;
    - `GET /api/events?idea={id}&when=upcoming|past` → `Page<EventItem>`.
- Produces:
  - `apiFind<T>(path)` → `T | null` (null only on 404, other failures throw to `error.tsx`);
  - `isUuid(value)`;
  - `<Progress value max label />`, `<IdeaCard idea />`, `<IdeaList ideas empty />`, `supportText(idea)`;
  - routes `/ideas`, `/ideas/new`, `/ideas/[id]`, `/ideas/[id]/edit`, `/review`;
  - the idea page links to `/events/new?idea={id}` ("Put it on the Hub"), built in C5.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/ideas.spec.ts`:

```ts
// The idea path in the browser: propose, collect support, review by Student Government, gather a team.
// Thresholds are lowered for e2e (2 votes, team of 2) in start-backend.sh.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiUser, loginInBrowser, signUpInBrowser, skipIntro, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("an idea goes from proposal to review to a full team", async ({ page, browser }) => {
  const title = `Food Festival ${Date.now() % 100000}`;
  await signUpInBrowser(page, uniqueEmail("author"), "Aru Author");
  await page.goto("/ideas/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Short summary").fill("One evening, one table per country, a dish from home and its story.");
  await page.getByLabel("Category").selectOption("event");
  await page.getByLabel("Whole network").check();
  await page.getByLabel("Details").fill("We need **tables** and a room.");
  await page.getByRole("button", { name: "Publish idea" }).click();
  await expect(page).toHaveURL(/\/ideas\/[0-9a-f-]{36}$/);
  const ideaUrl = page.url();
  const ideaId = ideaUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".prose strong")).toHaveText("tables");
  await expect(page.getByText("0 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Support this idea" })).toHaveCount(0);

  // a second student supports it in their own browser; a double click must count once
  const voterContext = await browser.newContext();
  const voterPage = await voterContext.newPage();
  await skipIntro(voterPage);
  await signUpInBrowser(voterPage, uniqueEmail("voter"), "Vera Voter");
  await voterPage.goto(ideaUrl);
  await voterPage.getByRole("button", { name: "Support this idea" }).dblclick();
  await expect(voterPage.getByRole("button", { name: "Withdraw support" })).toBeVisible();
  await expect(voterPage.getByText("1 of 2")).toBeVisible();

  // the second vote comes through the API and sends the idea to review
  const third = await apiUser("Third Voter");
  expect((await third.context.post(`/api/ideas/${ideaId}/vote`)).status()).toBe(200);
  await third.context.dispose();
  await page.reload();
  await expect(page.getByText("Student Government is reviewing this idea.")).toBeVisible();

  // Student Government approves in its own browser
  const govContext = await browser.newContext();
  const govPage = await govContext.newPage();
  await skipIntro(govPage);
  await loginInBrowser(govPage, STAFF.gov, STAFF.password);
  await govPage.goto("/review");
  await govPage.getByRole("link", { name: title }).click();
  await govPage.getByLabel("Note for the author").fill("Great idea, go ahead.");
  await govPage.getByRole("button", { name: "Approve" }).click();
  await expect(govPage.locator(".badge-accent")).toHaveText("Gathering a team");

  // the voter joins the team, again with a double click
  await voterPage.reload();
  await voterPage.getByRole("button", { name: "Join the team" }).dblclick();
  await expect(voterPage.getByRole("button", { name: "Leave the team" })).toBeVisible();
  await expect(voterPage.getByText("2 of 2 people in the team")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Put it on the Hub" })).toHaveAttribute("href", `/events/new?idea=${ideaId}`);
  await expect(page.getByRole("list", { name: "Team" }).getByRole("link", { name: "Vera Voter" })).toBeVisible();
  await voterContext.close();
  await govContext.close();
});

test("asking for changes, editing and sending back to review", async ({ page, browser }) => {
  const author = await apiUser("Edit Author");
  const created = await author.context.post("/api/ideas", {
    data: { title: "Late library hours", summary: "Keep the library open until midnight in exam weeks.", category: "campus_life", scope: "campus" },
  });
  const ideaId = (await created.json()).id;
  for (const name of ["Edit Voter One", "Edit Voter Two"]) {
    const voter = await apiUser(name);
    await voter.context.post(`/api/ideas/${ideaId}/vote`);
    await voter.context.dispose();
  }
  const govContext = await browser.newContext();
  const govPage = await govContext.newPage();
  await skipIntro(govPage);
  await loginInBrowser(govPage, STAFF.gov, STAFF.password);
  await govPage.goto(`/ideas/${ideaId}`);
  await govPage.getByRole("button", { name: "Ask for changes" }).click();
  await expect(govPage.getByText("Write a note so the author knows what to change.")).toBeVisible();
  await govPage.getByLabel("Note for the author").fill("Say which weeks exactly.");
  await govPage.getByRole("button", { name: "Ask for changes" }).click();
  await expect(govPage.locator(".badge-accent")).toHaveText("Needs changes");
  await govContext.close();

  await loginInBrowser(page, author.email, PASSWORD);
  await author.context.dispose();
  await page.goto(`/ideas/${ideaId}`);
  await expect(page.getByText("Say which weeks exactly.")).toBeVisible();
  await page.getByRole("link", { name: "Edit idea" }).click();
  await page.getByLabel("Short summary").fill("Keep the library open until midnight in the two weeks before exams.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas/${ideaId}`);
  await page.getByRole("button", { name: "Send back to review" }).click();
  await expect(page.getByText("Student Government is reviewing this idea.")).toBeVisible();
});

test("guests read ideas and are asked to log in to support", async ({ page }) => {
  const author = await apiUser("Guest Check");
  const created = await author.context.post("/api/ideas", {
    data: { title: "Board games and tea", summary: "A quiet evening of board games in the student lounge.", category: "club", scope: "network" },
  });
  const ideaId = (await created.json()).id;
  await author.context.dispose();
  await page.goto("/ideas?sort=new");
  await page.getByRole("link", { name: /Board games and tea/ }).first().click();
  await expect(page).toHaveURL(`${BASE}/ideas/${ideaId}`);
  await page.getByRole("link", { name: "Log in to support it" }).click();
  await expect(page).toHaveURL(`${BASE}/login?next=%2Fideas%2F${ideaId}`);
});

test("broken idea links and page cursors do not crash", async ({ page }) => {
  expect((await page.goto("/ideas/not-a-uuid"))?.status()).toBe(404);
  expect((await page.goto("/ideas/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
  await page.goto("/ideas?cursor=abc&sort=trending");
  await expect(page).toHaveURL(`${BASE}/ideas?sort=trending`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test ideas.spec.ts`
Expected: FAIL — `/ideas/new` is a 404.

- [ ] **Step 3: Server helpers and styles**

Append to `frontend/src/lib/server-api.ts`:

```ts

// For a page's main record: a missing record becomes the 404 page, any other failure the error page.
export async function apiFind<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
```

Append to `frontend/src/lib/query.ts`:

```ts

// Route ids are UUIDs; anything else is a 404 before the API is even asked.
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
```

Append to `frontend/src/app/globals.css`:

```css

/* idea page */
.detail { padding-bottom: clamp(48px, 8vw, 96px); }
.detail .badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.byline { color: var(--muted); font-size: 14px; margin-top: 24px; }
.aside h2 { font-size: 20px; }
.aside .count b { color: var(--fg); }
.note { border-left: 3px solid var(--accent-text); padding: 8px 0 8px 14px; margin: 0; }
.select { appearance: auto; }
.pager { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 24px; }
```

- [ ] **Step 4: Idea display components**

`frontend/src/components/Progress.tsx`:

```tsx
// Progress bar towards a goal (votes to review, people to a full team).
// This work made by Anfinogentov Nikita

export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} aria-label={label}>
      <i style={{ width: `${percent}%` }} />
    </div>
  );
}
```

`frontend/src/components/IdeaCard.tsx`:

```tsx
// Idea card for lists: category, status, progress and author.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { categoryLabels, scopeText, statusLabels } from "@/lib/format";
import type { IdeaCard as IdeaCardData } from "@/lib/types";
import { Progress } from "./Progress";

export function supportText(idea: IdeaCardData): string {
  if (idea.status === "open") return `${idea.vote_count} of ${idea.vote_threshold} votes`;
  if (idea.status === "forming_team") return `Team ${idea.team_size} of ${idea.team_min}`;
  return `${idea.vote_count} ${idea.vote_count === 1 ? "supporter" : "supporters"}`;
}

export function IdeaCard({ idea }: { idea: IdeaCardData }) {
  return (
    <Link className="card idea-card" href={`/ideas/${idea.id}`}>
      <span className="badge">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>{" "}
      <span className="badge badge-accent">{statusLabels[idea.status]}</span>
      <h3>{idea.title}</h3>
      <p>{idea.summary}</p>
      {idea.status === "open" && <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />}
      <div className="meta">
        <span>{idea.author.display_name}{idea.author.campus_label ? ` · ${idea.author.campus_label}` : ""}</span>
        <span>{supportText(idea)}</span>
      </div>
    </Link>
  );
}
```

`frontend/src/components/IdeaList.tsx`:

```tsx
// A grid of idea cards with its own empty state.
// This work made by Anfinogentov Nikita
import type { IdeaCard as IdeaCardData } from "@/lib/types";
import { IdeaCard } from "./IdeaCard";

export function IdeaList({ ideas, empty }: { ideas: IdeaCardData[]; empty: React.ReactNode }) {
  if (!ideas.length) return <div className="empty">{empty}</div>;
  return (
    <div className="cards">
      {ideas.map((idea) => <IdeaCard key={idea.id} idea={idea} />)}
    </div>
  );
}
```

- [ ] **Step 5: Idea action components**

`frontend/src/components/ideas/IdeaForm.tsx`:

```tsx
// Propose or edit an idea. While an idea collects votes its category is fixed, so the select is locked.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api } from "@/lib/client-api";
import { categoryLabels } from "@/lib/format";
import type { Category, IdeaDetail, Scope } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

export function IdeaForm({ idea, campus }: { idea?: IdeaDetail; campus: string | null }) {
  const router = useRouter();
  const id = useId();
  const { pending, error, run, fieldError } = useSubmit();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [summary, setSummary] = useState(idea?.summary ?? "");
  const [category, setCategory] = useState<Category | "">(idea?.category ?? "");
  const [scope, setScope] = useState<Scope>(idea?.scope ?? "network");
  const [body, setBody] = useState(idea?.body_md ?? "");
  const categoryLocked = idea?.status === "open";

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const json = { title, summary, body_md: body, scope, ...(categoryLocked ? {} : { category }) };
      const saved = idea
        ? await api<IdeaDetail>(`/api/ideas/${idea.id}`, { method: "PATCH", json })
        : await api<IdeaDetail>("/api/ideas", { method: "POST", json });
      router.push(`/ideas/${saved.id}`);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="Title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} error={fieldError("title")} />
      <Field
        label="Short summary" multiline rows={3} required minLength={10} maxLength={280} hint="One or two sentences. This is what people see in lists."
        value={summary} onChange={(event) => setSummary(event.target.value)} error={fieldError("summary")}
      />
      <div className="field">
        <label htmlFor={`${id}-category`}>Category</label>
        <select
          id={`${id}-category`} className="select" required disabled={categoryLocked} value={category}
          onChange={(event) => setCategory(event.target.value as Category)} aria-describedby={categoryLocked ? `${id}-locked` : undefined}
        >
          <option value="" disabled>Choose a category</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {categoryLocked && <p id={`${id}-locked`} className="hint">The category stays fixed while the idea collects support.</p>}
        {fieldError("category") && <p className="field-error">{fieldError("category")}</p>}
      </div>
      <div className="field">
        <fieldset>
          <legend>Who is it for</legend>
          <label className="radio"><input type="radio" name="scope" value="network" checked={scope === "network"} onChange={() => setScope("network")} /> Whole network</label>
          <label className="radio"><input type="radio" name="scope" value="campus" checked={scope === "campus"} onChange={() => setScope("campus")} /> My campus{campus ? ` (${campus})` : ""}</label>
        </fieldset>
      </div>
      <Field
        label="Details" multiline rows={8} maxLength={10000} hint="Optional. Markdown works: **bold**, lists, links."
        value={body} onChange={(event) => setBody(event.target.value)} error={fieldError("body_md")}
      />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : idea ? "Save changes" : "Publish idea"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/ideas/VoteButton.tsx`:

```tsx
// Support / withdraw support, with the live count. The API's answer is the source of truth for the count.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { IdeaStatus } from "@/lib/types";
import { Progress } from "../Progress";
import { useSubmit } from "../forms/useSubmit";

type VoteResult = { vote_count: number; status: IdeaStatus; my_vote: boolean };

export function VoteButton({ ideaId, voted, count, threshold }: { ideaId: string; voted: boolean; count: number; threshold: number }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ voted, count });

  function toggle() {
    run(async () => {
      const result = await api<VoteResult>(`/api/ideas/${ideaId}/vote`, { method: state.voted ? "DELETE" : "POST" });
      setState({ voted: result.my_vote, count: result.vote_count });
      // reaching the threshold moves the idea to review; the rest of the page has to follow
      if (result.status !== "open") router.refresh();
    });
  }

  return (
    <div className="stack">
      <Progress value={state.count} max={threshold} label="Support" />
      <p className="count muted"><b>{state.count} of {threshold}</b> students support this idea</p>
      <button className={state.voted ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
        {state.voted ? "Withdraw support" : "Support this idea"}
      </button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

`frontend/src/components/ideas/TeamButton.tsx`:

```tsx
// Join / leave the team of an approved idea, with the live team size.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Progress } from "../Progress";
import { useSubmit } from "../forms/useSubmit";

type TeamResult = { team_size: number; in_team: boolean; status: string };

export function TeamButton({ ideaId, inTeam, size, min, canLeave }: { ideaId: string; inTeam: boolean; size: number; min: number; canLeave: boolean }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ inTeam, size });

  function toggle() {
    run(async () => {
      const result = await api<TeamResult>(`/api/ideas/${ideaId}/team`, { method: state.inTeam ? "DELETE" : "POST" });
      setState({ inTeam: result.in_team, size: result.team_size });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <Progress value={state.size} max={min} label="Team" />
      <p className="count muted"><b>{state.size} of {min}</b> people in the team</p>
      {(!state.inTeam || canLeave) && (
        <button className={state.inTeam ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
          {state.inTeam ? "Leave the team" : "Join the team"}
        </button>
      )}
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

`frontend/src/components/ideas/DecisionForm.tsx`:

```tsx
// Student Government's decision on an idea in review. Rejecting or asking for changes needs a note.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

type Decision = "approve" | "needs_changes" | "reject";

export function DecisionForm({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [note, setNote] = useState("");
  const [needNote, setNeedNote] = useState(false);

  function decide(decision: Decision) {
    if (decision !== "approve" && !note.trim()) {
      setNeedNote(true);
      return;
    }
    setNeedNote(false);
    run(async () => {
      await api(`/api/ideas/${ideaId}/decision`, { method: "POST", json: { decision, note: note.trim() || null } });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <h2>Your decision</h2>
      <FormError error={error} />
      <Field
        label="Note for the author" multiline rows={4} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}
        hint="The author gets it by e-mail." error={needNote ? "Write a note so the author knows what to change." : undefined}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button className="btn btn-primary" type="button" disabled={pending} onClick={() => decide("approve")}>Approve</button>
        <button className="btn" type="button" disabled={pending} onClick={() => decide("needs_changes")}>Ask for changes</button>
        <button className="btn" type="button" disabled={pending} onClick={() => decide("reject")}>Reject</button>
      </div>
    </div>
  );
}
```

`frontend/src/components/ideas/ResubmitButton.tsx`:

```tsx
// Sends an edited idea back to Student Government.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

export function ResubmitButton({ ideaId }: { ideaId: string }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();

  function resubmit() {
    run(async () => {
      await api(`/api/ideas/${ideaId}/resubmit`, { method: "POST" });
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button className="btn btn-primary" type="button" onClick={resubmit} disabled={pending}>Send back to review</button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

`frontend/src/components/ideas/ReportButton.tsx`:

```tsx
// Reports an idea to the admins. One report per person per idea.
// This work made by Anfinogentov Nikita
"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Field } from "../forms/Field";
import { useSubmit } from "../forms/useSubmit";

export function ReportButton({ ideaId }: { ideaId: string }) {
  const { pending, error, run, fieldError } = useSubmit();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      await api(`/api/ideas/${ideaId}/report`, { method: "POST", json: { reason } });
      setSent(true);
    });
  }

  if (sent) return <p className="muted" role="status">Thanks, the admins will take a look.</p>;
  if (!open) return <button className="link-button" type="button" onClick={() => setOpen(true)}>Report this idea</button>;
  return (
    <form className="form" onSubmit={onSubmit}>
      <Field label="What is wrong with this idea?" multiline rows={3} required minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} error={fieldError("reason")} />
      {error && !error.fields.length && <p className="field-error" role="alert">{error.message}</p>}
      <div className="actions">
        <button className="btn btn-small" type="submit" disabled={pending}>Send report</button>
        <button className="link-button" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: Idea pages**

`frontend/src/app/ideas/page.tsx`:

```tsx
// All ideas with sorting and category filters. The cursor is an offset from the API.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IdeaList } from "@/components/IdeaList";
import { ApiError } from "@/lib/errors";
import { categoryLabels } from "@/lib/format";
import { firstParam, qs } from "@/lib/query";
import { apiGet } from "@/lib/server-api";
import type { IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Ideas" };

const sorts = [
  { value: "new", label: "Newest" },
  { value: "trending", label: "Trending" },
  { value: "closest", label: "Closest to review" },
];

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function IdeasPage({ searchParams }: Props) {
  const params = await searchParams;
  const sortParam = firstParam(params.sort);
  const sort = sorts.some((item) => item.value === sortParam) ? sortParam! : "new";
  const categoryParam = firstParam(params.category);
  const category = categoryParam && categoryParam in categoryLabels ? categoryParam : undefined;
  const cursor = firstParam(params.cursor);

  let page: Page<IdeaCard>;
  try {
    page = await apiGet<Page<IdeaCard>>(`/api/ideas${qs({ sort, category, cursor, limit: 24 })}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "bad_cursor") redirect(`/ideas${qs({ sort: sort === "new" ? undefined : sort, category })}`);
    throw error;
  }
  const threshold = page.items[0]?.vote_threshold;
  // "new" is the default sort, so it stays out of the URL
  const link = (changes: Record<string, string | undefined>) => {
    const next = { sort, category, ...changes };
    return `/ideas${qs({ ...next, sort: next.sort === "new" ? undefined : next.sort })}`;
  };

  return (
    <div className="wrap detail">
      <div className="page-head section-head">
        <div>
          <p className="eyebrow">Student ideas → real initiatives</p>
          <h1>Ideas</h1>
          <p>
            Students propose, the network supports.{" "}
            {threshold ? `At ${threshold} votes an idea goes to Student Government.` : "With enough votes an idea goes to Student Government."}
          </p>
        </div>
        <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
      </div>
      <nav className="chips" aria-label="Sort">
        {sorts.map((item) => (
          <Link key={item.value} className="chip" href={link({ sort: item.value })} aria-current={item.value === sort ? "page" : undefined}>{item.label}</Link>
        ))}
      </nav>
      <nav className="chips" aria-label="Category">
        <Link className="chip" href={link({ category: undefined })} aria-current={!category ? "page" : undefined}>All</Link>
        {Object.entries(categoryLabels).map(([value, label]) => (
          <Link key={value} className="chip" href={link({ category: value })} aria-current={value === category ? "page" : undefined}>{label}</Link>
        ))}
      </nav>
      <IdeaList
        ideas={page.items}
        empty={<>No ideas here yet. <Link href="/ideas/new">Propose the first one</Link>.</>}
      />
      <div className="pager">
        {cursor && <Link href={link({})}>← First page</Link>}
        {page.next_cursor && <Link href={link({ cursor: page.next_cursor })}>Next page →</Link>}
      </div>
    </div>
  );
}
```

`frontend/src/app/ideas/new/page.tsx`:

```tsx
// Proposal form page. Only confirmed members can propose.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { getMe } from "@/lib/server-api";

export const metadata: Metadata = { title: "Propose an idea" };

export default async function NewIdeaPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/ideas/new");
  if (me.status === "pending") redirect("/verify");
  return (
    <div className="wrap auth">
      <p className="eyebrow">Student ideas → real initiatives</p>
      <h1>Propose an idea</h1>
      <p className="lead-sm">
        Describe what you want to happen and who it is for. Other students support it with their votes; with enough support,
        Student Government reviews it and a team forms around it.
      </p>
      <IdeaForm campus={me.campus_label} />
    </div>
  );
}
```

`frontend/src/app/ideas/[id]/page.tsx`:

```tsx
// One idea: description, status, support, review, team and the events it became.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { Progress } from "@/components/Progress";
import { DecisionForm } from "@/components/ideas/DecisionForm";
import { ReportButton } from "@/components/ideas/ReportButton";
import { ResubmitButton } from "@/components/ideas/ResubmitButton";
import { TeamButton } from "@/components/ideas/TeamButton";
import { VoteButton } from "@/components/ideas/VoteButton";
import { categoryLabels, scopeText, statusLabels } from "@/lib/format";
import { isUuid, qs } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { EventItem, IdeaDetail, Me, Page } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const idea = isUuid(id) ? await apiTry<IdeaDetail>(`/api/ideas/${id}`) : null;
  return { title: idea?.title ?? "Idea" };
}

function StatusPanel({ idea, me }: { idea: IdeaDetail; me: Me | null }) {
  const active = me?.status === "active";
  const loginLink = `/login${qs({ next: `/ideas/${idea.id}` })}`;
  const curator = me?.role === "curator" || me?.role === "admin";
  const reviewer = me?.role === "student_gov" || me?.role === "admin";

  if (idea.status === "open") {
    if (active && !idea.is_author) {
      return <VoteButton ideaId={idea.id} voted={idea.my_vote} count={idea.vote_count} threshold={idea.vote_threshold} />;
    }
    return (
      <div className="stack">
        <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />
        <p className="count muted"><b>{idea.vote_count} of {idea.vote_threshold}</b> students support this idea</p>
        <p className="muted">Open for support until <LocalTime iso={idea.expires_at} mode="date" />.</p>
        {!me && <Link className="btn btn-primary" href={loginLink}>Log in to support it</Link>}
        {me?.status === "pending" && <Link className="btn btn-primary" href="/verify">Confirm your e-mail to support it</Link>}
        {idea.is_author && <p className="muted">This is your idea. Share the link so other students can support it.</p>}
      </div>
    );
  }
  if (idea.status === "in_review") {
    return (
      <div className="stack">
        <p>Student Government is reviewing this idea.</p>
        {reviewer && <DecisionForm ideaId={idea.id} />}
      </div>
    );
  }
  if (idea.status === "needs_changes" || idea.status === "rejected") {
    return (
      <div className="stack">
        <p>{idea.status === "rejected" ? "Student Government decided not to take this idea further." : "Student Government asked for changes."}</p>
        {idea.review_note && <blockquote className="note">{idea.review_note}</blockquote>}
        {idea.status === "needs_changes" && idea.is_author && <ResubmitButton ideaId={idea.id} />}
      </div>
    );
  }
  if (idea.status === "forming_team") {
    const ready = idea.team_size >= idea.team_min;
    return (
      <div className="stack">
        <p>Approved! Now it needs a team to make it happen.</p>
        {active ? (
          <TeamButton ideaId={idea.id} inTeam={idea.in_team} size={idea.team_size} min={idea.team_min} canLeave={!idea.is_author} />
        ) : (
          <>
            <Progress value={idea.team_size} max={idea.team_min} label="Team" />
            <p className="count muted"><b>{idea.team_size} of {idea.team_min}</b> people in the team</p>
            {!me && <Link className="btn btn-primary" href={loginLink}>Log in to join the team</Link>}
            {me?.status === "pending" && <Link className="btn btn-primary" href="/verify">Confirm your e-mail to join</Link>}
          </>
        )}
        {active && (idea.is_author || curator) && (ready
          ? <Link className="btn btn-primary" href={`/events/new?idea=${idea.id}`}>Put it on the Hub</Link>
          : <p className="muted">When {idea.team_min} people are in the team, you can put it on the Hub as an event.</p>)}
      </div>
    );
  }
  if (idea.status === "live") return <p>This idea is on the Hub as an event.</p>;
  if (idea.status === "done") return <p>This idea became an event that has already taken place.</p>;
  return <p>This idea did not collect enough support in time.</p>;
}

export default async function IdeaPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [idea, me] = await Promise.all([apiFind<IdeaDetail>(`/api/ideas/${id}`), getMe()]);
  if (!idea) notFound();
  const hasEvents = idea.status === "live" || idea.status === "done";
  const [upcoming, past] = hasEvents
    ? await Promise.all([
        apiTry<Page<EventItem>>(`/api/events${qs({ idea: id, when: "upcoming" })}`),
        apiTry<Page<EventItem>>(`/api/events${qs({ idea: id, when: "past" })}`),
      ])
    : [null, null];
  const events = [...(upcoming?.items ?? []), ...(past?.items ?? [])];
  const showTeam = ["forming_team", "live", "done"].includes(idea.status);
  const active = me?.status === "active";

  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="breadcrumbs"><Link href="/ideas">Ideas</Link> / {categoryLabels[idea.category]}</p>
        <div className="badges">
          <span className="badge">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>
          <span className="badge badge-accent">{statusLabels[idea.status]}</span>
        </div>
        <h1>{idea.title}</h1>
        <p>{idea.summary}</p>
      </div>
      {idea.is_hidden && (
        <p className="notice notice-error">An admin has hidden this idea from the network. Only you and the admins can see it.</p>
      )}
      <div className="grid-2">
        <article>
          {idea.body_html ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: idea.body_html }} />
          ) : (
            <p className="muted">The author has not added more details.</p>
          )}
          <p className="byline">
            Proposed by <Link href={`/profile/${idea.author.id}`}>{idea.author.display_name}</Link>
            {idea.author.campus_label ? ` · ${idea.author.campus_label}` : ""} · <LocalTime iso={idea.created_at} mode="date" />
          </p>
          {showTeam && idea.team.length > 0 && (
            <>
              <h2 style={{ fontSize: 22, marginTop: 32 }}>Team</h2>
              <ul className="team-list" aria-label="Team">
                {idea.team.map((member) => (
                  <li key={member.id}>
                    <span className="avatar" aria-hidden="true">{member.display_name.slice(0, 1).toUpperCase()}</span>
                    <Link href={`/profile/${member.id}`}>{member.display_name}</Link>
                    {member.campus_label && <span className="muted">· {member.campus_label}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          {events.length > 0 && (
            <>
              <h2 style={{ fontSize: 22, marginTop: 32 }}>On the Hub</h2>
              <ul className="team-list">
                {events.map((event) => (
                  <li key={event.id}><Link href={`/events/${event.id}`}>{event.title}</Link> <span className="muted">· <LocalTime iso={event.starts_at} /></span></li>
                ))}
              </ul>
            </>
          )}
        </article>
        <aside className="card aside stack">
          <StatusPanel idea={idea} me={me} />
          {idea.can_edit && <Link className="btn" href={`/ideas/${idea.id}/edit`}>Edit idea</Link>}
          {active && !idea.is_author && <ReportButton ideaId={idea.id} />}
        </aside>
      </div>
    </div>
  );
}
```

`frontend/src/app/ideas/[id]/edit/page.tsx`:

```tsx
// Edit page for the author, while the idea is open or waiting for changes.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IdeaForm } from "@/components/ideas/IdeaForm";
import { isUuid } from "@/lib/query";
import { apiFind, getMe } from "@/lib/server-api";
import type { IdeaDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit idea" };

type Props = { params: Promise<{ id: string }> };

export default async function EditIdeaPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const me = await getMe();
  if (!me) redirect(`/login?next=/ideas/${id}/edit`);
  const idea = await apiFind<IdeaDetail>(`/api/ideas/${id}`);
  if (!idea) notFound();
  if (!idea.can_edit) redirect(`/ideas/${id}`);
  return (
    <div className="wrap auth">
      <p className="breadcrumbs"><Link href={`/ideas/${id}`}>{idea.title}</Link> / Edit</p>
      <h1>Edit idea</h1>
      {idea.review_note && <blockquote className="note" style={{ margin: "16px 0 24px" }}>{idea.review_note}</blockquote>}
      <IdeaForm idea={idea} campus={me.campus_label} />
    </div>
  );
}
```

`frontend/src/app/review/page.tsx`:

```tsx
// Review queue for Student Government and admins. Everyone else gets a 404.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdeaList } from "@/components/IdeaList";
import { apiGet, getMe } from "@/lib/server-api";
import type { IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewPage() {
  const me = await getMe();
  if (!me || me.status !== "active" || !(me.role === "student_gov" || me.role === "admin")) notFound();
  const page = await apiGet<Page<IdeaCard>>("/api/ideas?status=in_review&sort=new&limit=50");
  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="eyebrow">Student Government</p>
        <h1>Review queue</h1>
        <p>Ideas that reached their support goal. Approve them, ask for changes or reject them with a note for the author.</p>
      </div>
      <IdeaList ideas={page.items} empty="Nothing is waiting for review right now." />
    </div>
  );
}
```

- [ ] **Step 7: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test ideas.spec.ts auth.spec.ts`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "Add ideas: list, proposal form, idea page with voting, review, team and reports"
```

---

### Task C5: Events — list, event page, RSVP, putting an idea on the Hub

**Files:**
- Create: `frontend/src/components/EventCard.tsx`, `frontend/src/components/events/EventForm.tsx`, `events/RsvpButton.tsx`
- Create: `frontend/src/app/events/page.tsx`, `events/new/page.tsx`, `events/[id]/page.tsx`
- Modify: `frontend/src/app/globals.css` (append)
- Test: `frontend/tests/e2e/events.spec.ts`

**Interfaces:**
- Consumes:
  - C1–C4: `apiGet`, `apiFind`, `apiTry`, `getMe`, `api`, `qs`, `firstParam`, `isUuid`, `LocalTime`, `useSubmit`, `Field`, `FormError`, types `EventItem`, `IdeaDetail`, `Page`;
  - API:
    - `GET /api/events?when=upcoming|past&going=true&network_only=true&category=&idea=&cursor=&limit=` → `Page<EventItem>`;
    - `POST /api/events {title, description_md, starts_at, ends_at, location_text, online_url, idea_id, scope}` → `EventItem`. Times must carry a timezone. Errors: `location_required`, `bad_time_range`, `starts_in_past`, `idea_not_ready`, `team_too_small`, `forbidden`;
    - `GET /api/events/{id}` → `EventItem` or `404`;
    - `POST|DELETE /api/events/{id}/rsvp` → `{going_count, i_am_going}`; `409 event_over` for past events.
- Produces:
  - `<EventCard event />` (class `card event`), used by the homepage and section pages;
  - `toInstant(localValue)` in `EventForm.tsx`: `"2026-10-07T18:30"` (the visitor's wall clock) → ISO string in UTC;
  - routes `/events`, `/events/new`, `/events/[id]`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/events.spec.ts`:

```ts
// Events: an approved idea with a full team goes on the Hub; the typed time comes back unchanged; RSVP.
// The browser runs in Tbilisi time (UTC+4, no daylight saving) so the timezone conversion is visible.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiLogin, apiUser, loginInBrowser, skipIntro } from "./helpers";

test.use({ timezoneId: "Asia/Tbilisi" });
test.beforeEach(async ({ page }) => skipIntro(page));

async function ideaWithFullTeam(title: string) {
  const author = await apiUser("Event Author");
  const created = await author.context.post("/api/ideas", {
    data: { title, summary: "An evening where every campus brings a dish from home.", category: "event", scope: "network" },
  });
  const ideaId = (await created.json()).id;
  const voters = [await apiUser("Event Voter One"), await apiUser("Event Voter Two")];
  for (const voter of voters) expect((await voter.context.post(`/api/ideas/${ideaId}/vote`)).status()).toBe(200);
  const gov = await apiLogin(STAFF.gov, STAFF.password);
  expect((await gov.post(`/api/ideas/${ideaId}/decision`, { data: { decision: "approve" } })).status()).toBe(200);
  expect((await voters[0].context.post(`/api/ideas/${ideaId}/team`)).status()).toBe(200);
  await gov.dispose();
  for (const voter of voters) await voter.context.dispose();
  await author.context.dispose();
  return { ideaId, authorEmail: author.email };
}

test("the author puts the idea on the Hub and the time comes back as typed", async ({ page }) => {
  const title = `Dinner of nations ${Date.now() % 100000}`;
  const { ideaId, authorEmail } = await ideaWithFullTeam(title);
  await loginInBrowser(page, authorEmail, PASSWORD);
  await page.goto(`/ideas/${ideaId}`);
  await page.getByRole("link", { name: "Put it on the Hub" }).click();
  await expect(page.getByLabel("Title")).toHaveValue(title);

  const day = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Starts").fill(`${day}T18:30`);
  await page.getByLabel("Ends").fill(`${day}T21:00`);
  await page.getByLabel("Place").fill("Student lounge, 2nd floor");
  await page.getByLabel("Description").fill("Bring a dish and its story.");
  await page.getByRole("button", { name: "Publish event" }).click();

  await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
  const eventId = page.url().split("/").pop()!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".event-when")).toContainText("18:30");
  await expect(page.locator(".event-when")).toContainText("21:00");
  const stored = await (await page.request.get(`/api/events/${eventId}`)).json();
  expect(new Date(stored.starts_at).toISOString()).toBe(`${day}T14:30:00.000Z`);

  await page.getByRole("button", { name: "I'm going" }).dblclick();
  await expect(page.getByRole("button", { name: "Cancel my spot" })).toBeVisible();
  await expect(page.getByText("1 going")).toBeVisible();

  await page.goto(`/ideas/${ideaId}`);
  await expect(page.locator(".badge-accent")).toHaveText("On the Hub");
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(`${BASE}/events/${eventId}`);

  await page.goto("/events");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
});

test("an event that ends before it starts is refused with the API's message", async ({ page }) => {
  await loginInBrowser(page, STAFF.curator, STAFF.password);
  await page.goto("/events/new");
  const day = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Title").fill("Autumn volunteering day");
  await page.getByLabel("Starts").fill(`${day}T15:00`);
  await page.getByLabel("Ends").fill(`${day}T11:00`);
  await page.getByLabel("Place").fill("City park");
  await page.getByRole("button", { name: "Publish event" }).click();
  await expect(page.getByText("The event must end after it starts")).toBeVisible();
  await expect(page).toHaveURL(/\/events\/new/);
});

test("only curators open the free event form; guests are sent to log in", async ({ page, browser }) => {
  await page.goto("/events/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fevents%2Fnew/);
  const student = await apiUser("Plain Student");
  await student.context.dispose();
  const context = await browser.newContext();
  const studentPage = await context.newPage();
  await skipIntro(studentPage);
  await loginInBrowser(studentPage, student.email, PASSWORD);
  expect((await studentPage.goto("/events/new"))?.status()).toBe(404);
  await context.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test events.spec.ts`
Expected: FAIL — the "Put it on the Hub" link leads to a 404.

- [ ] **Step 3: Styles**

Append to `frontend/src/app/globals.css`:

```css

/* events */
.event-when { font-size: 18px; font-weight: 700; color: var(--accent-text); }
.event .going { margin-top: 10px; font-size: 14px; color: var(--muted); }
.form .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 560px) { .form .row { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Components**

`frontend/src/components/EventCard.tsx`:

```tsx
// Event card: when, what, where, how many are going.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import type { EventItem } from "@/lib/types";
import { LocalTime } from "./LocalTime";

export function placeText(event: EventItem): string {
  const where = event.location_text ?? "Online";
  return `${where} · ${event.campus_label ?? "whole network"}`;
}

export function EventCard({ event }: { event: EventItem }) {
  return (
    <Link className="card event" href={`/events/${event.id}`}>
      <LocalTime iso={event.starts_at} />
      <h3>{event.title}</h3>
      <p className="muted">{placeText(event)}</p>
      <p className="going">{event.going_count} going</p>
    </Link>
  );
}
```

`frontend/src/components/events/EventForm.tsx`:

```tsx
// Event form. Times are typed on the visitor's own clock and sent to the API as absolute instants.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { EventItem, Scope } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

// "2026-10-07T18:30" from <input type="datetime-local"> has no timezone; Date reads it as local time
export function toInstant(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function EventForm({ idea, campus }: { idea?: { id: string; title: string }; campus: string | null }) {
  const router = useRouter();
  const { pending, error, run, fieldError } = useSubmit();
  const [title, setTitle] = useState(idea?.title ?? "");
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [place, setPlace] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<Scope>("network");

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(async () => {
      const created = await api<EventItem>("/api/events", {
        method: "POST",
        json: {
          title, description_md: description, starts_at: toInstant(starts), ends_at: toInstant(ends),
          location_text: place.trim() || null, online_url: link.trim() || null, idea_id: idea?.id ?? null, scope,
        },
      });
      router.push(`/events/${created.id}`);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <FormError error={error} />
      <Field label="Title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} error={fieldError("title")} />
      <div className="row">
        <Field label="Starts" type="datetime-local" required value={starts} onChange={(event) => setStarts(event.target.value)} error={fieldError("starts_at")} />
        <Field label="Ends" type="datetime-local" required value={ends} onChange={(event) => setEnds(event.target.value)} error={fieldError("ends_at")} />
      </div>
      <p className="hint">Times are in your timezone; everyone else sees them in theirs.</p>
      <Field label="Place" maxLength={200} hint="A room, a building or an address. Leave empty for an online event." value={place} onChange={(event) => setPlace(event.target.value)} error={fieldError("location_text")} />
      <Field label="Online link" type="url" hint="Starts with https://. Leave empty for an in-person event." value={link} onChange={(event) => setLink(event.target.value)} error={fieldError("online_url")} />
      {!idea && (
        <div className="field">
          <fieldset>
            <legend>Who is it for</legend>
            <label className="radio"><input type="radio" name="scope" value="network" checked={scope === "network"} onChange={() => setScope("network")} /> Whole network</label>
            <label className="radio"><input type="radio" name="scope" value="campus" checked={scope === "campus"} onChange={() => setScope("campus")} /> My campus{campus ? ` (${campus})` : ""}</label>
          </fieldset>
        </div>
      )}
      <Field
        label="Description" multiline rows={6} maxLength={5000} hint="Optional. Markdown works."
        value={description} onChange={(event) => setDescription(event.target.value)} error={fieldError("description_md")}
      />
      <div className="actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Publishing…" : "Publish event"}</button>
      </div>
    </form>
  );
}
```

`frontend/src/components/events/RsvpButton.tsx`:

```tsx
// "I'm going" / "Cancel my spot" with the live count.
// This work made by Anfinogentov Nikita
"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

type RsvpResult = { going_count: number; i_am_going: boolean };

export function RsvpButton({ eventId, going, count }: { eventId: string; going: boolean; count: number }) {
  const { pending, error, run } = useSubmit();
  const [state, setState] = useState({ going, count });

  function toggle() {
    run(async () => {
      const result = await api<RsvpResult>(`/api/events/${eventId}/rsvp`, { method: state.going ? "DELETE" : "POST" });
      setState({ going: result.i_am_going, count: result.going_count });
    });
  }

  return (
    <div className="stack">
      <p className="count muted"><b>{state.count} going</b></p>
      <button className={state.going ? "btn" : "btn btn-primary"} type="button" onClick={toggle} disabled={pending} aria-busy={pending}>
        {state.going ? "Cancel my spot" : "I'm going"}
      </button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Pages**

`frontend/src/app/events/page.tsx`:

```tsx
// Upcoming and past events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EventCard } from "@/components/EventCard";
import { ApiError } from "@/lib/errors";
import { firstParam, qs } from "@/lib/query";
import { apiGet, getMe } from "@/lib/server-api";
import type { EventItem, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Events" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function EventsPage({ searchParams }: Props) {
  const params = await searchParams;
  const when = firstParam(params.when) === "past" ? "past" : "upcoming";
  const cursor = firstParam(params.cursor);
  const me = await getMe();
  let page: Page<EventItem>;
  try {
    page = await apiGet<Page<EventItem>>(`/api/events${qs({ when, cursor, limit: 24 })}`);
  } catch (error) {
    if (error instanceof ApiError && error.code === "bad_cursor") redirect(`/events${qs({ when: when === "past" ? when : undefined })}`);
    throw error;
  }
  const base = when === "past" ? "/events?when=past" : "/events";
  const curator = me?.status === "active" && (me.role === "curator" || me.role === "admin");

  return (
    <div className="wrap detail">
      <div className="page-head section-head">
        <div>
          <p className="eyebrow">On the Hub</p>
          <h1>Events</h1>
          <p>Events across the network. Many of them started as a student idea.</p>
        </div>
        {curator && <Link className="btn btn-primary" href="/events/new">Publish an event</Link>}
      </div>
      <nav className="chips" aria-label="When">
        <Link className="chip" href="/events" aria-current={when === "upcoming" ? "page" : undefined}>Upcoming</Link>
        <Link className="chip" href="/events?when=past" aria-current={when === "past" ? "page" : undefined}>Past</Link>
      </nav>
      {page.items.length ? (
        <div className="cards">{page.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
      ) : (
        <p className="empty">
          {when === "past" ? "No events have taken place yet." : <>Nothing is scheduled yet. Events appear here when <Link href="/ideas">ideas</Link> gather a team.</>}
        </p>
      )}
      <div className="pager">
        {cursor && <Link href={base}>← First page</Link>}
        {page.next_cursor && <Link href={`${base}${base.includes("?") ? "&" : "?"}cursor=${page.next_cursor}`}>Next page →</Link>}
      </div>
    </div>
  );
}
```

`frontend/src/app/events/new/page.tsx`:

```tsx
// Event form page: for an idea with a full team (its author or a curator), or a free event (curators).
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EventForm } from "@/components/events/EventForm";
import { firstParam, isUuid, qs } from "@/lib/query";
import { apiFind, getMe } from "@/lib/server-api";
import type { IdeaDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Publish an event" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewEventPage({ searchParams }: Props) {
  const params = await searchParams;
  const ideaId = firstParam(params.idea);
  const me = await getMe();
  if (!me) redirect(`/login${qs({ next: `/events/new${qs({ idea: ideaId })}` })}`);
  if (me.status === "pending") redirect("/verify");
  const curator = me.role === "curator" || me.role === "admin";

  if (ideaId === undefined) {
    if (!curator) notFound();
    return (
      <div className="wrap auth">
        <p className="eyebrow">On the Hub</p>
        <h1>Publish an event</h1>
        <p className="lead-sm">As a curator you can publish events that did not start as an idea.</p>
        <EventForm campus={me.campus_label} />
      </div>
    );
  }

  if (!isUuid(ideaId)) notFound();
  const idea = await apiFind<IdeaDetail>(`/api/ideas/${ideaId}`);
  if (!idea || !(idea.is_author || curator)) notFound();
  const ready = idea.status === "forming_team" && idea.team_size >= idea.team_min;
  return (
    <div className="wrap auth">
      <p className="breadcrumbs"><Link href={`/ideas/${idea.id}`}>{idea.title}</Link> / Put it on the Hub</p>
      <h1>Put it on the Hub</h1>
      {ready ? (
        <>
          <p className="lead-sm">Set the time and the place. The team gets an e-mail as soon as the event is published.</p>
          <EventForm idea={{ id: idea.id, title: idea.title }} campus={me.campus_label} />
        </>
      ) : (
        <p className="notice">
          {idea.status === "forming_team"
            ? `The team needs at least ${idea.team_min} people first; now it has ${idea.team_size}.`
            : "This idea is not gathering a team, so it cannot become a new event."}{" "}
          <Link href={`/ideas/${idea.id}`}>Back to the idea</Link>
        </p>
      )}
    </div>
  );
}
```

`frontend/src/app/events/[id]/page.tsx`:

```tsx
// One event: time in the visitor's timezone, place, description, the idea it came from, RSVP.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { placeText } from "@/components/EventCard";
import { LocalTime } from "@/components/LocalTime";
import { RsvpButton } from "@/components/events/RsvpButton";
import { isUuid, qs } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { EventItem } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const event = isUuid(id) ? await apiTry<EventItem>(`/api/events/${id}`) : null;
  return { title: event?.title ?? "Event" };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [event, me] = await Promise.all([apiFind<EventItem>(`/api/events/${id}`), getMe()]);
  if (!event) notFound();

  return (
    <div className="wrap detail">
      <div className="page-head">
        <p className="breadcrumbs"><Link href="/events">Events</Link> / {event.is_past ? "Past" : "Upcoming"}</p>
        <p className="event-when"><LocalTime iso={event.starts_at} /> – <LocalTime iso={event.ends_at} /></p>
        <h1>{event.title}</h1>
        <p>{placeText(event)}</p>
      </div>
      <div className="grid-2">
        <article>
          {event.description_html ? (
            <div className="prose" dangerouslySetInnerHTML={{ __html: event.description_html }} />
          ) : (
            <p className="muted">The organisers have not added a description.</p>
          )}
          {event.online_url && (
            <p><a href={event.online_url} target="_blank" rel="nofollow ugc noopener noreferrer">Join online</a></p>
          )}
          {event.idea_id && event.idea_title && (
            <p className="byline">Born from the student idea <Link href={`/ideas/${event.idea_id}`}>{event.idea_title}</Link>.</p>
          )}
          <p className="byline">Published by <Link href={`/profile/${event.created_by.id}`}>{event.created_by.display_name}</Link>.</p>
        </article>
        <aside className="card aside stack">
          {event.is_past ? (
            <p>This event has ended. {event.going_count} {event.going_count === 1 ? "person was" : "people were"} going.</p>
          ) : me?.status === "active" ? (
            <RsvpButton eventId={event.id} going={event.i_am_going} count={event.going_count} />
          ) : (
            <>
              <p className="count muted"><b>{event.going_count} going</b></p>
              {me ? (
                <Link className="btn btn-primary" href="/verify">Confirm your e-mail to join</Link>
              ) : (
                <Link className="btn btn-primary" href={`/login${qs({ next: `/events/${event.id}` })}`}>Log in to join</Link>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test events.spec.ts ideas.spec.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "Add events: list, event page, RSVP and putting an idea on the Hub"
```

---

### Task C6: Homepage

**Files:**
- Create: `frontend/src/components/HeroNet.tsx`, `Pillars.tsx`, `Steps.tsx`, `FeedList.tsx`, `CampusList.tsx`
- Create: `frontend/src/lib/feed-text.ts`
- Modify: `frontend/src/app/page.tsx` (replace the temporary shell), `frontend/src/app/globals.css` (append)
- Modify: `frontend/tests/e2e/events.spec.ts` (the event born from an idea must reach the homepage)
- Test: `frontend/tests/e2e/home.spec.ts`

**Interfaces:**
- Consumes:
  - C1–C5: `apiTry`, `getMe`, `qs`, `categoryLabels`, `scopeText`, `LocalTime`, `Progress`, `EventCard`, types `Stats`, `IdeaCard`, `EventItem`, `FeedItem`, `Campus`, `Page`;
  - API:
    - `GET /api/stats` → `Stats`, or `503 feed_unavailable` while ClickHouse is down;
    - `GET /api/ideas?sort=trending&status=…&limit=6`, `GET /api/ideas?sort=closest&limit=1`;
    - `GET /api/events?limit=4` (upcoming by default);
    - `GET /api/feed?limit=12` → `Page<FeedItem>`, or `503 feed_unavailable`;
    - `GET /api/campuses` → `Campus[]`.
  - Feed `data` per kind (from the backend's `emit` calls):
    - `user_verified {display_name}`;
    - `idea_created {actor_name, idea_title, category}`;
    - `idea_reached_review {idea_title}`;
    - `idea_decided {idea_title, decision}`;
    - `team_formed {idea_title}`;
    - `event_published {event_title, idea_title, starts_at}`.
- Produces:
  - `feedSentence(item)` → `{ before, link?, after } | null` (null for kinds this version does not know);
  - `<FeedList items />`, `<CampusList campuses />`, `<Pillars />`, `<Steps threshold? />`, `<HeroNet />` — reused by the section pages in C7;
  - CSS: `sr-only`, `starting`, `solo`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/home.spec.ts`:

```ts
// Homepage: live blocks fill from the API; with the API unreachable the page still renders and data pages offer a retry.
// This work made by Anfinogentov Nikita
import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { BASE, STAFF, apiLogin, apiUser, skipIntro } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("live counters, the closest idea, events and the feed", async ({ page }) => {
  const student = await apiUser("Home Student");
  const ideaTitle = `Peer tutoring hour ${Date.now() % 100000}`;
  const created = await student.context.post("/api/ideas", {
    data: { title: ideaTitle, summary: "An hour of peer tutoring before every exam week.", category: "academic", scope: "network" },
  });
  expect(created.status()).toBe(201);
  await student.context.dispose();

  const curator = await apiLogin(STAFF.curator, STAFF.password);
  const eventTitle = `Conversation night ${Date.now() % 100000}`;
  const startsAt = new Date(Date.now() + 86_400_000);
  const published = await curator.post("/api/events", {
    data: {
      title: eventTitle, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 7_200_000).toISOString(),
      location_text: "Student lounge", scope: "network",
    },
  });
  expect(published.status()).toBe(201);
  await curator.dispose();

  // the worker ships the outbox to ClickHouse every 2 seconds
  await expect(async () => {
    await page.goto("/");
    await expect(page.locator(".feed")).toContainText(eventTitle, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByLabel("Network in numbers")).toContainText("student");
  await expect(page.locator(".spotlight")).toBeVisible();
  await expect(page.getByText("How it works")).toHaveCount(0);
  await expect(page.locator(".idea-list")).toContainText(ideaTitle);
  const hub = page.locator("section", { has: page.getByRole("heading", { name: "Coming up" }) });
  await expect(hub.getByRole("link", { name: new RegExp(eventTitle) })).toBeVisible();
  await expect(page.locator(".campuses")).toContainText("Almaty");

  await page.getByRole("link", { name: "Explore ideas" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas`);
});

test.describe("when the API is unreachable", () => {
  // a second production server on the same build, whose server side points at a closed port
  let server: ChildProcess;
  const DOWN = "http://localhost:3101";

  test.beforeAll(async () => {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3101"], {
      env: { ...process.env, API_URL: "http://127.0.0.1:1" },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${DOWN}/about`)).ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("the second Next server did not start");
  });

  test.afterAll(() => {
    server.kill();
  });

  test("the homepage renders for a guest without the live blocks", async ({ page }) => {
    await page.goto(`${DOWN}/`);
    await expect(page.getByRole("heading", { name: "One hub. Every campus." })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What just happened" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Coming up" })).toHaveCount(0);
    await expect(page.getByLabel("Network in numbers")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("a page that needs data shows the error page with a retry", async ({ page }) => {
    await page.goto(`${DOWN}/ideas`);
    await expect(page.getByRole("heading", { name: "This page could not load" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
  });
});
```

In `frontend/tests/e2e/events.spec.ts`, at the end of the first test ("the author puts the idea on the Hub…"), append:

```ts

  // the whole path ends on the homepage
  await page.goto("/");
  await expect(page.locator("#events")).toContainText(title);
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test home.spec.ts events.spec.ts`
Expected: FAIL — no `.feed` and no `#events` on the temporary homepage.

- [ ] **Step 3: Feed sentences**

`frontend/src/lib/feed-text.ts`:

```ts
// Turns a feed record into a short sentence with at most one link.
// This work made by Anfinogentov Nikita
import type { FeedItem } from "./types";

export type FeedLink = { href: string; text: string };
export type FeedSentence = { before: string; link?: FeedLink; after: string };

// with a link the title is clickable; without one (an old record) the title is plain text
function around(before: string, link: FeedLink | undefined, fallback: string, after: string): FeedSentence {
  return link ? { before, link, after } : { before: before + fallback + after, after: "" };
}

const decisionText: Record<string, string> = {
  approve: "Student Government approved ",
  needs_changes: "Student Government asked for changes to ",
  reject: "Student Government reviewed ",
};

export function feedSentence(item: FeedItem): FeedSentence | null {
  const data = item.data ?? {};
  const ideaTitle = data.idea_title ?? "an idea";
  const idea = item.idea_id && data.idea_title ? { href: `/ideas/${item.idea_id}`, text: data.idea_title } : undefined;
  switch (item.kind) {
    case "user_verified":
      return { before: `${data.display_name ?? "A student"} joined the network`, after: "" };
    case "idea_created":
      return around(`${data.actor_name ?? "A student"} proposed `, idea, ideaTitle, "");
    case "idea_reached_review":
      return around("", idea, data.idea_title ?? "An idea", " reached its support goal and went to review");
    case "idea_decided":
      return around(decisionText[data.decision ?? ""] ?? "Student Government reviewed ", idea, ideaTitle, "");
    case "team_formed":
      return around("The team for ", idea, ideaTitle, " is complete");
    case "event_published": {
      const event = item.event_id && data.event_title ? { href: `/events/${item.event_id}`, text: data.event_title } : undefined;
      return around("", event, data.event_title ?? "A new event", " is now on the Hub");
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Homepage components**

`frontend/src/components/HeroNet.tsx`:

```tsx
// Still "nodes and threads" network behind the hero: the frame the intro burst settles into.
// This work made by Anfinogentov Nikita

export function HeroNet() {
  return (
    <svg className="hero-net" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1">
        <path d="M820 300 C 900 200, 1000 160, 1200 120" />
        <path d="M820 300 C 760 420, 700 500, 640 600" />
        <path d="M820 300 C 940 340, 1040 420, 1200 460" />
        <path d="M820 300 C 860 180, 880 90, 900 0" />
        <path d="M820 300 C 700 260, 600 280, 480 240" />
        <path d="M480 240 C 420 200, 380 120, 360 0" />
        <path d="M1040 200 C 1080 260, 1120 300, 1200 320" />
      </g>
      <g fill="currentColor">
        <circle cx="820" cy="300" r="6" />
        <circle cx="480" cy="240" r="4" />
        <circle cx="1040" cy="200" r="4" />
        <circle cx="700" cy="500" r="3" />
      </g>
    </svg>
  );
}
```

`frontend/src/components/Pillars.tsx`:

```tsx
// The four directions from the concept slide, each leading to its section.
// This work made by Anfinogentov Nikita
import Link from "next/link";

export const pillars = [
  { href: "/academic", title: "Academic", items: ["Schedule", "Courses", "Professors", "Resources", "Deadlines"] },
  { href: "/international", title: "International", items: ["Learning portals", "Exchange opportunities", "Scholarships", "Conferences", "International events"] },
  { href: "/community", title: "Community", items: ["Speaking Club", "Volunteering", "Student Government", "Student Voice", "Campus events"] },
  { href: "/personal", title: "Personal", items: ["Notifications", "Activity history", "Achievements", "Digital portfolio"] },
];

export function Pillars() {
  return (
    <div className="pillars">
      {pillars.map((pillar) => (
        <Link key={pillar.href} className="card pillar" href={pillar.href}>
          <div className="node" />
          <h3>{pillar.title}</h3>
          <ul>{pillar.items.map((item) => <li key={item}>{item}</li>)}</ul>
        </Link>
      ))}
    </div>
  );
}
```

`frontend/src/components/Steps.tsx`:

```tsx
// Idea → Support → Review → Team → On the Hub.
// This work made by Anfinogentov Nikita

export function Steps({ threshold }: { threshold?: number }) {
  const steps = [
    ["Idea", "Any student proposes"],
    ["Support", threshold ? `${threshold} votes to go further` : "Enough votes to go further"],
    ["Review", "Student Government decides"],
    ["Team", "Volunteers join in"],
    ["On the Hub", "It becomes an event"],
  ];
  return (
    <ol className="steps" aria-label="How an idea becomes an event">
      {steps.map(([title, text]) => (
        <li key={title} className="step"><b>{title}</b><span>{text}</span></li>
      ))}
    </ol>
  );
}
```

`frontend/src/components/FeedList.tsx`:

```tsx
// Activity feed list: one sentence per record, time in the visitor's timezone, campus or "whole network".
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { feedSentence } from "@/lib/feed-text";
import type { FeedItem } from "@/lib/types";
import { LocalTime } from "./LocalTime";

export function FeedList({ items }: { items: FeedItem[] }) {
  const rows = items.flatMap((item) => {
    const sentence = feedSentence(item);
    return sentence ? [{ item, sentence }] : [];
  });
  return (
    <ul className="feed">
      {rows.map(({ item, sentence }) => (
        <li key={item.id}>
          <span className="dot" aria-hidden="true" />
          <span>
            {sentence.before}
            {sentence.link && <Link href={sentence.link.href}>{sentence.link.text}</Link>}
            {sentence.after}
            <small><LocalTime iso={item.at} mode="relative" /> · {item.campus_label ?? "whole network"}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
```

`frontend/src/components/CampusList.tsx`:

```tsx
// Campus labels with their country codes, biggest campus first (the API already sorts them).
// This work made by Anfinogentov Nikita
import type { Campus } from "@/lib/types";

export function CampusList({ campuses }: { campuses: Campus[] }) {
  return (
    <div className="campuses">
      {campuses.map((campus) => (
        <span key={`${campus.campus_label}-${campus.country_code}`} className="campus">
          {campus.campus_label} <small>{campus.country_code}</small>
        </span>
      ))}
    </div>
  );
}
```

Append to `frontend/src/app/globals.css`:

```css

/* homepage additions */
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.starting { margin-top: 48px; color: var(--muted); max-width: 52ch; }
.starting a { font-weight: 700; }
.ideas-grid.solo { grid-template-columns: minmax(0, 720px); }
.spotlight .eyebrow { margin: 0 0 12px; }
```

- [ ] **Step 5: The homepage**

Replace `frontend/src/app/page.tsx`:

```tsx
// Homepage: hero, the four directions, student ideas, events, the live feed and the campus network.
// Every live block hides itself when its data is missing or the store behind it is down.
// This work made by Anfinogentov Nikita
import Link from "next/link";
import { CampusList } from "@/components/CampusList";
import { EventCard } from "@/components/EventCard";
import { FeedList } from "@/components/FeedList";
import { HeroNet } from "@/components/HeroNet";
import { Pillars } from "@/components/Pillars";
import { Progress } from "@/components/Progress";
import { Steps } from "@/components/Steps";
import { categoryLabels, scopeText } from "@/lib/format";
import { qs } from "@/lib/query";
import { apiTry, getMe } from "@/lib/server-api";
import type { Campus, EventItem, FeedItem, IdeaCard, Page, Stats } from "@/lib/types";

function number(value: number): string {
  return value.toLocaleString("en-US");
}

function Counters({ stats, signedIn }: { stats: Stats | null; signedIn: boolean }) {
  if (!stats) return null;
  if (!stats.show_counters) {
    return (
      <p className="starting">
        The network is just starting — your campus could be the first.{!signedIn && <> <Link href="/join">Join now</Link></>}
      </p>
    );
  }
  return (
    <div className="stats" aria-label="Network in numbers">
      <div className="stat"><b>{number(stats.students)}</b><span>{stats.students === 1 ? "student" : "students"}</span></div>
      <div className="stat"><b>{number(stats.campuses)}</b><span>{stats.campuses === 1 ? "campus" : "campuses"}</span></div>
      <div className="stat"><b>{number(stats.ideas_to_events)}</b><span>{stats.ideas_to_events === 1 ? "idea became an event" : "ideas became events"}</span></div>
    </div>
  );
}

function Spotlight({ idea }: { idea: IdeaCard }) {
  return (
    <article className="card spotlight">
      <p className="eyebrow">Closest to review</p>
      <span className="tag">{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</span>
      <h3>{idea.title}</h3>
      <p className="muted">{idea.summary}</p>
      <Progress value={idea.vote_count} max={idea.vote_threshold} label="Support" />
      <p className="muted"><b style={{ color: "var(--fg)" }}>{idea.vote_count} of {idea.vote_threshold}</b> students support this idea</p>
      <Link className="btn" href={`/ideas/${idea.id}`}>Support it</Link>
    </article>
  );
}

// shown when there are no ideas yet: the festival from the concept slide, clearly marked as an example
function Example() {
  return (
    <article className="card spotlight">
      <span className="tag">How it works · example</span>
      <h3>International Food Festival</h3>
      <p className="muted">One evening, one table per country. Students cook a dish from home and share the story behind it.</p>
      <div className="progress" aria-hidden="true"><i style={{ width: "80%" }} /></div>
      <p className="muted">
        Students support an idea with their votes. With enough support, Student Government reviews it, a team forms around it,
        and it lands on the Hub as an event.
      </p>
      <Link className="btn btn-primary" href="/ideas/new">Propose the first idea</Link>
    </article>
  );
}

function Trending({ ideas }: { ideas: IdeaCard[] }) {
  return (
    <div className="card">
      <h3>Trending this week</h3>
      <ul className="idea-list">
        {ideas.map((idea) => (
          <li key={idea.id}>
            <Link href={`/ideas/${idea.id}`}>
              <span>{idea.title}<small>{categoryLabels[idea.category]} · {scopeText(idea.scope, idea.campus_label)}</small></span>
              <span className="votes">{idea.vote_count}<span className="sr-only"> votes</span></span>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="link-more" href="/ideas?sort=trending">All ideas →</Link>
    </div>
  );
}

export default async function Home() {
  const [me, stats, trending, closest, events, feed, campuses] = await Promise.all([
    getMe(),
    apiTry<Stats>("/api/stats"),
    apiTry<Page<IdeaCard>>(`/api/ideas${qs({ sort: "trending", status: ["open", "in_review", "forming_team", "live"], limit: 6 })}`),
    apiTry<Page<IdeaCard>>("/api/ideas?sort=closest&limit=1"),
    apiTry<Page<EventItem>>("/api/events?limit=4"),
    apiTry<Page<FeedItem>>("/api/feed?limit=12"),
    apiTry<Campus[]>("/api/campuses"),
  ]);
  const ideas = trending?.items ?? [];
  const spotlight = closest?.items[0] ?? null;
  const threshold = spotlight?.vote_threshold ?? ideas[0]?.vote_threshold;
  const upcoming = events?.items ?? [];
  const feedItems = feed?.items ?? [];
  const campusList = campuses ?? [];

  return (
    <>
      <section className="hero">
        <HeroNet />
        <div className="wrap">
          <p className="eyebrow">An independent international student network</p>
          <h1>One hub. Every campus.</h1>
          <p className="lead">A digital ecosystem built around the student experience.</p>
          <div className="actions">
            {me ? (
              <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
            ) : (
              <Link className="btn btn-primary" href="/join">Join with your university email</Link>
            )}
            <Link className="btn" href="/ideas">Explore ideas</Link>
          </div>
          <Counters stats={stats} signedIn={Boolean(me)} />
        </div>
      </section>

      <section id="pillars">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">What lives here</p>
              <h2>Four directions, one account</h2>
            </div>
          </div>
          <Pillars />
        </div>
      </section>

      <section id="ideas">
        <div className="wrap">
          <div className="section-head">
            <div>
              <p className="eyebrow">Student ideas → real initiatives</p>
              <h2>Your idea can become a campus activity</h2>
              <p className="muted">Propose it, gather support, and Student Government takes it from there.</p>
            </div>
            <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
          </div>
          <Steps threshold={threshold} />
          {ideas.length === 0 ? (
            <div className="ideas-grid solo"><Example /></div>
          ) : (
            <div className={spotlight ? "ideas-grid" : "ideas-grid solo"}>
              {spotlight && <Spotlight idea={spotlight} />}
              <Trending ideas={ideas} />
            </div>
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section id="events">
          <div className="wrap">
            <div className="section-head">
              <div><p className="eyebrow">On the Hub</p><h2>Coming up</h2></div>
              <Link className="btn" href="/events">All events</Link>
            </div>
            <div className="events">{upcoming.map((event) => <EventCard key={event.id} event={event} />)}</div>
          </div>
        </section>
      )}

      {feedItems.length >= 3 && (
        <section id="feed">
          <div className="wrap">
            <div className="section-head">
              <div><p className="eyebrow">Live across the network</p><h2>What just happened</h2></div>
            </div>
            <FeedList items={feedItems} />
          </div>
        </section>
      )}

      {campusList.length > 0 && (
        <section id="campuses">
          <div className="wrap">
            <div className="section-head">
              <div>
                <p className="eyebrow">Campus network</p>
                <h2>Students from {campusList.length} {campusList.length === 1 ? "campus" : "campuses"}</h2>
              </div>
              <Link className="btn" href="/request-campus">Add your university</Link>
            </div>
            <CampusList campuses={campusList} />
          </div>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test home.spec.ts events.spec.ts intro.spec.ts shell.spec.ts`
Expected: all pass.

- [ ] **Step 7: Compare with the approved mock**

Start the dev stores, the backend (`uv run modernsi dev`) and `npm run build && npm run start` in `frontend/`, then open `http://localhost:3000`. To see the intro again, delete `msi_intro_seen` in DevTools (Application → Session Storage) and reload. Put the page next to `design/mock/index.html` in both themes and at 360 px. Expected: same layout, type scale, colours and intro; differences only where live data replaces the mock's sample content. Fix any drift in `globals.css` before committing.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "Build the homepage: hero counters, directions, ideas, events, live feed, campus network"
```

---

### Task C7: Section pages, Personal, Forum, About, profile and settings

**Files:**
- Create: `frontend/src/components/Topics.tsx`
- Create: `frontend/src/app/academic/page.tsx`, `international/page.tsx`, `community/page.tsx`, `personal/page.tsx`, `forum/page.tsx`, `about/page.tsx`
- Create: `frontend/src/app/profile/[id]/page.tsx`, `settings/page.tsx`
- Create: `frontend/src/components/settings/SettingsForm.tsx`, `AvatarUpload.tsx`, `LogoutEverywhere.tsx`
- Modify: `frontend/src/app/globals.css` (append)
- Test: `frontend/tests/e2e/personal.spec.ts`

**Interfaces:**
- Consumes:
  - C1–C6: `apiGet`, `apiFind`, `apiTry`, `getMe`, `api`, `ApiError`, `qs`, `isUuid`, `roleLabels`, `LocalTime`, `IdeaList`, `EventCard`, `FeedList`, `CampusList`, `useSubmit`, `Field`, `FormError`, types;
  - API:
    - `GET /api/ideas?mine=authored|voted|team`, `GET /api/events?going=true`, `GET /api/feed?mine=true` (401 for guests);
    - `GET /api/events?network_only=true`, `GET /api/events?category=…`, `GET /api/ideas?scope=network`, `GET /api/ideas?category=…`;
    - `GET /api/profiles/{id}` → `Profile` (`extended: false` while MongoDB is down), `GET /api/profiles/{id}/avatar`;
    - `GET|PUT /api/profiles/me {bio, languages[], interests[], links[], theme}`; validation errors use field names like `links.0`; `503` while MongoDB is down;
    - `PUT /api/profiles/me/avatar` multipart field `file` (PNG/JPEG/WebP, ≤ 2 MB; `413 avatar_too_large`, `422 avatar_bad_type`);
    - `POST /api/auth/logout-all`.
- Produces:
  - `<Topics title topics />` — a section's parts as plain text (never links);
  - routes `/academic`, `/international`, `/community`, `/personal`, `/forum`, `/about`, `/profile/[id]`, `/settings`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/personal.spec.ts`:

```ts
// Personal page, sections, profile settings, theme persistence and logging out everywhere.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, loginInBrowser, signUpInBrowser, skipIntro, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("guests get an invitation instead of a dashboard", async ({ page }) => {
  await page.goto("/personal");
  await expect(page.getByRole("heading", { name: "Your corner of the network" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Join" })).toBeVisible();
});

test("a member's own ideas show up on Personal", async ({ page }) => {
  await signUpInBrowser(page, uniqueEmail("personal"), "Pat Personal");
  const title = `Speaking club in Spanish ${Date.now() % 100000}`;
  const created = await page.request.post("/api/ideas", {
    headers: { Origin: BASE },
    data: { title, summary: "A weekly hour of Spanish conversation for every level.", category: "club", scope: "network" },
  });
  expect(created.status()).toBe(201);
  await page.goto("/personal");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "My ideas" }) })).toContainText(title);
  await expect(page.getByText("You do not support any ideas yet.")).toBeVisible();
});

test("section pages list their parts as text, not links", async ({ page }) => {
  const parts = [["/academic", "Schedule"], ["/international", "Scholarships"], ["/community", "Speaking Club"], ["/personal", "Achievements"]];
  for (const [path, part] of parts) {
    await page.goto(path);
    await expect(page.getByRole("main").getByText(part, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: part })).toHaveCount(0);
  }
  await page.goto("/forum");
  await page.getByRole("link", { name: "Discuss an idea" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas`);
});

test("profile settings are saved and shown on the profile", async ({ page }) => {
  await signUpInBrowser(page, uniqueEmail("settings"), "Sam Settings");
  await page.goto("/settings");
  await page.getByLabel("About me").fill("Second-year student who loves languages.");
  await page.getByLabel("Languages you speak").fill("English, Kazakh");
  await page.getByLabel("Links").fill("https://example.org/sam");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.getByRole("button", { name: "Sam Settings" }).click();
  await page.getByRole("menuitem", { name: "My profile" }).click();
  await expect(page.getByText("Second-year student who loves languages.")).toBeVisible();
  await expect(page.getByText("Kazakh", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "example.org/sam" })).toHaveAttribute("rel", /nofollow/);
});

test("a bad link is explained next to the field", async ({ page }) => {
  await signUpInBrowser(page, uniqueEmail("badlink"), "Bo Badlink");
  await page.goto("/settings");
  await page.getByLabel("Links").fill("not a link");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.locator(".field-error")).toBeVisible();
  await expect(page.getByText("Saved.")).toHaveCount(0);
});

test("a guest's theme survives a reload without a flash", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "Switch colour theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // record the theme at the end of HTML parsing, before any React code runs
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { themeAtParse?: string }).themeAtParse = document.documentElement.dataset.theme;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { themeAtParse?: string }).themeAtParse)).toBe("light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 242, 238)");
});

test("a member's theme follows them to another browser", async ({ page, browser }) => {
  const email = uniqueEmail("theme");
  await signUpInBrowser(page, email, "Theo Theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "Switch colour theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(async () => (await (await page.request.get("/api/profiles/me")).json()).theme).toBe("light");
  const other = await browser.newContext({ colorScheme: "dark" });
  const otherPage = await other.newPage();
  await skipIntro(otherPage);
  await loginInBrowser(otherPage, email, PASSWORD);
  await otherPage.goto("/");
  await expect(otherPage.locator("html")).toHaveAttribute("data-theme", "light");
  await other.close();
});

test("log out on all devices", async ({ page, browser }) => {
  const email = uniqueEmail("everywhere");
  await signUpInBrowser(page, email, "Eve Everywhere");
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await skipIntro(otherPage);
  await loginInBrowser(otherPage, email, PASSWORD);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Log out on all devices" }).click();
  await expect(page).toHaveURL(`${BASE}/`);
  await otherPage.goto("/personal");
  await expect(otherPage.getByRole("heading", { name: "Your corner of the network" })).toBeVisible();
  await other.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx playwright test personal.spec.ts`
Expected: FAIL — `/personal` is a 404.

- [ ] **Step 3: Styles and the Topics component**

Append to `frontend/src/app/globals.css`:

```css

/* section pages */
.topics ul { list-style: none; padding: 0; margin: 24px 0 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 16px; }
.topics li { border-top: 1px solid var(--border); padding-top: 12px; }
.topics b { display: block; margin-bottom: 4px; }
.topics span { color: var(--muted); font-size: 15px; }
.topics > p { color: var(--muted); margin: 12px 0 0; max-width: 60ch; }
.rules { padding-left: 20px; display: grid; gap: 10px; max-width: 70ch; }

/* profile and settings */
.profile-head { display: flex; gap: 24px; align-items: center; flex-wrap: wrap; }
.tags { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 0; margin: 8px 0 0; }
.tags li { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--border); font-size: 14px; }
.avatar-field { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.file-input:focus-visible + label { outline: 2px solid var(--accent-text); outline-offset: 3px; }
.settings-block { padding: 32px 0; border-top: 1px solid var(--border); }
.settings-block h2 { font-size: 22px; margin-bottom: 16px; }
.form fieldset[disabled] { opacity: .6; }
```

`frontend/src/components/Topics.tsx`:

```tsx
// What a section covers. Plain text on purpose: these parts are described here, not linked, until they exist.
// This work made by Anfinogentov Nikita

export function Topics({ title, intro, topics }: { title: string; intro?: string; topics: [string, string][] }) {
  return (
    <div className="topics">
      <h2>{title}</h2>
      {intro && <p>{intro}</p>}
      <ul>
        {topics.map(([name, text]) => (
          <li key={name}><b>{name}</b><span>{text}</span></li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Section pages**

`frontend/src/app/academic/page.tsx`:

```tsx
// Academic: what the section covers, plus academic and research ideas and their events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { qs } from "@/lib/query";
import { apiGet, apiTry } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Academic" };

const topics: [string, string][] = [
  ["Schedule", "Class times across campuses, with changes in one place."],
  ["Courses", "Course pages where students share what to expect."],
  ["Professors", "Office hours and how to reach teaching staff."],
  ["Resources", "Study guides students write and share themselves."],
  ["Deadlines", "Submissions and exam dates you should not miss."],
];

export default async function AcademicPage() {
  const categories = ["academic", "research"];
  const [ideas, events] = await Promise.all([
    apiGet<Page<IdeaCard>>(`/api/ideas${qs({ category: categories, sort: "trending", limit: 6 })}`),
    apiTry<Page<EventItem>>(`/api/events${qs({ category: categories, limit: 4 })}`),
  ]);
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Academic</p>
        <h1>Study together across campuses</h1>
        <p>The academic side of the network: how studying works on each campus, and what students build together beyond classes.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. Academic ideas and events below already work." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Academic and research ideas</h2></div>
          <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
        </div>
        <IdeaList ideas={ideas.items} empty={<>No academic ideas yet. <Link href="/ideas/new">Propose the first one</Link>.</>} />
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>Academic events</h2></div></div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
```

`frontend/src/app/international/page.tsx`:

```tsx
// International: what the section covers, the campus network, network-wide ideas and events.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { CampusList } from "@/components/CampusList";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry } from "@/lib/server-api";
import type { Campus, EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "International" };

const topics: [string, string][] = [
  ["Learning portals", "The learning platforms each campus uses, in one list."],
  ["Exchange opportunities", "Semesters and summer schools at other campuses."],
  ["Scholarships", "Funding students can apply for, with deadlines."],
  ["Conferences", "Student conferences and calls for papers."],
  ["International events", "Events open to every campus in the network."],
];

export default async function InternationalPage() {
  const [campuses, ideas, events] = await Promise.all([
    apiTry<Campus[]>("/api/campuses"),
    apiGet<Page<IdeaCard>>("/api/ideas?scope=network&sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?network_only=true&limit=4"),
  ]);
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">International</p>
        <h1>One network, many campuses</h1>
        <p>Students from different universities and countries, sharing what they know and building things together.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. The campus network, shared ideas and events below already work." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Campus network</h2></div>
          <Link className="btn" href="/request-campus">Add your university</Link>
        </div>
        {campuses && campuses.length > 0 ? (
          <CampusList campuses={campuses} />
        ) : (
          <p className="empty">The first campuses are joining now. <Link href="/request-campus">Ask us to add yours</Link>.</p>
        )}
      </section>
      <section>
        <div className="section-head"><div><h2>Ideas for the whole network</h2></div></div>
        <IdeaList ideas={ideas.items} empty={<>No network-wide ideas yet. <Link href="/ideas/new">Propose one</Link>.</>} />
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>International events</h2></div></div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
```

`frontend/src/app/community/page.tsx`:

```tsx
// Community: what the section covers, student ideas, events and the review queue for Student Government.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiGet, apiTry, getMe } from "@/lib/server-api";
import type { EventItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Community" };

const topics: [string, string][] = [
  ["Speaking Club", "Regular conversation practice across campuses."],
  ["Volunteering", "Projects that need hands, on campus and around it."],
  ["Student Government", "Who represents students and what they decide."],
  ["Student Voice", "Ideas and feedback from students, gathered in one place."],
  ["Campus events", "What is happening on each campus."],
];

export default async function CommunityPage() {
  const [me, ideas, events] = await Promise.all([
    getMe(),
    apiGet<Page<IdeaCard>>("/api/ideas?sort=trending&limit=6"),
    apiTry<Page<EventItem>>("/api/events?limit=4"),
  ]);
  const reviewer = me?.status === "active" && (me.role === "student_gov" || me.role === "admin");
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Community</p>
        <h1>Student ideas, real initiatives</h1>
        <p>Students propose, the network supports, Student Government reviews, and teams turn ideas into events.</p>
      </div>
      <section>
        <Topics title="What this section covers" intro="These parts open one by one. Student Voice works today as ideas and events, below." topics={topics} />
      </section>
      <section>
        <div className="section-head">
          <div><p className="eyebrow">Working now</p><h2>Trending ideas</h2></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {reviewer && <Link className="btn" href="/review">Review queue</Link>}
            <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
          </div>
        </div>
        <IdeaList ideas={ideas.items} empty={<>No ideas yet. <Link href="/ideas/new">Propose the first one</Link>.</>} />
        <Link className="link-more" href="/ideas">All ideas →</Link>
      </section>
      {events && events.items.length > 0 && (
        <section>
          <div className="section-head">
            <div><h2>Coming up</h2></div>
            <Link className="btn" href="/events">All events</Link>
          </div>
          <div className="events">{events.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        </section>
      )}
    </div>
  );
}
```

`frontend/src/app/personal/page.tsx`:

```tsx
// Personal: an invitation for guests; for members their ideas, support, teams, events and activity.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { EventCard } from "@/components/EventCard";
import { FeedList } from "@/components/FeedList";
import { IdeaList } from "@/components/IdeaList";
import { Topics } from "@/components/Topics";
import { apiTry, getMe } from "@/lib/server-api";
import type { EventItem, FeedItem, IdeaCard, Page } from "@/lib/types";

export const metadata: Metadata = { title: "Personal" };

const topics: [string, string][] = [
  ["Notifications", "Updates about your ideas, teams and events."],
  ["Activity history", "Everything you did on the network, in order."],
  ["Achievements", "Milestones such as your first idea that became an event."],
  ["Digital portfolio", "Your projects and teams, ready to share."],
];

export default async function PersonalPage() {
  const me = await getMe();
  if (!me) {
    return (
      <div className="wrap">
        <div className="page-head">
          <p className="eyebrow">Personal</p>
          <h1>Your corner of the network</h1>
          <p>Your ideas, the ideas you support, your teams and your events, in one place.</p>
          <p style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/join">Join</Link>
            <Link className="btn" href="/login?next=/personal">Log in</Link>
          </p>
        </div>
        <section><Topics title="What this section covers" topics={topics} /></section>
      </div>
    );
  }
  if (me.status === "pending") {
    return (
      <div className="wrap">
        <div className="page-head">
          <p className="eyebrow">Personal</p>
          <h1>Hi, {me.display_name}</h1>
          <p>Confirm your e-mail to propose ideas, support them and join teams.</p>
          <p><Link className="btn btn-primary" href="/verify">Confirm your e-mail</Link></p>
        </div>
      </div>
    );
  }

  const [authored, voted, teams, going, activity] = await Promise.all([
    apiTry<Page<IdeaCard>>("/api/ideas?mine=authored&limit=12"),
    apiTry<Page<IdeaCard>>("/api/ideas?mine=voted&limit=12"),
    apiTry<Page<IdeaCard>>("/api/ideas?mine=team&limit=12"),
    apiTry<Page<EventItem>>("/api/events?going=true&limit=8"),
    apiTry<Page<FeedItem>>("/api/feed?mine=true&limit=12"),
  ]);
  return (
    <div className="wrap">
      <div className="page-head section-head">
        <div>
          <p className="eyebrow">Personal</p>
          <h1>Hi, {me.display_name}</h1>
          <p>{me.campus_label ? `${me.campus_label} · ` : ""}Your ideas, support, teams and events.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn" href={`/profile/${me.id}`}>My profile</Link>
          <Link className="btn" href="/settings">Settings</Link>
        </div>
      </div>
      <section>
        <div className="section-head">
          <div><h2>My ideas</h2></div>
          <Link className="btn btn-primary" href="/ideas/new">Propose an idea</Link>
        </div>
        <IdeaList ideas={authored?.items ?? []} empty={<>You have not proposed anything yet. <Link href="/ideas/new">Propose an idea</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>Ideas I support</h2></div></div>
        <IdeaList ideas={voted?.items ?? []} empty={<>You do not support any ideas yet. <Link href="/ideas?sort=closest">See ideas close to review</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>My teams</h2></div></div>
        <IdeaList ideas={teams?.items ?? []} empty={<>You are not in a team yet. Approved ideas look for people on the <Link href="/ideas">ideas page</Link>.</>} />
      </section>
      <section>
        <div className="section-head"><div><h2>Events I&apos;m going to</h2></div></div>
        {going && going.items.length > 0 ? (
          <div className="events">{going.items.map((event) => <EventCard key={event.id} event={event} />)}</div>
        ) : (
          <p className="empty">No events yet. <Link href="/events">See what is coming up</Link>.</p>
        )}
      </section>
      {activity && activity.items.length > 0 && (
        <section>
          <div className="section-head"><div><h2>My activity</h2></div></div>
          <FeedList items={activity.items} />
        </section>
      )}
    </div>
  );
}
```

`frontend/src/app/forum/page.tsx`:

```tsx
// Forum: what it is for, the community rules, and where discussions happen today.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Forum" };

export default function ForumPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">Forum</p>
        <h1>An international student forum</h1>
        <p>
          A place where students from every campus talk about studying, life abroad and what to build next. Today the
          conversation happens around ideas: each idea collects support, feedback from Student Government and a team.
        </p>
        <p><Link className="btn btn-primary" href="/ideas">Discuss an idea</Link></p>
      </div>
      <section>
        <h2>Community rules</h2>
        <ol className="rules">
          <li>Be kind and assume good intent. People write from many countries and in their second or third language.</li>
          <li>Use English in shared spaces so every campus can follow.</li>
          <li>Share your own words, photos and work. Do not post course materials, paid content or anything you do not have the rights to; link to the source instead.</li>
          <li>Do not publish other people&apos;s personal data: contacts, documents, grades.</li>
          <li>No advertising, spam or fundraising for third parties.</li>
          <li>Report what breaks these rules with the report link on the idea page; the admins review every report.</li>
        </ol>
      </section>
    </div>
  );
}
```

`frontend/src/app/about/page.tsx`:

```tsx
// About ModernSI, with the independence statement.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">About</p>
        <h1>What ModernSI is</h1>
        <p>An independent network where students from different campuses share experience and knowledge, and turn their ideas into real activities.</p>
      </div>
      <section className="prose" style={{ maxWidth: "70ch" }}>
        <h2>How it works</h2>
        <p>
          Students join with their university e-mail; the e-mail domain shows which campus they belong to. Anyone can read
          ideas and events. Members propose ideas and support each other&apos;s. When an idea gathers enough support,
          Student Government reviews it. Approved ideas gather a team, and the team puts the idea on the Hub as an event.
        </p>
        <h2>Who can join</h2>
        <p>
          Students of universities whose e-mail domains are on the network. If yours is not, <Link href="/request-campus">ask us to add it</Link>.
        </p>
        <h2>Independence</h2>
        <p>ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.</p>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Profile and settings**

`frontend/src/app/profile/[id]/page.tsx`:

```tsx
// Public profile: name, campus, role, bio, languages, interests and links.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { roleLabels } from "@/lib/format";
import { isUuid } from "@/lib/query";
import { apiFind, apiTry, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = isUuid(id) ? await apiTry<Profile>(`/api/profiles/${id}`) : null;
  return { title: profile?.display_name ?? "Profile" };
}

export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [profile, me] = await Promise.all([apiFind<Profile>(`/api/profiles/${id}`), getMe()]);
  if (!profile) notFound();

  return (
    <div className="wrap detail">
      <div className="page-head profile-head">
        {profile.has_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar-lg" src={`/api/profiles/${profile.id}/avatar`} alt="" />
        ) : (
          <span className="avatar avatar-lg" aria-hidden="true">{profile.display_name.slice(0, 1).toUpperCase()}</span>
        )}
        <div>
          <h1>{profile.display_name}</h1>
          <p>
            {profile.campus_label ?? "ModernSI"}
            {profile.role !== "student" && <> · <span className="badge badge-accent">{roleLabels[profile.role]}</span></>}
            {" · "}joined <LocalTime iso={profile.joined_at} mode="date" />
          </p>
          {me?.id === profile.id && <p><Link className="btn btn-small" href="/settings">Edit profile</Link></p>}
        </div>
      </div>
      {!profile.extended && <p className="notice">Some profile details are unavailable right now. Try again in a few minutes.</p>}
      {profile.bio && <p className="prose" style={{ maxWidth: "65ch", fontSize: 18 }}>{profile.bio}</p>}
      {profile.languages.length > 0 && (
        <section className="settings-block">
          <h2>Languages</h2>
          <ul className="tags">{profile.languages.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {profile.interests.length > 0 && (
        <section className="settings-block">
          <h2>Interests</h2>
          <ul className="tags">{profile.interests.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
      )}
      {profile.links.length > 0 && (
        <section className="settings-block">
          <h2>Links</h2>
          <ul className="team-list">
            {profile.links.map((link) => (
              <li key={link}><a href={link} target="_blank" rel="nofollow ugc noopener noreferrer">{link.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

`frontend/src/components/settings/SettingsForm.tsx`:

```tsx
// Profile settings: bio, languages, interests, links and theme. The theme applies at once.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client-api";
import type { Profile } from "@/lib/types";
import { Field } from "../forms/Field";
import { FormError } from "../forms/FormError";
import { useSubmit } from "../forms/useSubmit";

type Theme = Profile["theme"];

function split(value: string, separator: RegExp): string[] {
  return value.split(separator).map((item) => item.trim()).filter(Boolean);
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem("msi_theme");
    else localStorage.setItem("msi_theme", theme);
  } catch {
    // storage blocked: the profile still keeps the choice
  }
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const { pending, error, run } = useSubmit();
  const [bio, setBio] = useState(profile.bio);
  const [languages, setLanguages] = useState(profile.languages.join(", "));
  const [interests, setInterests] = useState(profile.interests.join(", "));
  const [links, setLinks] = useState(profile.links.join("\n"));
  const [theme, setTheme] = useState<Theme>(profile.theme);
  const [saved, setSaved] = useState(false);

  // list fields come back as "links.0", "languages.3" and so on
  const listError = (name: string) => error?.fields.find((item) => item.field === name || item.field.startsWith(`${name}.`))?.message;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    run(async () => {
      await api("/api/profiles/me", {
        method: "PUT",
        json: { bio, languages: split(languages, /,/), interests: split(interests, /,/), links: split(links, /\s+/), theme },
      });
      applyTheme(theme);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      {!profile.extended && <p className="notice">Profile details cannot be edited right now. Try again in a few minutes.</p>}
      <fieldset disabled={!profile.extended} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 18 }}>
        <FormError error={error} />
        {saved && <p className="notice" role="status">Saved.</p>}
        <Field label="About me" multiline rows={4} maxLength={500} hint="Up to 500 characters." value={bio} onChange={(event) => setBio(event.target.value)} error={listError("bio")} />
        <Field label="Languages you speak" hint="Separate with commas, up to 10." value={languages} onChange={(event) => setLanguages(event.target.value)} error={listError("languages")} />
        <Field label="Interests" hint="Separate with commas, up to 15." value={interests} onChange={(event) => setInterests(event.target.value)} error={listError("interests")} />
        <Field label="Links" multiline rows={3} hint="One per line, up to 5: portfolio, code, social profiles." value={links} onChange={(event) => setLinks(event.target.value)} error={listError("links")} />
        <div className="field">
          <fieldset>
            <legend>Theme</legend>
            {(["system", "light", "dark"] as Theme[]).map((value) => (
              <label key={value} className="radio">
                <input type="radio" name="theme" value={value} checked={theme === value} onChange={() => setTheme(value)} />
                {value === "system" ? "Follow my device" : value === "light" ? "Light" : "Dark"}
              </label>
            ))}
          </fieldset>
        </div>
        <div className="actions">
          <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        </div>
      </fieldset>
    </form>
  );
}
```

`frontend/src/components/settings/AvatarUpload.tsx`:

```tsx
// Profile photo upload. Size is checked here first so a big file does not travel for nothing.
// This work made by Anfinogentov Nikita
"use client";
import { useId, useState } from "react";
import { api } from "@/lib/client-api";
import { ApiError } from "@/lib/errors";
import { useSubmit } from "../forms/useSubmit";

const maxBytes = 2 * 1024 * 1024;

export function AvatarUpload({ userId, hasAvatar, name }: { userId: string; hasAvatar: boolean; name: string }) {
  const id = useId();
  const { pending, error, run, setError } = useSubmit();
  const [preview, setPreview] = useState<string | null>(hasAvatar ? `/api/profiles/${userId}/avatar` : null);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > maxBytes) {
      setError(new ApiError(413, "avatar_too_large", "The picture must be 2 MB or smaller."));
      return;
    }
    run(async () => {
      const form = new FormData();
      form.append("file", file);
      await api("/api/profiles/me/avatar", { method: "PUT", form });
      setPreview(URL.createObjectURL(file));
    });
  }

  return (
    <div className="stack">
      <div className="avatar-field">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar-lg" src={preview} alt="" />
        ) : (
          <span className="avatar avatar-lg" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
        )}
        <input id={id} className="sr-only file-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={onChange} disabled={pending} />
        <label className="btn btn-small" htmlFor={id}>{pending ? "Uploading…" : preview ? "Change photo" : "Upload a photo"}</label>
      </div>
      <p className="hint">PNG, JPEG or WebP, up to 2 MB.</p>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

`frontend/src/components/settings/LogoutEverywhere.tsx`:

```tsx
// Ends every session of this account, on all devices.
// This work made by Anfinogentov Nikita
"use client";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { useSubmit } from "../forms/useSubmit";

export function LogoutEverywhere() {
  const router = useRouter();
  const { pending, error, run } = useSubmit();

  function logoutAll() {
    run(async () => {
      await api("/api/auth/logout-all", { method: "POST" });
      router.push("/");
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <button className="btn" type="button" onClick={logoutAll} disabled={pending}>Log out on all devices</button>
      {error && <p className="field-error" role="alert">{error.message}</p>}
    </div>
  );
}
```

`frontend/src/app/settings/page.tsx`:

```tsx
// Settings: photo, profile details, theme and sessions.
// This work made by Anfinogentov Nikita
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/settings/AvatarUpload";
import { LogoutEverywhere } from "@/components/settings/LogoutEverywhere";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { apiGet, getMe } from "@/lib/server-api";
import type { Profile } from "@/lib/types";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect("/login?next=/settings");
  if (me.status === "pending") redirect("/verify");
  const profile = await apiGet<Profile>("/api/profiles/me");
  return (
    <div className="wrap auth">
      <p className="breadcrumbs"><Link href={`/profile/${me.id}`}>{me.display_name}</Link> / Settings</p>
      <h1>Settings</h1>
      <p className="lead-sm">Signed in as {me.email}{me.campus_label ? ` · ${me.campus_label}` : ""}.</p>
      <div className="settings-block">
        <h2>Profile photo</h2>
        <AvatarUpload userId={me.id} hasAvatar={profile.has_avatar} name={me.display_name} />
      </div>
      <div className="settings-block">
        <h2>About you</h2>
        <SettingsForm profile={profile} />
      </div>
      <div className="settings-block">
        <h2>Sessions</h2>
        <p className="muted">Lost a phone or used a shared computer? This logs you out everywhere, including here.</p>
        <LogoutEverywhere />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run tests**

Run: `cd frontend && npx tsc --noEmit && npx playwright test personal.spec.ts shell.spec.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add frontend
git commit -m "Add section pages, Personal, Forum, About, profiles and settings"
```

---

### Task C8: Audit, layout checks, README, final run

**Files:**
- Create: `frontend/scripts/audit.mjs`, `frontend/tests/e2e/audit.spec.ts`, `frontend/README.md`
- Create: `docs/superpowers/reports/stage1-audit.txt` (measured results, written by the commands in Step 6)
- Modify: `frontend/package.json` (scripts)

**Interfaces:**
- Consumes: the whole site from C1–C7; `design/mock/intro.js`; `design/mock/contrast.py <path>` from C1.
- Produces:
  - `npm run audit:site` — exits 1 and lists `file:line` for every brand word, placeholder word, forbidden colour or font, empty link, or an engine copy that differs from the mock;
  - `npm run test:e2e`.

- [ ] **Step 1: Write the failing test**

`frontend/tests/e2e/audit.spec.ts`:

```ts
// Delivery checks in the browser: every internal link answers, no empty links, the mobile menu works,
// and no page scrolls sideways at 360 px in either theme.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { STAFF, apiLogin, apiUser, skipIntro } from "./helpers";

const pages = ["/", "/ideas", "/events", "/academic", "/international", "/community", "/personal", "/forum", "/about", "/join", "/login", "/forgot", "/request-campus"];

test.beforeEach(async ({ page }) => skipIntro(page));

test("every internal link on the main pages answers without an error", async ({ page }) => {
  // some content first, so idea, event and profile links are crawled too
  const student = await apiUser("Audit Student");
  await student.context.post("/api/ideas", {
    data: { title: "Open data hackathon", summary: "A weekend of building with open city data.", category: "research", scope: "network" },
  });
  await student.context.dispose();
  const curator = await apiLogin(STAFF.curator, STAFF.password);
  const startsAt = new Date(Date.now() + 5 * 86_400_000);
  await curator.post("/api/events", {
    data: { title: "CV clinic with alumni", starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(), location_text: "Room 204", scope: "network" },
  });
  await curator.dispose();

  const found = new Set<string>();
  for (const path of pages) {
    await page.goto(path);
    expect(await page.locator('a[href="#"], a[href=""], a:not([href])').count(), `empty links on ${path}`).toBe(0);
    const hrefs = await page.locator("a[href^='/']").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
    hrefs.forEach((href) => found.add(href));
  }
  expect(found.size).toBeGreaterThan(20);
  for (const href of found) {
    const response = await page.request.get(href, { maxRedirects: 5 });
    expect(response.status(), href).toBeLessThan(400);
  }
});

test("the mobile menu opens with the five items and closes on navigation", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: "Main" });
  for (const item of ["Academic", "International", "Community", "Personal", "Forum"]) {
    await expect(nav.getByRole("link", { name: item })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Forum" }).click();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
});

for (const scheme of ["light", "dark"] as const) {
  test(`no horizontal scroll at 360 px, ${scheme} theme`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of pages) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
```

`frontend/scripts/audit.mjs`:

```js
// Pre-delivery audit of the site sources: brand ban, placeholder words, forbidden colours and fonts,
// empty links, and the intro engine being the exact file approved in the mock.
// This work made by Anfinogentov Nikita
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanned = ["src", "public"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".svg", ".json", ".md"]);
const forbiddenHex = ["AB0520", "0C234B", "001C48", "1E5288", "8B0015", "EF4056", "81D3EB", "378DBD", "007D84", "70B865", "A95C42"];

// the same colours written as rgb()/rgba()
const forbiddenRgb = forbiddenHex.map((hex) => {
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  return `rgba?\\(\\s*${r}\\s*,\\s*${g}\\s*,\\s*${b}\\b`;
});

const checks = [
  { name: "brand word", pattern: /arizona|wildcats?|bear\s*down|\buofa\b/i },
  { name: "placeholder word", pattern: /lorem|ipsum|coming soon|\bTBD\b|\bTODO\b|\bFIXME\b/i },
  { name: "forbidden colour", pattern: new RegExp(`#(${forbiddenHex.join("|")})\\b`, "i") },
  { name: "forbidden colour", pattern: new RegExp(forbiddenRgb.join("|"), "i") },
  { name: "forbidden font", pattern: /proxima\s*nova|\bmilo\b/i },
  { name: "empty link", pattern: /href=(["'])#?\1|href=\{\s*(["'])#?\2\s*\}/ },
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return extensions.has(extname(path)) ? [path] : [];
  });
}

const problems = [];
const files = scanned.flatMap((dir) => walk(join(root, dir)));
for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    for (const check of checks) {
      if (check.pattern.test(line)) problems.push(`${relative(root, file)}:${index + 1}: ${check.name}: ${line.trim().slice(0, 120)}`);
    }
  });
}

const engine = readFileSync(join(root, "src/components/intro/engine.js"));
const mock = readFileSync(join(root, "../design/mock/intro.js"));
if (!engine.equals(mock)) problems.push("src/components/intro/engine.js: differs from design/mock/intro.js");

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\naudit failed: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log(`audit clean: ${files.length} files checked, engine matches the mock`);
```

Add the scripts:

```bash
cd frontend && npm pkg set scripts.audit:site="node scripts/audit.mjs" scripts.test:e2e="playwright test"
```

- [ ] **Step 2: Run the checks**

Run: `cd frontend && npm run audit:site && npx playwright test audit.spec.ts`
Expected:
- the audit prints `audit clean: … files checked, engine matches the mock`;
- 4 tests pass.

If the audit or a test fails, fix the page or component it names; do not loosen the check.

- [ ] **Step 3: Prove the audit catches problems**

Run (from `frontend/`):
```bash
echo '// lorem' >> src/lib/query.ts && npm run audit:site; git checkout src/lib/query.ts
```
Expected: exit code 1 and a line `src/lib/query.ts:…: placeholder word: // lorem`; after `git checkout` the file is back. (Commit C7 first so `git checkout` restores the committed file.)

- [ ] **Step 4: Frontend README**

`frontend/README.md`:

````markdown
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
````

- [ ] **Step 5: Final verification**

Stop anything using the test stores (backend pytest), then run from the repo root:

```bash
cd frontend && npx tsc --noEmit && npm run build && npm run audit:site
python3 ../design/mock/contrast.py src/app/tokens.css
docker compose -f ../infra/docker-compose.test.yml up -d --wait
npx playwright test
cd ../backend && uv run pytest -q
```
Expected:
- `tsc` prints nothing, and the build compiles;
- the audit is clean, and contrast reports `all pairs pass`;
- every Playwright test passes (shell, intro, auth, ideas, events, home, personal, audit);
- the backend suite passes. It runs after Playwright has finished, never at the same time.

- [ ] **Step 6: Record the measured results**

Run from the repo root:

```bash
mkdir -p docs/superpowers/reports
{
  echo "# Stage 1 audit — $(date -u +%Y-%m-%dT%H:%MZ)"
  echo; echo "## Source audit"; (cd frontend && npm run --silent audit:site)
  echo; echo "## Token contrast"; python3 design/mock/contrast.py frontend/src/app/tokens.css
  echo; echo "## End-to-end"; (cd frontend && npx playwright test --reporter=line 2>&1 | tail -n 5)
} > docs/superpowers/reports/stage1-audit.txt
cat docs/superpowers/reports/stage1-audit.txt
```
Expected: the file shows a clean audit, `all pairs pass` and a Playwright summary with 0 failed. This file is the measured result that section 12 of the spec asks to attach to the stage delivery.

- [ ] **Step 7: Commit**

```bash
git add frontend docs/superpowers/reports
git commit -m "Add the delivery audit, layout checks and the frontend README"
```
