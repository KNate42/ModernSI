// Intro: plays on the first visit of a session, ends by itself in ~6 s, can be skipped, respects reduced motion.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";

test("plays once per session and ends by itself", async ({ page }) => {
  await page.goto("/");
  const overlay = page.locator(".intro");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("[data-intro-word]")).toHaveText("ModernSI");
  // the page is already there behind the overlay, but nobody can reach it until the intro is over
  await expect(page.locator("main#main")).toBeAttached();
  await expect(page.locator("main#main")).toHaveAttribute("inert", "");
  await expect(overlay).toHaveAttribute("aria-modal", "true");
  await expect(overlay).toHaveCount(0, { timeout: 9_000 });
  expect(await page.evaluate(() => document.body.classList.contains("intro-lock"))).toBe(false);
  await expect(page.locator("main#main")).not.toHaveAttribute("inert", "");
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
