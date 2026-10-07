// Homepage: every block on live data, the empty states, the signed-in view, motion, layout and the API being down.
// Most checks run against the seeded backend; the exact empty and full states run against a tiny stand-in API, so they never depend on test order.
// This work made by Anfinogentov Nikita
import AxeBuilder from "@axe-core/playwright";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { expect, request, test, type Page } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiLogin, apiUser, loginInBrowser, skipIntro, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

// everything the browser prints as an error or a warning (hydration problems are errors in React 19)
function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

// the calm mode (?still=1) shows every block at once, so axe sees all of them
async function axeProblems(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.target}`);
}

async function startNext(port: number, apiUrl: string): Promise<ChildProcess> {
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
    env: { ...process.env, API_URL: apiUrl },
    stdio: "ignore",
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`http://localhost:${port}/`)).ok) return server;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  server.kill();
  throw new Error(`the Next server on ${port} did not start`);
}

test.describe("on the seeded backend", () => {
  test("every block shows live data for a guest", async ({ page }) => {
    const problems = watchConsole(page);
    const author = await apiUser("Home Author");
    const stamp = Date.now() % 100_000;
    const titles = [`Peer tutoring hour ${stamp}`, `Open data hackathon ${stamp}`, `Swap shelf for textbooks ${stamp}`];
    const ids: string[] = [];
    for (const title of titles) {
      const created = await author.context.post("/api/ideas", {
        data: { title, summary: "An hour of peer tutoring before every exam week.", category: "academic", scope: "network" },
      });
      expect(created.status()).toBe(201);
      ids.push((await created.json()).id);
    }
    // one vote on the newest idea, so it sits among the top of the wall
    const voter = await apiUser("Home Voter");
    expect((await voter.context.post(`/api/ideas/${ids[2]}/vote`)).status()).toBe(200);

    const curator = await apiLogin(STAFF.curator, STAFF.password);
    const eventTitle = `Conversation night ${stamp}`;
    const startsAt = new Date(Date.now() + 45 * 60_000);
    const published = await curator.post("/api/events", {
      data: {
        title: eventTitle, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 7_200_000).toISOString(),
        location_text: "Student lounge", scope: "network",
      },
    });
    expect(published.status()).toBe(201);
    await curator.dispose();
    await author.context.dispose();
    await voter.context.dispose();

    // the worker ships the outbox to ClickHouse every 2 seconds
    await expect(async () => {
      await page.goto("/");
      await expect(page.getByRole("region", { name: "Ideas students are backing right now" })).toBeVisible({ timeout: 1_000 });
      await expect(page.locator(".feed-grid")).toContainText(eventTitle, { timeout: 1_000 });
    }).toPass({ timeout: 30_000 });

    // hero: the sticker headline, one red button, the numbers of the network
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing happening? Start something.");
    await expect(page.locator(".hero").getByRole("link", { name: "Join with your uni e-mail" })).toHaveAttribute("href", "/join");
    await expect(page.getByLabel("The network in numbers")).toContainText("student");
    await expect(page.getByText("The network is just starting")).toHaveCount(0);
    await expect(page.locator(".hero")).not.toContainText("photo: you?");
    await expect(page.locator(".hero")).toContainText("Food night");

    // the ticker lists the trending ideas
    const ribbons = page.getByRole("region", { name: "Ideas students are backing right now" });
    for (const title of titles) await expect(ribbons).toContainText(title);

    // just show up: the next event with a countdown, the way in for a guest, the week and Quick access
    const next = page.getByRole("article", { name: "Next up" });
    await expect(next).toContainText(eventTitle);
    await expect(next).toContainText("Student lounge");
    await expect(next.getByRole("timer")).toContainText(/4[2-5]\s*min/);
    await expect(next.getByRole("link", { name: "I'm in" })).toHaveAttribute("href", /^\/login\?next=%2Fevents%2F[0-9a-f-]{36}$/);
    await expect(page.getByRole("link", { name: /^Next up:/ })).toHaveAttribute("href", "#week");
    const week = page.getByRole("region", { name: "The next seven days" });
    await expect(week.getByRole("link", { name: new RegExp(eventTitle) })).toHaveAttribute("href", /^\/events\/[0-9a-f-]{36}$/);
    // the week is also the place where a freshly published event shows up on the homepage
    await expect(page.locator("#events")).toContainText(eventTitle);
    await expect(week.getByText("Today", { exact: true })).toBeVisible();
    const quick = page.getByRole("navigation", { name: "Quick access" });
    await expect(quick.getByRole("link")).toHaveCount(3);
    await expect(quick.getByRole("link", { name: /My schedule/ })).toHaveAttribute("href", "/academic");
    await expect(quick.getByRole("link", { name: /Events/ })).toHaveAttribute("href", "/events");
    await expect(quick.getByRole("link", { name: /Opportunities/ })).toHaveAttribute("href", "/international");

    // the wall: every sticker leads to its idea page, the meter and the threshold come from the API
    const back = page.getByRole("link", { name: `Back it: ${titles[2]}` });
    await expect(back).toHaveAttribute("href", `/ideas/${ids[2]}`);
    const sticker = page.locator(".sticker", { has: back });
    await expect(sticker.locator("progress")).toHaveAttribute("max", "2");
    await expect(sticker.locator("progress")).toHaveAttribute("value", "1");
    await expect(sticker.locator(".votes-count")).toHaveText("1of 2 votes");
    await expect(page.getByRole("link", { name: "Pitch it" })).toHaveAttribute("href", "/ideas/new");
    await expect(page.getByText("How it works · example")).toHaveCount(0);

    // the route, with the threshold of the API, and the four doors
    await expect(page.locator("#how").getByRole("heading", { name: "Get to 2 votes" })).toBeVisible();
    for (const door of ["academic", "international", "community", "personal"]) {
      await expect(page.locator(".direction-grid").locator(`a[href="/${door}"]`)).toHaveCount(1);
    }

    // the feed, the luggage tags, the finale
    await expect(page.getByRole("heading", { name: /Meanwhile, on the other campuses/ })).toBeVisible();
    await expect(page.locator(".feed-grid").getByRole("link", { name: eventTitle })).toHaveAttribute("href", /^\/events\//);
    await expect(page.locator(".feed-grid")).not.toContainText("on the Hub");
    const tag = page.locator("#campuses .tag", { hasText: "Almaty" });
    await expect(tag).toContainText("ALM");
    await expect(tag).toContainText("Kazakhstan");
    await expect(tag).toContainText(/\d+\s*students?/);
    await expect(page.getByRole("link", { name: /Not on the list/ })).toHaveAttribute("href", "/request-campus");
    await expect(page.locator(".finale")).toContainText("Your campus is small. Your ideas aren't.");
    await expect(page.locator(".finale-burst")).toContainText(/You'd be\s*#\d+/);

    // the footer links land on the blocks, and nothing from the old design or the mock survived
    await expect(page.locator("#how")).toBeAttached();
    await expect(page.locator("#campuses")).toBeAttached();
    await expect(page.locator(".preview-strip")).toHaveCount(0);
    await expect(page.getByText(/Design preview/)).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test("a signed-in student pitches from the hero and says I'm in with one tap", async ({ page }) => {
    const problems = watchConsole(page);
    const curator = await apiLogin(STAFF.curator, STAFF.password);
    const eventTitle = `Board games and tea ${Date.now() % 100_000}`;
    // five minutes ahead: nothing else in the suite starts sooner, so it is the next event
    const startsAt = new Date(Date.now() + 5 * 60_000);
    expect((await curator.post("/api/events", {
      data: {
        title: eventTitle, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(),
        location_text: "Library, 3rd floor", scope: "network",
      },
    })).status()).toBe(201);
    await curator.dispose();

    const student = await apiUser("Home Student");
    await loginInBrowser(page, student.email, PASSWORD);
    await page.goto("/");
    await expect(page.locator(".hero").getByRole("link", { name: "Pitch an idea" })).toHaveAttribute("href", "/ideas/new");
    await expect(page.locator(".finale").getByRole("link", { name: "Pitch an idea" })).toHaveAttribute("href", "/ideas/new");
    await expect(page.getByRole("link", { name: "Join with your uni e-mail" })).toHaveCount(0);
    await expect(page.locator(".finale-burst")).toHaveCount(0);

    const next = page.getByRole("article", { name: "Next up" });
    await expect(next).toContainText(eventTitle);
    await expect(next.getByRole("timer")).toContainText(/[1-5]\s*min/);
    await expect(next.locator(".next-up-going")).toHaveText("Nobody yet. Be the first.");
    await next.getByRole("button", { name: "I'm in" }).dblclick();
    await expect(next.getByRole("button", { name: "Cancel my spot" })).toBeVisible();
    await expect(next.locator(".next-up-going")).toContainText("1 going, you included");
    // the choice is the server's, so it survives a reload
    await page.reload();
    await expect(page.getByRole("article", { name: "Next up" }).getByRole("button", { name: "Cancel my spot" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel my spot" }).click();
    await expect(page.getByRole("button", { name: "I'm in" })).toBeVisible();
    await expect(next.locator(".next-up-going")).not.toContainText("you included");
    expect(problems).toEqual([]);
  });

  test("an unconfirmed account is sent to confirm the e-mail instead of joining", async ({ page }) => {
    const curator = await apiLogin(STAFF.curator, STAFF.password);
    const startsAt = new Date(Date.now() + 3 * 60_000);
    expect((await curator.post("/api/events", {
      data: {
        title: `Quiet reading hour ${Date.now() % 100_000}`, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(),
        location_text: "Reading room", scope: "network",
      },
    })).status()).toBe(201);
    await curator.dispose();
    // registered, but the code was never entered: the session cookie exists and the account is still pending
    const pending = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
    expect((await pending.post("/api/auth/register", { data: { email: uniqueEmail("pending"), password: PASSWORD, display_name: "Pat Pending" } })).status()).toBe(201);
    await page.context().addCookies((await pending.storageState()).cookies);
    await page.goto("/");
    const next = page.getByRole("article", { name: "Next up" });
    await expect(next.getByRole("link", { name: "I'm in" })).toHaveAttribute("href", "/verify");
    await expect(next.getByRole("button", { name: "I'm in" })).toHaveCount(0);
    await pending.dispose();
  });

  test("the intro hands over to the homepage without a console problem", async ({ browser }) => {
    // a fresh context has no skip flag, so the first visit of the session plays the intro over the page
    const context = await browser.newContext();
    const page = await context.newPage();
    const problems = watchConsole(page);
    await page.goto("/");
    await expect(page.locator(".intro")).toBeVisible();
    await page.getByRole("button", { name: "Skip intro" }).click();
    await expect(page.locator(".intro")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    await expect(page.locator(".hero .tag-sticker")).toHaveAttribute("data-state", "in");
    expect(problems).toEqual([]);
    await context.close();
  });

  test("reduced motion shows everything at once and keeps the ticker calm", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "still");
    // nothing waits for a scroll, nothing moves
    await expect.poll(() => page.locator("[data-reveal]:not([data-state='in'])").count()).toBe(0);
    expect(await page.locator("[data-reveal]").evaluateAll((items) => items.every((item) => getComputedStyle(item).opacity === "1"))).toBe(true);
    await expect(page.locator(".ribbon-pause")).toBeHidden();
    const track = page.locator(".ribbon-track").first();
    if (await track.count()) expect(await track.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await expect(page.locator(".ribbon-clone:visible")).toHaveCount(0);
  });

  test("full motion reveals stickers on scroll and the ticker can be paused", async ({ page }) => {
    // the ticker needs three ideas; the first test of this file made them, but a single run of this test must not depend on it
    const author = await apiUser("Motion Author");
    for (const title of ["Free printing before deadlines", "Night bus after the library closes", "Weekend speaking club in Spanish"]) {
      await author.context.post("/api/ideas", { data: { title: `${title} ${Date.now() % 100_000}`, summary: "A small idea.", category: "campus_life", scope: "network" } });
    }
    await author.context.dispose();
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
    await expect(page.locator(".ribbon-ideas .ribbon-track")).toBeVisible();
    // more than one copy of the list (the first one and its clones), and the band moves
    await expect.poll(() => page.locator(".ribbon-ideas .ribbon-list").count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator(".ribbon-ideas .ribbon-track").evaluate((element) => getComputedStyle(element).animationName)).toBe("home-ribbon-left");
    const pause = page.getByRole("button", { name: "Pause ticker" });
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".ribbons")).toHaveAttribute("data-paused", "");
    expect(await page.locator(".ribbon-ideas .ribbon-track").evaluate((element) => getComputedStyle(element).animationPlayState)).toBe("paused");
    await pause.click();
    await expect(page.locator(".ribbons")).not.toHaveAttribute("data-paused", "");
    // a sticker far below the fold is hidden until it scrolls into view
    const campusTag = page.locator("#campuses .tag").first();
    await expect(campusTag).toHaveCSS("opacity", "0");
    await campusTag.scrollIntoViewIfNeeded();
    await expect(campusTag).toHaveAttribute("data-state", "in");
    await expect(campusTag).toHaveCSS("opacity", "1", { timeout: 3_000 });
  });

  for (const scheme of ["light", "dark"] as const) {
    test(`no horizontal scroll and no axe violations, ${scheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(viewport);
        await page.goto("/?still=1");
        await expect(page.locator(".finale")).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${viewport.width} px`).toBeLessThanOrEqual(0);
        expect(await axeProblems(page), `${viewport.width} px`).toEqual([]);
      }
    });
  }
});

// The exact states need exact data. This stand-in answers like the API, and a second production server of the same build talks to it.
test.describe("on a stand-in API", () => {
  const STAND_IN_API = 3201;
  const STAND_IN_SITE = 3102;
  const hour = 3_600_000;
  type Scenario = "empty" | "full" | "far";
  let scenario: Scenario = "empty";
  let api: Server;
  let site: ChildProcess;

  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const author = { id: id(900), display_name: "Sample Author", campus_label: "Almaty" };
  const idea = (n: number, title: string, votes: number, scope: "campus" | "network") => ({
    id: id(n), title, summary: `${title}: one evening, one table per country.`, category: "event", scope, campus_label: scope === "campus" ? "Almaty" : null,
    status: "open", vote_count: votes, vote_threshold: 50, team_size: 0, team_min: 3, author, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  const event = (n: number, title: string, startsIn: number, lasts: number, going: number) => ({
    id: id(n), title, description_md: "", description_html: "", starts_at: new Date(Date.now() + startsIn).toISOString(), ends_at: new Date(Date.now() + startsIn + lasts).toISOString(),
    location_text: "Room 204", online_url: null, campus_label: "Almaty", going_count: going, idea_id: null, idea_title: null, created_by: author, i_am_going: false, is_past: false,
  });
  const feedItem = (n: number, kind: string, data: Record<string, string>, campus: string | null) => ({
    id: id(n), kind, at: new Date(Date.now() - n * hour).toISOString(), actor_id: null, idea_id: id(100), event_id: id(500), campus_label: campus, data,
  });

  function answer(path: string): { status: number; body: unknown } {
    if (path.startsWith("/api/auth/me")) return { status: 401, body: { error: { code: "not_authenticated", message: "Please log in first", fields: [] } } };
    if (scenario === "empty") {
      if (path.startsWith("/api/stats")) return { status: 200, body: { students: 0, campuses: 0, ideas_to_events: 0, show_counters: false } };
      if (path.startsWith("/api/campuses")) return { status: 200, body: [] };
      return { status: 200, body: { items: [], next_cursor: null } };
    }
    if (path.startsWith("/api/stats")) return { status: 200, body: { students: 1284, campuses: 3, ideas_to_events: 37, show_counters: true } };
    if (path.startsWith("/api/campuses")) {
      return { status: 200, body: [{ campus_label: "Almaty", country_code: "KZ", students: 212 }, { campus_label: "Tbilisi", country_code: "GE", students: 148 }, { campus_label: "Yerevan", country_code: "AM", students: 131 }] };
    }
    if (path.startsWith("/api/ideas")) {
      const ideas = [
        idea(1, "International Food Festival", 41, "network"), idea(2, "Peer tutoring hour before exams", 38, "campus"), idea(3, "Weekend speaking club in Spanish", 29, "network"),
        idea(4, "Quiet study room open until midnight", 24, "campus"), idea(5, "River clean-up with the eco club", 17, "campus"), idea(6, "Open data hackathon", 12, "network"), idea(7, "Swap shelf for textbooks", 6, "campus"),
      ];
      return { status: 200, body: { items: path.includes("sort=closest") ? ideas.slice(0, 1) : ideas, next_cursor: null } };
    }
    if (path.startsWith("/api/events")) {
      const items = scenario === "far"
        ? [event(501, "Autumn volunteering day", 9 * 24 * hour + 2 * hour, hour, 4)]
        : [event(501, "CV clinic with alumni", -10 * 60_000, hour, 23), event(502, "Film night, subtitles on", 27 * hour, 2 * hour, 5), event(503, "Campus photo hunt", 52 * hour, 2 * hour, 0)];
      return { status: 200, body: { items, next_cursor: null } };
    }
    if (path.startsWith("/api/feed")) {
      return {
        status: 200,
        body: {
          items: [
            feedItem(1, "event_published", { event_title: "Film night, subtitles on" }, "Tbilisi"),
            feedItem(2, "idea_created", { actor_name: "Aigerim", idea_title: "Peer tutoring hour before exams" }, "Almaty"),
            feedItem(3, "team_formed", { idea_title: "Open data hackathon" }, null),
            feedItem(4, "idea_reached_review", { idea_title: "International Food Festival" }, "Yerevan"),
          ],
          next_cursor: null,
        },
      };
    }
    return { status: 404, body: { error: { code: "not_found", message: "Not found", fields: [] } } };
  }

  test.beforeAll(async () => {
    api = createServer((request, response) => {
      const { status, body } = answer(request.url ?? "/");
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    });
    await new Promise<void>((resolve) => api.listen(STAND_IN_API, "127.0.0.1", resolve));
    site = await startNext(STAND_IN_SITE, `http://127.0.0.1:${STAND_IN_API}`);
  });

  test.afterAll(async () => {
    site?.kill();
    await new Promise<void>((resolve) => (api ? api.close(() => resolve()) : resolve()));
  });

  const HOME = `http://localhost:${STAND_IN_SITE}/`;

  test("a young network: the starting plate, the example idea and a quiet week", async ({ page }) => {
    scenario = "empty";
    const problems = watchConsole(page);
    await page.goto(HOME);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing happening? Start something.");
    await expect(page.getByText("The network is just starting. Your campus could be the first.")).toBeVisible();
    await expect(page.getByLabel("The network in numbers")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Ideas students are backing right now" })).toHaveCount(0);
    // no events at all: the honest quiet state with the one way out
    await expect(page.getByRole("heading", { name: "Quiet week. Start something." })).toBeVisible();
    await expect(page.getByRole("article", { name: "Quiet week" }).getByRole("link", { name: "Pitch an idea" })).toHaveAttribute("href", "/ideas/new");
    await expect(page.getByRole("article", { name: "Next up" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "The next seven days" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Quick access" })).toBeVisible();
    // no ideas: one drawn example, marked as an example, and no numbers in it
    const wall = page.locator(".wall");
    await expect(wall.getByText("How it works · example")).toBeVisible();
    await expect(wall.getByRole("heading", { name: "International Food Festival" })).toBeVisible();
    await expect(wall.getByRole("link", { name: "Pitch the first idea" })).toHaveAttribute("href", "/ideas/new");
    await expect(wall.locator(".votes-count")).toHaveCount(0);
    await expect(page.locator("#how").getByRole("heading", { name: "Get enough votes" })).toBeVisible();
    // no feed, no campuses, no counter in the finale
    await expect(page.getByRole("heading", { name: /Meanwhile, on the other campuses/ })).toHaveCount(0);
    await expect(page.locator("#campuses")).toHaveCount(0);
    await expect(page.locator(".finale-burst")).toHaveCount(0);
    await expect(page.locator(".finale").getByRole("link", { name: "Join with your uni e-mail" })).toBeVisible();
    expect(problems).toEqual([]);
    await page.goto(`${HOME}?still=1`);
    expect(await axeProblems(page)).toEqual([]);
  });

  test("a busy network: counters, ticker, a running event, the wall, the feed, the tags", async ({ page }) => {
    scenario = "full";
    const problems = watchConsole(page);
    await page.goto(HOME);
    const numbers = page.getByLabel("The network in numbers");
    await expect(numbers).toContainText("1,284");
    await expect(numbers).toContainText("students");
    await expect(numbers).toContainText("37");
    await expect(numbers).toContainText("ideas that became real events");
    await expect(page.getByText("The network is just starting")).toHaveCount(0);
    await expect(page.locator(".hero-lead")).toContainText("students of three micro-campuses");

    // a running event says so, in the card and in the hero chip
    const next = page.getByRole("article", { name: "Next up" });
    await expect(next.getByRole("heading", { name: "CV clinic with alumni" })).toBeVisible();
    await expect(next.getByRole("timer")).toHaveText("Happening now");
    await expect(next.getByText("Starts in")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Next up:/ })).toContainText("Happening now");
    await expect(next.getByRole("link", { name: "I'm in" })).toHaveAttribute("href", `/login?next=%2Fevents%2F${"00000000-0000-4000-8000-000000000501"}`);
    await expect(next.locator(".next-up-going")).toContainText("23 going");

    // the week: three events on three days of the viewer's calendar, the other days offer to pitch
    const week = page.getByRole("region", { name: "The next seven days" });
    await expect(week.locator("a.week-event")).toHaveCount(3);
    await expect(week.getByRole("link", { name: /Film night, subtitles on/ })).toBeVisible();
    await expect(week.getByRole("link", { name: "Pitch one" })).toHaveCount(4);

    // the wall: slot 1 is the closest idea, five more follow, the 80% stamp only where earned
    const stickers = page.locator(".wall .sticker[data-slot]");
    await expect(stickers).toHaveCount(6);
    await expect(stickers.first().getByRole("heading")).toHaveText("International Food Festival");
    await expect(stickers.first().locator(".stamp")).toHaveText("Almost there!");
    await expect(page.locator(".stamp")).toHaveCount(1);
    await expect(stickers.first().locator("progress")).toHaveAttribute("value", "41");
    await expect(stickers.first().locator(".votes-left")).toHaveText("9 more votes and it goes to review.");
    await expect(page.getByRole("link", { name: "Back it: Open data hackathon" })).toHaveAttribute("href", `/ideas/${"00000000-0000-4000-8000-000000000006"}`);
    await expect(page.getByRole("link", { name: "Back it: Swap shelf for textbooks" })).toHaveCount(0);
    await expect(page.locator(".wall .section-lead")).toContainText("37 ideas have already turned into real events.");
    await expect(page.locator("#how").getByRole("heading", { name: "Get to 50 votes" })).toBeVisible();
    await expect(page.locator("#how")).toContainText("So can the other two.");

    // the ticker, the feed (the Hub is gone from the wording), the tags and the finale number
    const ribbons = page.getByRole("region", { name: "Ideas students are backing right now" });
    await expect(ribbons).toContainText("Swap shelf for textbooks");
    await expect(ribbons).toContainText("Yerevan");
    await expect(page.locator(".feed-note")).toHaveCount(4);
    await expect(page.locator(".feed-note", { hasText: "Film night, subtitles on" })).toContainText("is on the calendar");
    await expect(page.locator(".feed-note", { hasText: "Aigerim" })).toContainText(/Aigerim (pitched|proposed) Peer tutoring hour before exams/);
    await expect(page.locator(".tag-code")).toHaveText(["ALM", "TBI", "YER"]);
    await expect(page.locator("#campuses .tag", { hasText: "Tbilisi" })).toContainText("Georgia");
    await expect(page.locator("#campuses .tag", { hasText: "Almaty" })).toContainText("212 students");
    await expect(page.locator("#campuses .section-lead")).toContainText("the other two are looking for people too");
    await expect(page.locator(".finale-burst")).toContainText("You'd be#1,285");
    expect(problems).toEqual([]);
    await page.goto(`${HOME}?still=1`);
    expect(await axeProblems(page)).toEqual([]);
  });

  test("an event far away still gets its countdown in days, and the week says it is empty", async ({ page }) => {
    scenario = "far";
    await page.goto(HOME);
    const next = page.getByRole("article", { name: "Next up" });
    await expect(next.getByRole("heading", { name: "Autumn volunteering day" })).toBeVisible();
    await expect(next.getByRole("timer")).toHaveText(/^9\s*d\s*[12]\s*h$/);
    await expect(next.locator(".next-up-going")).toContainText("4 going");
    const week = page.getByRole("region", { name: "The next seven days" });
    await expect(week.getByText("Nothing is on in the next seven days.")).toBeVisible();
    await expect(week.getByRole("link", { name: "Pitch one" })).toHaveAttribute("href", "/ideas/new");
  });

  test("times follow the visitor's timezone, not the server's", async ({ browser }) => {
    scenario = "full";
    // Tbilisi is UTC+4 all year; the first event of the stand-in starts 27 hours from now
    const context = await browser.newContext({ timezoneId: "Asia/Tbilisi", viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await skipIntro(page);
    await page.goto(HOME);
    const local = await page.evaluate(() => new Date(Date.now() + 27 * 3_600_000));
    const expected = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(local));
    const week = page.getByRole("region", { name: "The next seven days" });
    // the stand-in event was created a few seconds before the page, so the minute can differ by one at a boundary
    const text = await week.getByRole("link", { name: /Film night, subtitles on/ }).locator("time").textContent();
    const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const apart = Math.abs(minutes(text ?? "00:00") - minutes(expected));
    expect(Math.min(apart, 1440 - apart)).toBeLessThanOrEqual(2);
    expect(text).not.toContain("UTC");
    await context.close();
  });
});

test.describe("when the API is unreachable", () => {
  // a second production server on the same build, whose server side points at a closed port
  let server: ChildProcess;
  const DOWN = "http://localhost:3101";

  test.beforeAll(async () => {
    server = await startNext(3101, "http://127.0.0.1:1");
  });

  test.afterAll(() => {
    server.kill();
  });

  test("the homepage renders for a guest without the live blocks", async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(`${DOWN}/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nothing happening? Start something.");
    await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
    // what needs no data stays: Quick access, the example, the route, the doors, the finale
    await expect(page.getByRole("navigation", { name: "Quick access" })).toBeVisible();
    await expect(page.locator(".wall").getByText("How it works · example")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How an idea becomes an event" })).toBeVisible();
    await expect(page.locator(".direction-grid a")).toHaveCount(4);
    await expect(page.locator(".finale")).toContainText("Your campus is small.");
    // what needs data hides itself, and nothing claims the week is quiet
    await expect(page.getByRole("heading", { name: /Meanwhile, on the other campuses/ })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Quiet week. Start something." })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Next up" })).toHaveCount(0);
    await expect(page.getByLabel("The network in numbers")).toHaveCount(0);
    await expect(page.getByText("The network is just starting")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Ideas students are backing right now" })).toHaveCount(0);
    await expect(page.locator("#campuses")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toBeVisible();
    expect(problems).toEqual([]);
  });

  test("a page that needs data shows the error page with a retry", async ({ page }) => {
    await page.goto(`${DOWN}/ideas`);
    await expect(page.getByRole("heading", { name: "This page could not load" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
  });
});
