// Every route of the site, in both themes and on a desktop and a phone: axe (wcag2a and wcag2aa) finds nothing, the page does not scroll
// sideways, nothing sticks out of the screen unseen, and the console has no errors or warnings (so no hydration mismatch).
// With SHOTS_DIR set it also saves a full-page screenshot per route, theme and viewport, and a summary of what axe found.
// This work made by Anfinogentov Nikita
import AxeBuilder from "@axe-core/playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, request, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiLogin, apiUser, skipIntro, uniqueEmail } from "./helpers";

type Storage = BrowserContextOptions["storageState"];
type Who = "guest" | "author" | "member" | "pending" | "gov" | "curator";
type Group = "home" | "ideas" | "events" | "sections" | "account" | "auth" | "errors";
type Route = { name: string; group: Group; who: Who; path: () => string; base?: () => string; quietConsole?: boolean };
type Result = { route: string; group: Group; who: Who; theme: string; viewport: string; status: number; violations: string[]; incomplete: string[]; overflow: number; clipped: string[]; console: string[] };

const shotsDir = process.env.SHOTS_DIR;
const themes = ["light", "dark"] as const;
const viewports = [
  { label: "desktop", size: { width: 1440, height: 900 } },
  { label: "phone", size: { width: 390, height: 844 } },
] as const;
const people: Who[] = ["guest", "author", "member", "pending", "gov", "curator"];

const ids = { author: "", open: "", review: "", changes: "", rejected: "", team: "", live: "", cyrillic: "", running: "", upcoming: "", online: "", past: "", liveEvent: "", missing: "00000000-0000-4000-8000-000000000000" };
const states = {} as { [key in Who]: Storage };
// a second production server whose API is down, to see the error page
let downServer: ChildProcess | undefined;
const downPort = 3104;
const records: Result[] = [];

const idea = (key: keyof typeof ids) => () => `/ideas/${ids[key]}`;
const event = (key: keyof typeof ids) => () => `/events/${ids[key]}`;
const fixed = (value: string) => () => value;

const routes: Route[] = [
  { name: "home", group: "home", who: "guest", path: fixed("/") },
  { name: "home-member", group: "home", who: "member", path: fixed("/") },

  { name: "ideas", group: "ideas", who: "guest", path: fixed("/ideas") },
  { name: "ideas-filtered", group: "ideas", who: "guest", path: fixed("/ideas?sort=closest&category=club") },
  { name: "ideas-empty", group: "ideas", who: "guest", path: fixed("/ideas?category=volunteering") },
  { name: "idea-open", group: "ideas", who: "guest", path: idea("open") },
  { name: "idea-open-member", group: "ideas", who: "member", path: idea("open") },
  { name: "idea-open-author", group: "ideas", who: "author", path: idea("open") },
  { name: "idea-review", group: "ideas", who: "guest", path: idea("review") },
  { name: "idea-review-gov", group: "ideas", who: "gov", path: idea("review") },
  { name: "idea-changes-author", group: "ideas", who: "author", path: idea("changes") },
  { name: "idea-rejected", group: "ideas", who: "guest", path: idea("rejected") },
  { name: "idea-team-member", group: "ideas", who: "member", path: idea("team") },
  { name: "idea-team-author", group: "ideas", who: "author", path: idea("team") },
  { name: "idea-live", group: "ideas", who: "guest", path: idea("live") },
  { name: "idea-cyrillic", group: "ideas", who: "guest", path: idea("cyrillic") },
  { name: "idea-new", group: "ideas", who: "member", path: fixed("/ideas/new") },
  { name: "idea-new-guest", group: "ideas", who: "guest", path: fixed("/ideas/new") },
  { name: "idea-edit", group: "ideas", who: "author", path: () => `/ideas/${ids.open}/edit` },
  { name: "idea-edit-changes", group: "ideas", who: "author", path: () => `/ideas/${ids.changes}/edit` },
  { name: "review-gov", group: "ideas", who: "gov", path: fixed("/review") },
  { name: "review-guest", group: "ideas", who: "guest", path: fixed("/review") },

  { name: "events", group: "events", who: "guest", path: fixed("/events") },
  { name: "events-past", group: "events", who: "guest", path: fixed("/events?when=past") },
  { name: "events-curator", group: "events", who: "curator", path: fixed("/events") },
  { name: "event-running", group: "events", who: "guest", path: event("running") },
  { name: "event-upcoming-member", group: "events", who: "member", path: event("upcoming") },
  { name: "event-online", group: "events", who: "guest", path: event("online") },
  { name: "event-from-idea", group: "events", who: "guest", path: event("liveEvent") },
  { name: "event-past", group: "events", who: "guest", path: event("past") },
  { name: "event-new", group: "events", who: "curator", path: fixed("/events/new") },
  { name: "event-new-idea", group: "events", who: "curator", path: () => `/events/new?idea=${ids.team}` },
  { name: "event-new-guest", group: "events", who: "guest", path: fixed("/events/new") },

  { name: "academic", group: "sections", who: "guest", path: fixed("/academic") },
  { name: "international", group: "sections", who: "guest", path: fixed("/international") },
  { name: "community", group: "sections", who: "guest", path: fixed("/community") },
  { name: "forum", group: "sections", who: "guest", path: fixed("/forum") },
  { name: "about", group: "sections", who: "guest", path: fixed("/about") },
  { name: "personal-guest", group: "sections", who: "guest", path: fixed("/personal") },

  { name: "personal-author", group: "account", who: "author", path: fixed("/personal") },
  { name: "personal-pending", group: "account", who: "pending", path: fixed("/personal") },
  { name: "settings", group: "account", who: "author", path: fixed("/settings") },
  { name: "profile", group: "account", who: "guest", path: () => `/profile/${ids.author}` },
  { name: "profile-own", group: "account", who: "author", path: () => `/profile/${ids.author}` },

  { name: "join", group: "auth", who: "guest", path: fixed("/join") },
  { name: "login", group: "auth", who: "guest", path: fixed("/login") },
  { name: "forgot", group: "auth", who: "guest", path: fixed("/forgot") },
  { name: "reset", group: "auth", who: "guest", path: fixed("/reset") },
  { name: "verify", group: "auth", who: "pending", path: fixed("/verify") },
  { name: "request-campus", group: "auth", who: "guest", path: fixed("/request-campus") },

  { name: "not-found", group: "errors", who: "guest", path: fixed("/no-such-page") },
  { name: "idea-not-found", group: "errors", who: "guest", path: () => `/ideas/${ids.missing}` },
  { name: "error-page", group: "errors", who: "guest", path: fixed("/ideas"), base: () => `http://localhost:${downPort}`, quietConsole: true },
];

