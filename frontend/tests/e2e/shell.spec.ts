// Site shell: header order, footer statement and theme switch, phone bar, 404 page.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { STAFF, loginInBrowser, skipIntro } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("header shows Events and Ideas, the four directions, then Forum", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  // the mobile-only Log in / Join links inside the nav are display:none on desktop, so they are not in this list
  await expect(nav.getByRole("link")).toHaveText(["Events", "Ideas", "Academic", "International", "Community", "Personal", "Forum"]);
  await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
  await page.goto("/forum");
  await expect(nav.getByRole("link", { name: "Forum" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Events" })).not.toHaveAttribute("aria-current", "page");
});

test("footer carries the independence statement", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("contentinfo")).toContainText(
    "ModernSI is an independent student project and is not affiliated with, endorsed by, or sponsored by any university.",
  );
});

test("the theme switch lives in the footer, not in the header", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.getByRole("banner").getByRole("switch")).toHaveCount(0);
  const toggle = page.getByRole("contentinfo").getByRole("switch", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
});

test("the phone bar has four 44 px actions, marks the current page and never covers the footer", async ({ page }) => {
  const bar = page.getByRole("navigation", { name: "Quick actions" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/ideas");
  await expect(bar.getByRole("link")).toHaveText(["Events", "Ideas", "Pitch", "Join"]);
  await expect(bar.getByRole("link", { name: "Ideas" })).toHaveAttribute("aria-current", "page");
  for (const link of await bar.getByRole("link").all()) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  // Pitch is its own page, so it lights up instead of Ideas
  await bar.getByRole("link", { name: "Pitch" }).click();
  await expect(page).toHaveURL(/\/ideas\/new$/);
  await expect(bar.getByRole("link", { name: "Pitch" })).toHaveAttribute("aria-current", "page");
  await expect(bar.getByRole("link", { name: "Ideas" })).not.toHaveAttribute("aria-current", "page");
  // at the bottom of the page the independence statement stays above the bar; the new page may still be growing, so scroll and measure until it settles
  await expect(page.locator("main h1")).toBeVisible();
  await expect(async () => {
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    const legal = await page.getByRole("contentinfo").getByText("ModernSI is an independent student project").boundingBox();
    const barBox = await bar.boundingBox();
    expect((legal?.y ?? 0) + (legal?.height ?? 0)).toBeLessThanOrEqual(barBox?.y ?? 0);
  }).toPass();
  // on a desktop screen there is no bar
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(bar).toBeHidden();
});

test("a signed-in phone gets Me instead of Join", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginInBrowser(page, STAFF.curator, STAFF.password);
  const bar = page.getByRole("navigation", { name: "Quick actions" });
  await expect(bar.getByRole("link")).toHaveText(["Events", "Ideas", "Pitch", "Me"]);
  await bar.getByRole("link", { name: "Me" }).click();
  await expect(page).toHaveURL(/\/personal$/);
  await expect(bar.getByRole("link", { name: "Me" })).toHaveAttribute("aria-current", "page");
});

test("unknown pages show a 404 with a way back", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Back to the homepage" }).click();
  await expect(page).toHaveURL("/");
});
