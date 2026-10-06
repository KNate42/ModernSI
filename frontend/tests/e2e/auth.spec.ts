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
