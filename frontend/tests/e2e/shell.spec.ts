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
