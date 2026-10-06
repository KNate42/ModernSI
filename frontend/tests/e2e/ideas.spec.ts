// The idea path in the browser: propose, collect support, review by Student Government, gather a team.
// Thresholds are lowered for e2e (2 votes, team of 2) in start-backend.sh.
// This work made by Anfinogentov Nikita
import { expect, test } from "@playwright/test";
import { BASE, PASSWORD, STAFF, apiUser, loginInBrowser, signUpInBrowser, skipIntro, uniqueEmail } from "./helpers";

test.beforeEach(async ({ page }) => skipIntro(page));

test("an idea goes from proposal to review to a full team", async ({ page, browser }) => {
  const title = `Food Festival ${Date.now() % 100000}`;
  await signUpInBrowser(page, uniqueEmail("author"), "Aru Author");
  await page.goto("/ideas/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Short summary").fill("One evening, one table per country, a dish from home and its story.");
  await page.getByLabel("Category").selectOption("event");
  await page.getByLabel("Whole network").check();
  await page.getByLabel("Details").fill("We need **tables** and a room.");
  await page.getByRole("button", { name: "Publish idea" }).click();
  await expect(page).toHaveURL(/\/ideas\/[0-9a-f-]{36}$/);
  const ideaUrl = page.url();
  const ideaId = ideaUrl.split("/").pop()!;
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".prose strong")).toHaveText("tables");
  await expect(page.getByText("0 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Support this idea" })).toHaveCount(0);

  // a second student supports it in their own browser; a double click must count once
  const voterContext = await browser.newContext();
  const voterPage = await voterContext.newPage();
  await skipIntro(voterPage);
  await signUpInBrowser(voterPage, uniqueEmail("voter"), "Vera Voter");
  await voterPage.goto(ideaUrl);
  await voterPage.getByRole("button", { name: "Support this idea" }).dblclick();
  await expect(voterPage.getByRole("button", { name: "Withdraw support" })).toBeVisible();
  await expect(voterPage.getByText("1 of 2")).toBeVisible();

  // the second vote comes through the API and sends the idea to review
  const third = await apiUser("Third Voter");
  expect((await third.context.post(`/api/ideas/${ideaId}/vote`)).status()).toBe(200);
  await third.context.dispose();
  await page.reload();
  await expect(page.getByText("Student Government is reviewing this idea.")).toBeVisible();

  // Student Government approves in its own browser
  const govContext = await browser.newContext();
  const govPage = await govContext.newPage();
  await skipIntro(govPage);
  await loginInBrowser(govPage, STAFF.gov, STAFF.password);
  await govPage.goto("/review");
  await govPage.getByRole("link", { name: title }).click();
  await govPage.getByLabel("Note for the author").fill("Great idea, go ahead.");
  await govPage.getByRole("button", { name: "Approve" }).click();
  await expect(govPage.locator(".badge-accent")).toHaveText("Gathering a team");

  // the voter joins the team, again with a double click
  await voterPage.reload();
  await voterPage.getByRole("button", { name: "Join the team" }).dblclick();
  await expect(voterPage.getByRole("button", { name: "Leave the team" })).toBeVisible();
  await expect(voterPage.getByText("2 of 2 people in the team")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("link", { name: "Put it on the Hub" })).toHaveAttribute("href", `/events/new?idea=${ideaId}`);
  await expect(page.getByRole("list", { name: "Team" }).getByRole("link", { name: "Vera Voter" })).toBeVisible();
  await voterContext.close();
  await govContext.close();
});

test("asking for changes, editing and sending back to review", async ({ page, browser }) => {
  const author = await apiUser("Edit Author");
  const created = await author.context.post("/api/ideas", {
    data: { title: "Late library hours", summary: "Keep the library open until midnight in exam weeks.", category: "campus_life", scope: "campus" },
  });
  const ideaId = (await created.json()).id;
  for (const name of ["Edit Voter One", "Edit Voter Two"]) {
    const voter = await apiUser(name);
    await voter.context.post(`/api/ideas/${ideaId}/vote`);
    await voter.context.dispose();
  }
  const govContext = await browser.newContext();
  const govPage = await govContext.newPage();
  await skipIntro(govPage);
  await loginInBrowser(govPage, STAFF.gov, STAFF.password);
  await govPage.goto(`/ideas/${ideaId}`);
  await govPage.getByRole("button", { name: "Ask for changes" }).click();
  await expect(govPage.getByText("Write a note so the author knows what to change.")).toBeVisible();
  await govPage.getByLabel("Note for the author").fill("Say which weeks exactly.");
  await govPage.getByRole("button", { name: "Ask for changes" }).click();
  await expect(govPage.locator(".badge-accent")).toHaveText("Needs changes");
  await govContext.close();

  await loginInBrowser(page, author.email, PASSWORD);
  await author.context.dispose();
  await page.goto(`/ideas/${ideaId}`);
  await expect(page.getByText("Say which weeks exactly.")).toBeVisible();
  await page.getByRole("link", { name: "Edit idea" }).click();
  await page.getByLabel("Short summary").fill("Keep the library open until midnight in the two weeks before exams.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(`${BASE}/ideas/${ideaId}`);
  await page.getByRole("button", { name: "Send back to review" }).click();
  await expect(page.getByText("Student Government is reviewing this idea.")).toBeVisible();
});

test("guests read ideas and are asked to log in to support", async ({ page }) => {
  const author = await apiUser("Guest Check");
  const created = await author.context.post("/api/ideas", {
    data: { title: "Board games and tea", summary: "A quiet evening of board games in the student lounge.", category: "club", scope: "network" },
  });
  const ideaId = (await created.json()).id;
  await author.context.dispose();
  await page.goto("/ideas?sort=new");
  await page.getByRole("link", { name: /Board games and tea/ }).first().click();
  await expect(page).toHaveURL(`${BASE}/ideas/${ideaId}`);
  await page.getByRole("link", { name: "Log in to support it" }).click();
  await expect(page).toHaveURL(`${BASE}/login?next=%2Fideas%2F${ideaId}`);
});

test("broken idea links and page cursors do not crash", async ({ page }) => {
  expect((await page.goto("/ideas/not-a-uuid"))?.status()).toBe(404);
  expect((await page.goto("/ideas/00000000-0000-4000-8000-000000000000"))?.status()).toBe(404);
  await page.goto("/ideas?cursor=abc&sort=trending");
  await expect(page).toHaveURL(`${BASE}/ideas?sort=trending`);
});
