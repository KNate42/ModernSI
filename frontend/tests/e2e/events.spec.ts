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

  // the whole path ends on the homepage
  await page.goto("/");
  await expect(page.locator("#events")).toContainText(title);
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
