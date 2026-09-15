import { expect, test } from "@playwright/test";

/**
 * Golden-path smoke test against the real stack (Next.js + NestJS +
 * Postgres + Redis, all started by playwright.config.ts's webServer
 * entries) — register an org, stand up a hotel's inventory, run a guest
 * through the full reservation lifecycle, and confirm the UI reflects
 * every state transition.
 */
test("register, configure a hotel, and take a booking through its full lifecycle", async ({ page }) => {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

  await page.goto("/register");
  await page.getByLabel("Organization name").fill(`Playwright Org ${runId}`);
  await page.getByLabel("Slug").fill(`pw-org-${runId}`);
  await page.getByLabel("First name").fill("Play");
  await page.getByLabel("Last name").fill("Wright");
  await page.getByLabel("Email").fill(`pw-admin-${runId}@example.com`);
  await page.getByLabel("Password").fill("Playwright-Pass-1!");
  await page.getByRole("button", { name: "Create organization" }).click();

  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

  // --- Hotel + inventory setup ---
  await page.getByRole("link", { name: "Hotels", exact: true }).click();
  await expect(page).toHaveURL(/\/hotels$/);
  await page.getByRole("button", { name: "New hotel" }).click();
  await page.getByLabel("Name").fill(`Playwright Hotel ${runId}`);
  await page.getByLabel("Slug").fill(`pw-hotel-${runId}`);
  await page.getByLabel("Timezone").fill("UTC");
  await page.getByLabel("Address").fill("1 Playwright Way");
  await page.getByLabel("City").fill("Testopolis");
  await page.getByLabel("Country").fill("US");
  await page.getByRole("button", { name: "Create hotel" }).click();

  await expect(page.getByText(`Playwright Hotel ${runId}`)).toBeVisible({ timeout: 10_000 });
  await page.getByText(`Playwright Hotel ${runId}`).click();
  await expect(page).toHaveURL(/\/hotels\/[a-f0-9-]+$/);

  await page.getByRole("button", { name: "+ New room type" }).click();
  await page.getByLabel("Name").fill("Standard Queen");
  await page.getByLabel("Adult capacity").fill("2");
  await page.getByLabel("Base price (cents)").fill("15000");
  await page.getByRole("button", { name: "Create room type" }).click();
  await expect(page.getByText("Standard Queen")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "rooms", exact: true }).click();
  await page.getByRole("button", { name: "+ New room" }).click();
  await page.getByLabel("Room number").fill("101");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("cell", { name: "101", exact: true })).toBeVisible({ timeout: 10_000 });

  // --- Search availability and hold a room ---
  await page.getByRole("link", { name: "New booking", exact: true }).click();
  await expect(page).toHaveURL(/\/booking$/);

  const inDate = addDays(10);
  const outDate = addDays(12);
  await page.getByLabel("Check-in").fill(inDate);
  await page.getByLabel("Check-out").fill(outDate);
  await page.getByRole("button", { name: "Search", exact: true }).click();

  await expect(page.getByText("Standard Queen")).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Book", exact: true }).click();

  await page.getByRole("button", { name: "+ New guest instead" }).click();
  await page.getByPlaceholder("First name").fill("Gina");
  await page.getByPlaceholder("Last name").fill("Guest");
  await page.getByPlaceholder("Email").fill(`guest-${runId}@example.com`);
  await page.getByRole("button", { name: "Save guest & book" }).click();

  await expect(page).toHaveURL(/\/reservations\/[a-f0-9-]+$/, { timeout: 15_000 });
  await expect(page.getByText("HELD")).toBeVisible();

  // --- Walk the reservation through its full lifecycle ---
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByText("CONFIRMED")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("CHECKED IN")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "Check out" }).click();
  await expect(page.getByText("CHECKED OUT")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/no further actions/i)).toBeVisible();
});

test("a second concurrent booking for the same single room is refused", async ({ page, context }) => {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;

  await page.goto("/register");
  await page.getByLabel("Organization name").fill(`Playwright Race Org ${runId}`);
  await page.getByLabel("Slug").fill(`pw-race-org-${runId}`);
  await page.getByLabel("First name").fill("Race");
  await page.getByLabel("Last name").fill("Admin");
  await page.getByLabel("Email").fill(`pw-race-${runId}@example.com`);
  await page.getByLabel("Password").fill("Playwright-Pass-1!");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

  await page.getByRole("link", { name: "Hotels", exact: true }).click();
  await page.getByRole("button", { name: "New hotel" }).click();
  await page.getByLabel("Name").fill(`Race Hotel ${runId}`);
  await page.getByLabel("Slug").fill(`pw-race-hotel-${runId}`);
  await page.getByLabel("Timezone").fill("UTC");
  await page.getByLabel("Address").fill("1 Race St");
  await page.getByLabel("City").fill("Testopolis");
  await page.getByLabel("Country").fill("US");
  await page.getByRole("button", { name: "Create hotel" }).click();
  await page.getByText(`Race Hotel ${runId}`).click();

  await page.getByRole("button", { name: "+ New room type" }).click();
  await page.getByLabel("Name").fill("Single Room");
  await page.getByLabel("Base price (cents)").fill("9000");
  await page.getByRole("button", { name: "Create room type" }).click();
  await expect(page.getByText("Single Room")).toBeVisible({ timeout: 10_000 });

  await page.getByRole("button", { name: "rooms", exact: true }).click();
  await page.getByRole("button", { name: "+ New room" }).click();
  await page.getByLabel("Room number").fill("201");
  await page.getByRole("button", { name: "Create room" }).click();
  await expect(page.getByRole("cell", { name: "201", exact: true })).toBeVisible({ timeout: 10_000 });

  await page.getByRole("link", { name: "New booking", exact: true }).click();
  const inDate = addDays(20);
  const outDate = addDays(21);
  await page.getByLabel("Check-in").fill(inDate);
  await page.getByLabel("Check-out").fill(outDate);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByText("Single Room")).toBeVisible({ timeout: 10_000 });

  // Book the only room from the first tab.
  await page.getByRole("button", { name: "Book", exact: true }).click();
  await page.getByRole("button", { name: "+ New guest instead" }).click();
  await page.getByPlaceholder("First name").fill("First");
  await page.getByPlaceholder("Last name").fill("Booker");
  await page.getByPlaceholder("Email").fill(`first-booker-${runId}@example.com`);
  await page.getByRole("button", { name: "Save guest & book" }).click();
  await expect(page).toHaveURL(/\/reservations\/[a-f0-9-]+$/, { timeout: 15_000 });
  await expect(page.getByText("HELD")).toBeVisible();

  // A second tab, same session, tries to book the now-taken room for the
  // same dates — this must be refused rather than double-booking it.
  const secondPage = await context.newPage();
  await secondPage.goto("/booking");
  await secondPage.getByLabel("Check-in").fill(inDate);
  await secondPage.getByLabel("Check-out").fill(outDate);
  await secondPage.getByRole("button", { name: "Search", exact: true }).click();
  await expect(secondPage.getByText("Single Room")).toBeVisible({ timeout: 10_000 });
  await expect(secondPage.getByText("Sold out")).toBeVisible({ timeout: 10_000 });
  await expect(secondPage.getByRole("button", { name: "Sold out" })).toBeDisabled();
});

function addDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
