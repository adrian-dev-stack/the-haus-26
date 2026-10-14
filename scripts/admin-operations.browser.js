import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { hashAdminPassword } from "../lib/booking-auth.js";

const root = process.cwd();
const directory = await mkdtemp(path.join(os.tmpdir(), "haus26-operations-browser-"));
const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const password = `fixture-host-${randomUUID()}`;
const screenshots = path.join(root, ".booking-data");
await mkdir(screenshots, { recursive: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NODE_ENV: "production", VERCEL: "", NEXT_TELEMETRY_DISABLED: "1",
    SITE_URL: origin, BOOKING_DATABASE_URL: `file:${path.join(directory, "records.db").replaceAll("\\", "/")}`,
    BOOKING_DATABASE_AUTH_TOKEN: "", BOOKING_ALLOW_LOCAL_DATABASE: "true",
    BOOKING_ADMIN_PASSWORD_HASH: await hashAdminPassword(password),
    BOOKING_SESSION_SECRET: randomUUID(), BOOKING_TOKEN_SECRET: randomUUID(),
    PAYMENT_LINK_SECRET: randomUUID(), PAYMONGO_SECRET_KEY: "sk_test_fixture_browser_operations",
    PAYMENTS_LIVE_ENABLED: "false", PAYMONGO_WEBHOOK_SECRET: "", BOOKING_CALENDAR_TOKEN: "",
    BOOKING_NOTIFICATIONS_ENABLED: "false", BOOKING_NOTIFICATIONS_TEST_ENABLED: "false",
    RESEND_API_KEY: "", UNISMS_API_KEY: "", CRON_SECRET: randomUUID(),
  },
});
server.stdout.resume();
server.stderr.resume();
let browser;
const errors = [];

