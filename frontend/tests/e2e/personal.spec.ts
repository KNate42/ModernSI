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

test("a new member sees four honest empty states, each with a next step", async ({ page }) => {
  await signUpInBrowser(page, uniqueEmail("fresh"), "Fran Fresh");
  await page.goto("/personal");
  const empty = page.locator(".empty");
  await expect(empty).toHaveCount(4);
  await expect(empty.nth(0)).toContainText("You have not pitched anything yet.");
  await expect(empty.nth(1)).toContainText("You do not support any ideas yet.");
  await expect(empty.nth(2)).toContainText("You are not in a team yet.");
  await expect(empty.nth(3)).toContainText("No events yet.");
  for (const box of await empty.all()) await expect(box.getByRole("link")).toHaveCount(1);
  await expect(page.getByRole("main").locator(".btn-primary")).toHaveCount(1);
});

test("section pages list their parts as text, not links", async ({ page }) => {
  const parts = [["/academic", "Schedule"], ["/international", "Scholarships"], ["/community", "Speaking Club"], ["/personal", "Achievements"]];
  for (const [path, part] of parts) {
    await page.goto(path);
    // a section opens with a hero band and one crimson call to action
    await expect(page.locator(".page-hero h1")).toBeVisible();
    await expect(page.locator(".page-hero .btn-primary")).toHaveCount(1);
    await expect(page.getByRole("main").getByText(part, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: part, exact: true })).toHaveCount(0);
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
  await page.getByRole("switch", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  // record the theme at the end of HTML parsing, before any React code runs
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      (window as unknown as { themeAtParse?: string }).themeAtParse = document.documentElement.dataset.theme;
    });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { themeAtParse?: string }).themeAtParse)).toBe("light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(240, 240, 234)");
});

test("a member's theme follows them to another browser", async ({ page, browser }) => {
  const email = uniqueEmail("theme");
  await signUpInBrowser(page, email, "Theo Theme");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("switch", { name: "Dark theme" }).click();
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
