// Homepage: live blocks fill from the API; with the API unreachable the page still renders and data pages offer a retry.
// This work made by Anfinogentov Nikita
import { spawn, type ChildProcess } from "node:child_process";
import { expect, test } from "@playwright/test";
import { BASE, STAFF, apiLogin, apiUser, skipIntro } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("live counters, the closest idea, events and the feed", async ({ page }) => {
  const student = await apiUser("Home Student");
  const ideaTitle = `Peer tutoring hour ${Date.now() % 100000}`;
  const created = await student.context.post("/api/ideas", {
    data: { title: ideaTitle, summary: "An hour of peer tutoring before every exam week.", category: "academic", scope: "network" },
  });
  expect(created.status()).toBe(201);
  await student.context.dispose();

  const curator = await apiLogin(STAFF.curator, STAFF.password);
  const eventTitle = `Conversation night ${Date.now() % 100000}`;
  const startsAt = new Date(Date.now() + 86_400_000);
  const published = await curator.post("/api/events", {
    data: {
      title: eventTitle, starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 7_200_000).toISOString(),
      location_text: "Student lounge", scope: "network",
    },
  });
  expect(published.status()).toBe(201);
  await curator.dispose();

  // the worker ships the outbox to ClickHouse every 2 seconds
  await expect(async () => {
    await page.goto("/");
    await expect(page.locator(".feed")).toContainText(eventTitle, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });

  await expect(page.getByLabel("Network in numbers")).toContainText("student");
  await expect(page.locator(".spotlight")).toBeVisible();
  await expect(page.getByText("How it works")).toHaveCount(0);
  await expect(page.locator(".idea-list")).toContainText(ideaTitle);
  const hub = page.locator("section", { has: page.getByRole("heading", { name: "Coming up" }) });
  await expect(hub.getByRole("link", { name: new RegExp(eventTitle) })).toBeVisible();
  await expect(page.locator(".campuses")).toContainText("Almaty");

  await page.getByRole("link", { name: "Explore ideas" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas`);
});

test.describe("when the API is unreachable", () => {
  // a second production server on the same build, whose server side points at a closed port
  let server: ChildProcess;
  const DOWN = "http://localhost:3101";

  test.beforeAll(async () => {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", "3101"], {
      env: { ...process.env, API_URL: "http://127.0.0.1:1" },
      stdio: "ignore",
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if ((await fetch(`${DOWN}/`)).ok) return;
      } catch {
        // not listening yet
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error("the second Next server did not start");
  });

  test.afterAll(() => {
    server.kill();
  });

  test("the homepage renders for a guest without the live blocks", async ({ page }) => {
    await page.goto(`${DOWN}/`);
    await expect(page.getByRole("heading", { name: "One hub. Every campus." })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Join" }).last()).toBeVisible();
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByRole("heading", { name: "What just happened" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Coming up" })).toHaveCount(0);
    await expect(page.getByLabel("Network in numbers")).toHaveCount(0);
    await expect(page.getByRole("contentinfo")).toBeVisible();
  });

  test("a page that needs data shows the error page with a retry", async ({ page }) => {
    await page.goto(`${DOWN}/ideas`);
    await expect(page.getByRole("heading", { name: "This page could not load" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
  });
});
