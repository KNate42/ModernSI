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
  // a guest can sign up or log in from the phone menu too
  await expect(nav.getByRole("link", { name: "Join" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Log in" })).toBeVisible();
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