async function saveScreenshot(page, name) {
  const filename = path.join(screenshots, `operations-${name}.png`);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot: ${filename}`);
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, "The page must fit its viewport.");
}

async function post(context, endpoint, body) {
  const response = await context.request.post(`${origin}${endpoint}`, { headers: { Origin: origin }, data: body });
  assert.ok(response.ok(), `Fixture request failed: ${endpoint} (${response.status()})`);
  return (await response.json()).data;
}

async function signIn(page) {
  await page.goto(`${origin}/admin`);
  await page.getByRole("dialog", { name: "Essential Cookies & Storage" }).getByRole("button", { name: "Got it", exact: true }).click();
  await expect(page.getByLabel("Host Password")).toBeVisible();
  await page.getByLabel("Host Password").fill(password);
  await page.getByRole("button", { name: "Enter Host Dashboard" }).click();
  await expect(page.getByRole("button", { name: "Expenses", exact: true })).toBeVisible();
}

async function checkExpenses(page) {
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  const section = page.getByRole("region", { name: "Expenses", exact: true });
  await expect(section.getByText("No expenses recorded for this month", { exact: true })).toBeVisible();
  const form = section.getByRole("group", { name: "Record an expense", exact: true });
  await form.getByLabel("Expense date").fill("2030-03-14");
  await form.getByLabel("Category", { exact: true }).selectOption("water");
  await form.getByLabel("Amount (PHP)").fill("1234.56");
  await form.getByLabel("Description", { exact: true }).fill("Browser fixture water bill");
  await form.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(section.getByText("Expense saved.", { exact: true })).toBeVisible();
  await expect(section.getByRole("heading", { name: "Browser fixture water bill", exact: true })).toBeVisible();
  await expect(section.getByLabel("Month", { exact: true })).toHaveValue("2030-03");

  await form.getByLabel("Expense date").fill("2030-03-15");
  await form.getByLabel("Category", { exact: true }).selectOption("electricity");
  await form.getByLabel("Amount (PHP)").fill("2345.67");
  await form.getByLabel("Description", { exact: true }).fill("Browser fixture electricity bill");
  await form.getByRole("button", { name: "Save expense", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture electricity bill", exact: true })).toBeVisible();
  const totals = await page.context().request.get(`${origin}/api/admin/expenses?month=2030-03`);
  assert.equal((await totals.json()).data.summary.totalAmount, 358023);

  await section.getByRole("button", { name: "Edit expense: Browser fixture water bill", exact: true }).click();
  const editor = section.getByRole("group", { name: "Edit expense", exact: true });
  await editor.getByLabel("Amount (PHP)").fill("1300.25");
  await editor.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(section.getByText("Expense updated.", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Delete expense: Browser fixture water bill", exact: true }).click();
  await section.getByRole("button", { name: "Keep expense", exact: true }).click();
  await section.getByRole("button", { name: "Delete expense: Browser fixture water bill", exact: true }).click();
  await section.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture water bill", exact: true })).toHaveCount(0);
  await section.getByLabel("Search expenses", { exact: true }).fill("absent fixture");
  await expect(section.getByText("No expenses match these filters", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture electricity bill", exact: true })).toBeVisible();
  await saveScreenshot(page, "expenses-desktop");
  await noOverflow(page);
  console.log("PASS: expense creation, exact monthly totals, editing, delete confirmation, and search.");
}

async function checkInventory(page) {
  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  const section = page.getByRole("region", { name: "Inventory", exact: true });
  await expect(section.getByText("Start with your current stock", { exact: true })).toBeVisible();
  const form = section.getByRole("group", { name: "Add an item", exact: true });
  await form.getByLabel("Item name", { exact: true }).fill("Browser fixture guest soap");
  await form.getByLabel("Category", { exact: true }).fill("Toiletries");
  await form.getByLabel("Unit", { exact: true }).fill("pieces");
  await form.getByLabel("Opening usable quantity").fill("3");
  await form.getByLabel("Low stock at", { exact: true }).fill("2");
  await form.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture guest soap", exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Manage item: Browser fixture guest soap", exact: true }).click();
  const adjustment = section.getByRole("group", { name: "Adjust usable stock", exact: true });

  async function adjust(type, quantity, expected) {
    await expect(adjustment).toBeVisible();
    await adjustment.getByLabel("Adjustment type").selectOption(type);
    await adjustment.getByRole("spinbutton").fill(String(quantity));
    await adjustment.getByLabel("Reason", { exact: true }).fill(`Browser fixture ${type}`);
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/admin/inventory") && response.request().method() === "POST");
    await adjustment.getByRole("button", { name: "Save adjustment", exact: true }).click();
    assert.ok((await saved).ok());
    await expect(adjustment.getByText(`Current usable count: ${expected} pieces.`, { exact: false })).toBeVisible();
  }

  await adjust("restock", 2, 5);
  await adjust("use", 3, 2);
  await expect(section.getByText("Low stock", { exact: true })).toBeVisible();
  await adjust("damaged", 1, 1);
  await adjust("missing", 1, 0);
  await adjust("correction", 4, 4);
  await section.getByRole("button", { name: "Edit details", exact: true }).click();
  const editor = section.getByRole("group", { name: "Edit item", exact: true });
  await editor.getByLabel("Location (optional)").fill("Browser fixture cabinet");
  await editor.getByRole("button", { name: "Save details", exact: true }).click();
  await expect(section.getByText("Location: Browser fixture cabinet", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Movement history", exact: true }).click();
  await expect(section.getByText("Browser fixture correction", { exact: true })).toBeVisible();
  await expect(section.getByText("Browser fixture use", { exact: true })).toBeVisible();
  await saveScreenshot(page, "inventory-desktop");
  await section.getByRole("button", { name: "Archive item", exact: true }).click();
  await section.getByRole("button", { name: "Keep active", exact: true }).click();
  await section.getByRole("button", { name: "Archive item", exact: true }).click();
  await section.getByRole("button", { name: "Confirm archive", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture guest soap", exact: true })).toHaveCount(0);
  await section.getByRole("button", { name: "Archived", exact: true }).click();
  await section.getByRole("button", { name: "View history: Browser fixture guest soap", exact: true }).click();
  await expect(section.getByText("Browser fixture correction", { exact: true })).toBeVisible();
  await expect(section.getByRole("button", { name: "Stock adjustment", exact: true })).toHaveCount(0);
  await section.getByRole("button", { name: "Close item", exact: true }).click();

  await form.getByLabel("Item name", { exact: true }).fill("Browser fixture towels");
  await form.getByLabel("Type", { exact: true }).selectOption("reusable");
  await form.getByLabel("Category", { exact: true }).fill("Linen");
  await form.getByLabel("Unit", { exact: true }).fill("pieces");
  await form.getByLabel("Opening usable quantity").fill("6");
  await form.getByLabel("Low stock at", { exact: true }).fill("2");
  await form.getByRole("button", { name: "Save item", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture towels", exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Manage item: Browser fixture towels", exact: true }).click();
  const options = await adjustment.getByLabel("Adjustment type").locator("option").evaluateAll((nodes) => nodes.map((node) => node.value));
  assert.equal(options.includes("use"), false, "Using reusable items must not consume their count.");
  await section.getByRole("button", { name: "Close item", exact: true }).click();
  await section.getByLabel("Show low stock only", { exact: true }).check();
  await expect(section.getByText("No items match these filters", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Clear filters", exact: true }).click();
  await expect(section.getByRole("heading", { name: "Browser fixture towels", exact: true })).toBeVisible();
  await noOverflow(page);
  console.log("PASS: consumable and reusable items, five stock adjustment types, low stock, metadata, archive, and retained history.");
}

async function checkMobile(context) {
  const longName = "Browser fixture long inventory name " + "x".repeat(80);
  await post(context, "/api/admin/inventory", {
    action: "create", name: longName, kind: "reusable", category: "Equipment", unit: "pieces",
    quantity: 12, lowStockThreshold: 2, location: "x".repeat(120), notes: "x".repeat(1000),
  });
  const storageState = await context.storageState();
  for (const width of [320, 375, 768]) {
    const mobile = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", storageState });
    const page = await mobile.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`${origin}/admin`);
    await page.getByRole("button", { name: "Inventory", exact: true }).click();
    await expect(page.getByRole("heading", { name: longName, exact: true })).toBeVisible();
    await noOverflow(page);
    await page.getByRole("button", { name: `Manage item: ${longName}`, exact: true }).click();
    await expect(page.getByRole("group", { name: "Adjust usable stock", exact: true })).toBeVisible();
    await noOverflow(page);
    if (width === 375) await saveScreenshot(page, "inventory-mobile");
    await page.getByRole("button", { name: "Expenses", exact: true }).click();
    await page.getByLabel("Month", { exact: true }).fill("2030-03");
    await expect(page.getByRole("heading", { name: "Browser fixture electricity bill", exact: true })).toBeVisible();
    await noOverflow(page);
    const targets = await page.getByRole("region", { name: "Expenses", exact: true }).getByRole("button").evaluateAll((nodes) =>
      nodes.filter((node) => node.getBoundingClientRect().width > 0).every((node) => node.getBoundingClientRect().height >= 44));
    assert.equal(targets, true, "Operations buttons need 44px tap targets.");
    const input = page.getByLabel("Search expenses", { exact: true });
    await input.focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== "none"), true);
    if (width === 375) await saveScreenshot(page, "expenses-mobile");
    await mobile.close();
  }
  console.log("PASS: 320px, 375px, and 768px layouts, long inventory content, tap targets, and keyboard focus.");
}

async function checkPaginationAndError(page) {
  for (let index = 0; index < 51; index++) {
    await post(page.context(), "/api/admin/expenses", {
      action: "create", spentDate: "2030-04-01", category: "other", amount: "1.00",
      description: `Browser pagination fixture ${index}`,
    });
  }
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  const section = page.getByRole("region", { name: "Expenses", exact: true });
  await section.getByLabel("Month", { exact: true }).fill("2030-04");
  await expect(section.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Next", exact: true }).click();
  await expect(section.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: /^Delete expense: Browser pagination fixture/ }).click();
  await section.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(section.getByText("50 matching expenses", { exact: true })).toBeVisible();
  await expect(section.getByText("No expenses recorded for this month", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Inventory", exact: true }).click();
  let releaseRead;
  const pendingRead = new Promise((resolve) => { releaseRead = resolve; });
  await page.route("**/api/admin/expenses?**", async (route) => {
    await pendingRead;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: { message: "Fixture expense load failed." } }) });
  });
  await page.getByRole("button", { name: "Expenses", exact: true }).click();
  try {
    await expect(section.getByText("Loading this month's expenses...", { exact: true })).toBeVisible();
  } finally { releaseRead(); }
  await expect(section.getByRole("alert")).toContainText("Fixture expense load failed.");
  await expect(section.getByText("Total unavailable", { exact: true })).toBeVisible();
  await page.unroute("**/api/admin/expenses?**");
  await section.getByRole("button", { name: "Retry loading", exact: true }).click();
  await expect(section.getByRole("alert")).toHaveCount(0);
  await expect(section.getByText("No expenses recorded for this month", { exact: true })).toBeVisible();
  console.log("PASS: last-page deletion recovery and controlled loading/error/retry states.");
}

async function checkFinancialSummary(page) {
  await page.getByRole("button", { name: "Financial Summary", exact: true }).click();
  const heading = page.getByRole("heading", { name: "Financial & Operating Summary", exact: true });
  await expect(heading).toBeVisible();
  const monthInput = page.getByLabel("Period", { exact: true });
  await monthInput.fill("2030-03");
  await expect(page.getByRole("heading", { name: "March 2030 Expenses", exact: true })).toBeVisible();
  await expect(page.getByText("Electricity bill", { exact: true })).toBeVisible();
  await saveScreenshot(page, "financials-desktop");
  await noOverflow(page);
  console.log("PASS: financial summary net operating income, monthly breakdown, and responsive layout.");
}

try {
  await expect.poll(async () => {
    if (server.exitCode !== null) throw new Error("The isolated local server exited before it was ready.");
    try { return (await fetch(`${origin}/admin/login`)).status; } catch { return 0; }
  }, { timeout: 30000 }).toBe(200);
  for (const route of ["expenses", "inventory", "financials"]) {
    const response = await fetch(`${origin}/api/admin/${route}`);
    assert.equal(response.status, 401);
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await signIn(page);
  await checkExpenses(page);
  await checkInventory(page);
  await checkFinancialSummary(page);
  await checkMobile(context);
  await checkPaginationAndError(page);
  const denied = await context.request.post(`${origin}/api/admin/expenses`, { headers: { Origin: "https://foreign.example" }, data: { action: "create" } });
  assert.equal(denied.status(), 403);
  const oversized = await context.request.post(`${origin}/api/admin/inventory`, { headers: { Origin: origin }, data: { action: "create", notes: "x".repeat(10000) } });
  assert.equal(oversized.status(), 413);
  assert.deepEqual(errors, [], "No browser console or application errors are expected.");
  console.log("PASS: host login, anonymous API denial, foreign-origin rejection, body-size limit, and browser console.");
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped = once(server, "exit");
    server.kill();
    await stopped;
  }
  globalThis.gc?.();
  await new Promise((resolve) => setImmediate(resolve));
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith("haus26-operations-browser-"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
