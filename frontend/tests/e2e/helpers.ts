// Shared e2e helpers: unique accounts, codes from Mailpit, signing in through the UI or the API.
// This work made by Anfinogentov Nikita
import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const BASE = "http://localhost:3100";
export const MAILPIT = "http://localhost:28025";
export const PASSWORD = "correct horse battery";
export const STAFF = { gov: "gov@uni.edu", curator: "curator@uni.edu", admin: "admin@uni.edu", password: "e2e password 123" };

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@uni.edu`;
}

export async function codeFor(email: string, subjectPart = "code"): Promise<string> {
  const mail = await request.newContext({ baseURL: MAILPIT });
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      const list = await (await mail.get("/api/v1/messages")).json();
      const message = list.messages.find(
        (item: { To: { Address: string }[]; Subject: string }) =>
          item.To.some((to) => to.Address === email) && item.Subject.includes(subjectPart),
      );
      if (message) return message.Subject.match(/\b(\d{6})\b/)[1];
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  } finally {
    await mail.dispose();
  }
  throw new Error(`no ${subjectPart} mail for ${email}`);
}

export async function skipIntro(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("msi_intro_seen", "1");
    } catch {
      // ignore
    }
  });
}

export async function signUpInBrowser(page: Page, email: string, name: string) {
  await page.goto("/join");
  await page.getByLabel("University e-mail").fill(email);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify/);
  await page.getByLabel("Confirmation code").fill(await codeFor(email));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page).toHaveURL(/\/personal/);
}

export async function loginInBrowser(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

// A confirmed student driven through the API (other voters, team members).
export async function apiUser(name: string): Promise<{ context: APIRequestContext; email: string }> {
  const email = uniqueEmail(name.toLowerCase().replace(/\s+/g, "-"));
  const context = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const registered = await context.post("/api/auth/register", { data: { email, password: PASSWORD, display_name: name } });
  expect(registered.status()).toBe(201);
  const verified = await context.post("/api/auth/verify", { data: { code: await codeFor(email) } });
  expect(verified.status()).toBe(200);
  return { context, email };
}

// Staff accounts from e2e_seed, logged in through the API.
export async function apiLogin(email: string, password: string): Promise<APIRequestContext> {
  const context = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } });
  const response = await context.post("/api/auth/login", { data: { email, password } });
  expect(response.status()).toBe(200);
  return context;
}
