// The inner pages in both themes, on a desktop and on a phone: no axe violations (contrast included), at most one crimson button
// per page, and a console without errors or warnings (so no hydration mismatch). Guests, a member, Student Government and a curator.
// This work made by Anfinogentov Nikita
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type BrowserContextOptions } from "@playwright/test";
import { STAFF, apiLogin, apiUser, skipIntro } from "./helpers";

type Storage = BrowserContextOptions["storageState"];

const variants = [
  { label: "light desktop", colorScheme: "light", viewport: { width: 1280, height: 800 } },
  { label: "dark phone", colorScheme: "dark", viewport: { width: 390, height: 844 } },
] as const;

const ids = { author: "", open: "", review: "", team: "", event: "" };
const states: Record<"guest" | "member" | "gov" | "curator", Storage> = { guest: undefined, member: undefined, gov: undefined, curator: undefined };

test.beforeAll(async () => {
  const author = await apiUser("Axe Author");
  ids.author = (await (await author.context.get("/api/auth/me")).json()).id;
  const voters = [await apiUser("Axe Voter One"), await apiUser("Axe Voter Two")];
  const gov = await apiLogin(STAFF.gov, STAFF.password);
  const curator = await apiLogin(STAFF.curator, STAFF.password);

  const pitch = async (title: string) => {
    const created = await author.context.post("/api/ideas", {
      data: { title, summary: "A short summary that says what should happen and who it is for.", category: "club", scope: "network", body_md: "Some **details** for the page.\n\n- one\n- two" },
    });
    expect(created.status()).toBe(201);
    return (await created.json()).id as string;
  };
  ids.open = await pitch("Axe open idea");
  ids.review = await pitch("Axe idea in review");
  ids.team = await pitch("Axe idea with a team");
  for (const id of [ids.review, ids.team]) for (const voter of voters) expect((await voter.context.post(`/api/ideas/${id}/vote`)).status()).toBe(200);
  expect((await gov.post(`/api/ideas/${ids.team}/decision`, { data: { decision: "approve" } })).status()).toBe(200);
  expect((await voters[0].context.post(`/api/ideas/${ids.team}/team`)).status()).toBe(200);

  const startsAt = new Date(Date.now() + 3 * 86_400_000);
  const event = await curator.post("/api/events", {
    data: { title: "Axe evening", starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 3_600_000).toISOString(), location_text: "Room 1", scope: "network", description_md: "Come along." },
  });
  expect(event.status()).toBe(201);
  ids.event = (await event.json()).id;

  states.member = await author.context.storageState();
  states.gov = await gov.storageState();
  states.curator = await curator.storageState();
  for (const context of [author.context, ...voters.map((voter) => voter.context), gov, curator]) await context.dispose();
});

const groups = [
  {
    who: "guest" as const,
    paths: () => [
      "/ideas", "/ideas?sort=trending&category=club", "/ideas/new", "/events", "/events?when=past", `/ideas/${ids.open}`, `/ideas/${ids.review}`, `/ideas/${ids.team}`,
      `/events/${ids.event}`, `/profile/${ids.author}`, "/academic", "/international", "/community", "/personal", "/forum", "/about", "/join", "/login", "/forgot", "/reset",
      "/request-campus", "/no-such-page",
    ],
  },
  { who: "member" as const, paths: () => ["/personal", "/ideas/new", "/settings", `/ideas/${ids.open}`, `/ideas/${ids.team}`, `/ideas/${ids.review}`, `/profile/${ids.author}`, `/events/${ids.event}`] },
  { who: "gov" as const, paths: () => ["/review", `/ideas/${ids.review}`, "/community"] },
  { who: "curator" as const, paths: () => ["/events", "/events/new", `/events/new?idea=${ids.team}`, `/ideas/${ids.team}`] },
];

async function visit(browser: Browser, who: keyof typeof states, variant: (typeof variants)[number], paths: string[]) {
  const context = await browser.newContext({ storageState: states[who], colorScheme: variant.colorScheme, viewport: variant.viewport });
  const page = await context.newPage();
  await skipIntro(page);
  const logs: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") logs.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));
  const problems: string[] = [];
  for (const path of paths) {
    logs.length = 0;
    const response = await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    const status = response?.status() ?? 0;
    // a 404 page logs the failed request itself, so only the pages that open are held to a clean console
    if (status < 400 && logs.length) problems.push(`${path} console: ${logs.join(" | ")}`);
    const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    for (const violation of result.violations) problems.push(`${path} axe ${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);
    const crimson = await page.locator("main .btn-primary").count();
    if (crimson > 1) problems.push(`${path} has ${crimson} crimson buttons`);
  }
  await context.close();
  return problems;
}

for (const variant of variants) {
  for (const group of groups) {
    test(`${group.who}, ${variant.label}: no axe violations, one crimson button, a clean console`, async ({ browser }) => {
      test.setTimeout(240_000);
      expect(await visit(browser, group.who, variant, group.paths())).toEqual([]);
    });
  }
}