// a student who registered but did not confirm the e-mail yet
async function pendingUser(name: string) {
  const context = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const registered = await context.post("/api/auth/register", { data: { email: uniqueEmail("pending"), password: PASSWORD, display_name: name } });
  expect(registered.status()).toBe(201);
  return context;
}

async function waitForNext(port: number) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`the Next server on ${port} did not start`);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const author = await apiUser("Routes Author");
  const member = await apiUser("Routes Member");
  const voters = [await apiUser("Routes Voter One"), await apiUser("Routes Voter Two")];
  const gov = await apiLogin(STAFF.gov, STAFF.password);
  const curator = await apiLogin(STAFF.curator, STAFF.password);
  const admin = await apiLogin(STAFF.admin, STAFF.password);
  const pending = await pendingUser("Routes Pending");
  ids.author = (await (await author.context.get("/api/auth/me")).json()).id;

  // a few more campuses, so the luggage tags of the homepage have company (a domain that exists already is fine)
  for (const [domain, label, country] of [["riga.example", "Riga", "LV"], ["bishkek.example", "Bishkek", "KG"], ["tbilisi.example", "Tbilisi", "GE"]]) {
    await admin.post("/api/admin/domains", { data: { domain, campus_label: label, country_code: country } });
  }

  const pitch = async (title: string, category: string, summary: string, body = "") => {
    const created = await author.context.post("/api/ideas", { data: { title, summary, category, scope: "network", body_md: body } });
    expect(created.status(), title).toBe(201);
    return (await created.json()).id as string;
  };
  const support = async (id: string, count: number) => {
    for (const voter of voters.slice(0, count)) expect((await voter.context.post(`/api/ideas/${id}/vote`)).status()).toBe(200);
  };
  const decide = async (id: string, decision: string, note: string) => expect((await gov.post(`/api/ideas/${id}/decision`, { data: { decision, note } })).status()).toBe(200);
  const body = "We need **two rooms** and a few volunteers.\n\n- a sign-up sheet\n- tea and snacks\n- one person at the door\n\nThe plan is to run it for four weeks, every Thursday after classes.";

  ids.open = await pitch("Peer tutoring hour before exams", "academic", "An hour of peer tutoring in the library before every exam week, run by students who passed the course.", body);
  await support(ids.open, 1);
  ids.review = await pitch("Open data hackathon", "research", "A weekend of building with open city data, open to every campus in the network.", body);
  await support(ids.review, 2);
  ids.changes = await pitch("Late library hours", "campus_life", "Keep the library open until midnight in exam weeks.", body);
  await support(ids.changes, 2);
  await decide(ids.changes, "needs_changes", "Say which weeks exactly, and who would unlock the doors.");
  ids.rejected = await pitch("Free parking for everyone", "campus_life", "Make parking free for all students on every campus.", "Short and sweet.");
  await support(ids.rejected, 2);
  await decide(ids.rejected, "reject", "Parking is not something Student Government can change.");
  ids.team = await pitch("Board games and tea evening", "club", "A quiet evening of board games in the student lounge, tea included.", body);
  await support(ids.team, 2);
  await decide(ids.team, "approve", "Great idea, go ahead.");
  expect((await voters[0].context.post(`/api/ideas/${ids.team}/team`)).status()).toBe(200);
  ids.live = await pitch("International food night", "event", "One evening, one table per country, a dish from home and its story.", body);
  await support(ids.live, 2);
  await decide(ids.live, "approve", "Approved, find a room.");
  expect((await voters[0].context.post(`/api/ideas/${ids.live}/team`)).status()).toBe(200);
  ids.cyrillic = await pitch("Совместный фестиваль студенческих инициатив", "event", "Один вечер, где каждый кампус показывает свой проект. Приходите и приводите друзей.", "Нужны **два зала** и несколько волонтёров.");
  await support(ids.cyrillic, 1);
  await pitch("Swap shelf for textbooks", "academic", "A shelf near the entrance where students swap textbooks between semesters.");

  const when = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
  const publish = async (data: object) => {
    const created = await curator.post("/api/events", { data });
    expect(created.status(), JSON.stringify(data)).toBe(201);
    return (await created.json()).id as string;
  };
  // the running and the past event start in a moment: an event cannot start in the past when it is created
  ids.running = await publish({ title: "Conversation night", starts_at: when(0.04), ends_at: when(120), location_text: "Student lounge", scope: "network", description_md: "Meet people from other campuses. **Bring a friend** and a story." });
  ids.past = await publish({ title: "Welcome evening", starts_at: when(0.04), ends_at: when(0.06), location_text: "Main hall", scope: "network", description_md: "The first evening of the term." });
  ids.upcoming = await publish({ title: "Open mic and tea", starts_at: when(3 * 1440), ends_at: when(3 * 1440 + 90), location_text: "Room 204", scope: "network", description_md: "Five minutes each, any language.\n\n- sign up at the door\n- tea is free" });
  await publish({ title: "CV clinic with alumni", starts_at: when(9 * 1440), ends_at: when(9 * 1440 + 120), location_text: "Room 12", scope: "network" });
  ids.online = await publish({ title: "Study group on video", starts_at: when(5 * 1440), ends_at: when(5 * 1440 + 60), online_url: "https://meet.example.org/study-group", scope: "network", description_md: "Bring your questions." });
  const live = await curator.post("/api/events", { data: { title: "International food night", starts_at: when(6 * 1440), ends_at: when(6 * 1440 + 180), location_text: "Dining hall", scope: "network", idea_id: ids.live, description_md: "A table per country." } });
  expect(live.status()).toBe(201);
  ids.liveEvent = (await live.json()).id;
  // someone is going to the upcoming event, so the count reads like a real one
  expect((await voters[1].context.post(`/api/events/${ids.upcoming}/rsvp`)).status()).toBe(200);
  await new Promise((resolve) => setTimeout(resolve, 5_000));

  states.author = await author.context.storageState();
  states.member = await member.context.storageState();
  states.pending = await pending.storageState();
  states.gov = await gov.storageState();
  states.curator = await curator.storageState();
  states.guest = undefined;
  for (const context of [author.context, member.context, ...voters.map((voter) => voter.context), gov, curator, admin, pending]) await context.dispose();

  // the error page: a production server whose API does not answer
  downServer = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(downPort)], { env: { ...process.env, API_URL: "http://localhost:9" }, stdio: "ignore" });
  await waitForNext(downPort);
});

test.afterAll(() => {
  downServer?.kill();
  const groups = [...new Set(records.map((item) => item.group))];
  const lines = groups.map((group) => {
    const own = records.filter((item) => item.group === group);
    const count = (pick: (item: Result) => number) => own.reduce((sum, item) => sum + pick(item), 0);
    const routeNames = new Set(own.map((item) => item.route)).size;
    return `${group.padEnd(9)} routes ${String(routeNames).padStart(2)}  checks ${String(own.length).padStart(3)}  axe violations ${count((item) => item.violations.length)}  needs review ${count((item) => item.incomplete.length)}  scroll overflow ${count((item) => (item.overflow > 0 ? 1 : 0))}  clipped ${count((item) => item.clipped.length)}  console ${count((item) => item.console.length)}`;
  });
  const total = (pick: (item: Result) => number) => records.reduce((sum, item) => sum + pick(item), 0);
  lines.push(`total     routes ${new Set(records.map((item) => item.route)).size}  checks ${records.length}  axe violations ${total((item) => item.violations.length)}  needs review ${total((item) => item.incomplete.length)}  scroll overflow ${total((item) => (item.overflow > 0 ? 1 : 0))}  clipped ${total((item) => item.clipped.length)}  console ${total((item) => item.console.length)}`);
  const reasons = new Map<string, number>();
  for (const item of records) for (const entry of item.incomplete) reasons.set(entry.split(":")[0], (reasons.get(entry.split(":")[0]) ?? 0) + 1);
  lines.push(`axe needs review (nodes): ${[...reasons].map(([reason, count]) => `${reason} ${count}`).join(", ") || "none"}`);
  console.log(`\nroutes.spec summary\n${lines.join("\n")}`);
  if (shotsDir) {
    mkdirSync(shotsDir, { recursive: true });
    writeFileSync(path.join(shotsDir, "routes-summary.json"), JSON.stringify({ summary: lines, records }, null, 2));
  }
});

// everything the browser prints as an error or a warning; the failed request of a 404 page is the page itself, not a problem
function watchConsole(page: Page) {
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") logs.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
  return logs;
}

async function settle(page: Page) {
  await page.waitForFunction(() => window.msiStarted === true);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

// elements that stick out of the screen sideways and are not inside a box that scrolls or clips on purpose
function clippedOnTheSide() {
  const width = document.documentElement.clientWidth;
  const found: string[] = [];
  for (const element of document.querySelectorAll("body *")) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0 || (box.left >= -1 && box.right <= width + 1)) continue;
    let holder = element.parentElement;
    let held = false;
    while (holder && holder !== document.body) {
      if (getComputedStyle(holder).overflowX !== "visible") {
        held = true;
        break;
      }
      holder = holder.parentElement;
    }
    if (!held) found.push(`${element.tagName.toLowerCase()}${element.className && typeof element.className === "string" ? "." + element.className.trim().split(/\s+/).join(".") : ""} [${Math.round(box.left)}..${Math.round(box.right)} of ${width}]`);
  }
  return found.slice(0, 5);
}

async function visit(browser: Browser, who: Who, theme: (typeof themes)[number], viewport: (typeof viewports)[number], list: Route[]) {
  // the system scheme is the opposite of the chosen theme: the stored choice must win
  const context = await browser.newContext({ storageState: states[who], viewport: viewport.size, colorScheme: theme === "dark" ? "light" : "dark", reducedMotion: "reduce" });
  await context.addInitScript((chosen) => {
    try {
      localStorage.setItem("msi_theme", chosen);
    } catch {
      // ignore
    }
  }, theme);
  const page = await context.newPage();
  await skipIntro(page);
  const logs = watchConsole(page);
  const problems: string[] = [];
  for (const route of list) {
    await test.step(route.name, async () => {
      logs.length = 0;
      const url = (route.base?.() ?? "") + route.path();
      const response = await page.goto(url);
      const status = response?.status() ?? 0;
      await settle(page);
      const label = `${route.name} ${theme} ${viewport.label}`;
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const clipped = await page.evaluate(clippedOnTheSide);
      const shown = await page.evaluate(() => document.documentElement.dataset.theme);
      const consoleLines = route.quietConsole ? [] : status >= 400 ? logs.filter((line) => !line.includes("Failed to load resource")) : [...logs];
      const record: Result = {
        route: route.name, group: route.group, who, theme, viewport: viewport.label, status,
        violations: result.violations.map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`),
        // what axe could not decide (a dotted band behind the text, for example) is kept with its reason, to be judged by eye on the screenshot
        incomplete: result.incomplete.flatMap((item) => item.nodes.map((node) => `${item.id} [${node.any[0]?.data?.messageKey ?? "no reason"}]: ${node.target.join(" ")}`)),
        overflow, clipped, console: consoleLines,
      };
      records.push(record);
      for (const violation of record.violations) problems.push(`${label} axe ${violation}`);
      if (overflow > 0) problems.push(`${label} scrolls sideways by ${overflow}px`);
      for (const item of clipped) problems.push(`${label} sticks out: ${item}`);
      if (consoleLines.length) problems.push(`${label} console: ${consoleLines.join(" | ")}`);
      if (shown !== theme) problems.push(`${label} shows theme ${shown}`);
      if (shotsDir) {
        mkdirSync(shotsDir, { recursive: true });
        await page.screenshot({ path: path.join(shotsDir, `${route.name}-${theme}-${viewport.label}.png`), fullPage: true });
      }
    });
  }
  await context.close();
  return problems;
}

for (const viewport of viewports) {
  for (const theme of themes) {
    for (const who of people) {
      const list = routes.filter((route) => route.who === who);
      test(`${viewport.label}, ${theme} theme, ${who}: ${list.length} routes are clean`, async ({ browser }) => {
        test.setTimeout(300_000);
        expect(await visit(browser, who, theme, viewport, list)).toEqual([]);
      });
    }
  }
}
