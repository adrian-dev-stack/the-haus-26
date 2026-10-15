import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import { hashAdminPassword } from "../lib/booking-auth.js";

const root = process.cwd();
const directory = await mkdtemp(path.join(os.tmpdir(), "haus26-water-browser-"));
const screenshots = path.join(root, ".booking-data");
await mkdir(screenshots, { recursive: true });
const probe = net.createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
  cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env, NODE_ENV: "production", VERCEL: "", NEXT_TELEMETRY_DISABLED: "1",
    SITE_URL: origin, BOOKING_DATABASE_URL: `file:${path.join(directory, "records.db").replaceAll("\\", "/")}`,
    BOOKING_DATABASE_AUTH_TOKEN: "", BOOKING_ALLOW_LOCAL_DATABASE: "true",
    BOOKING_ADMIN_PASSWORD_HASH: await hashAdminPassword(`fixture-host-${randomUUID()}`),
    BOOKING_SESSION_SECRET: randomUUID(), BOOKING_TOKEN_SECRET: randomUUID(),
    PAYMENT_LINK_SECRET: randomUUID(), PAYMONGO_SECRET_KEY: "sk_test_fixture_browser_water",
    PAYMENTS_LIVE_ENABLED: "false", PAYMONGO_WEBHOOK_SECRET: "", BOOKING_CALENDAR_TOKEN: "",
    BOOKING_NOTIFICATIONS_ENABLED: "false", BOOKING_NOTIFICATIONS_TEST_ENABLED: "false",
    RESEND_API_KEY: "", UNISMS_API_KEY: "", CRON_SECRET: randomUUID(),
  },
});
server.stdout.resume();
server.stderr.resume();
let browser;
let currentPage;
const errors = [];
const threeChunks = new Set();

function background(page) {
  return page.locator(".home-water-background");
}

async function observe(page) {
  await page.addInitScript(() => {
    window.fixtureWaterDraws = 0;
    for (const context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!context) continue;
      for (const method of ["drawArrays", "drawElements"]) {
        const original = context.prototype[method];
        context.prototype[method] = function (...arguments_) {
          const result = original.apply(this, arguments_);
          window.fixtureWaterDraws++;
          return result;
        };
      }
    }
  });
  const chunks = new Map();
  const pending = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && (!message.location().url || message.location().url.startsWith(origin))) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith("/_next/static/chunks/") || !url.pathname.endsWith(".js")) return;
    chunks.set(url.pathname, null);
    pending.push(response.text().then((source) => chunks.set(url.pathname, source)).catch(() => {}));
  });
  return { chunks, async settle() { await Promise.all(pending); } };
}

async function openHome(page) {
  currentPage = page;
  await page.goto(origin);
  await expect(page.getByRole("heading", { level: 1, name: "Your Private Villa & Pool Escape in Bataan.", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "Essential Cookies & Storage", exact: true }).getByRole("button", { name: "Got it", exact: true }).click();
  await expect(background(page)).toBeVisible();
  await expect(background(page)).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".pool-scene, .hero-pool-visual")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Make a ripple", exact: true })).toHaveCount(0);
  const photo = page.getByRole("link", { name: "See the house photo gallery", exact: true });
  await expect(photo).toBeVisible();
  const image = photo.locator("img");
  await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0), {
    message: "The original property photograph must load.",
  }).toBe(true);
  assert.ok((await photo.boundingBox()).width > 250, "The property photograph must remain the full hero visual.");
  const style = await background(page).evaluate((node) => {
    const style = getComputedStyle(node);
    return { position: style.position, inset: style.inset, pointerEvents: style.pointerEvents };
  });
  assert.deepEqual(style, { position: "fixed", inset: "0px", pointerEvents: "none" }, "Three.js must remain an inert, viewport-wide background.");
}

async function noOverflow(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, "The homepage must fit its viewport.");
}

async function contentWorks(page) {
  const dateLink = page.getByRole("link", { name: "Check Dates & Book", exact: true });
  await dateLink.focus();
  await expect(dateLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin}/#calendar`);
  await expect(page.getByRole("heading", { name: /Pick your preferred\s+stay dates\./ })).toBeInViewport();
  await page.getByRole("link", { name: /^View Rates \(From / }).click();
  await expect(page).toHaveURL(`${origin}/#rates`);
  await expect(page.getByRole("heading", { name: "Simple pricing for every group.", exact: true })).toBeInViewport();
  await page.getByRole("link", { name: /^View all \d+ photos$/ }).click();
  await expect(page).toHaveURL(`${origin}/#gallery`);
  const opener = page.getByRole("button", { name: /^View photo 1 of / });
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Close photo viewer", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Next photo", exact: true }).click();
  await expect(dialog.getByText(/^Photo 2 of /)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await noOverflow(page);
}

async function screenshot(page, name) {
  const filename = path.join(screenshots, `background-only-${name}.png`);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.screenshot({ path: filename });
  console.log(`Screenshot: ${filename}`);
}

async function pixelFrame(canvas) {
  return canvas.evaluate(async (node) => {
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(requestAnimationFrame);
      const copy = document.createElement("canvas");
      copy.width = 48;
      copy.height = 48;
      const context = copy.getContext("2d");
      context.drawImage(node, 0, 0, 48, 48);
      const values = context.getImageData(0, 0, 48, 48).data;
      const colors = new Set();
      let visible = 0;
      for (let index = 0; index < values.length; index += 4) {
        if (!values[index + 3]) continue;
        visible++;
        colors.add(`${values[index]},${values[index + 1]},${values[index + 2]}`);
      }
      if (visible && colors.size > 1) return { visible, colors: colors.size, values: Array.from(values) };
    }
    return { visible: 0, colors: 0, values: [] };
  });
}

async function measureWaterMovement(canvas, initialFrame, label) {
  const frames = [initialFrame];
  const startedAt = Date.now();
  for (let index = 1; index < 4; index++) {
    const sampleAt = startedAt + index * (2000 / 3);
    // Sample a short animation interval instead of accepting a single changed pixel.
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, sampleAt - Date.now())));
    const frame = await pixelFrame(canvas);
    assert.ok(frame.visible > 0 && frame.colors > 1, "Every movement sample must contain rendered water pixels.");
    frames.push(frame);
  }
  const totals = { edge: 0, center: 0 };
  const counts = { edge: 0, center: 0 };
  for (const frame of frames.slice(1)) {
    for (let index = 0; index < frame.values.length; index += 4) {
      const x = ((index / 4) % 48 + 0.5) / 48;
      const region = x < 0.2 || x > 0.8 ? "edge" : x > 0.35 && x < 0.65 ? "center" : null;
      if (!region) continue;
      for (let channel = 0; channel < 3; channel++) {
        totals[region] += Math.abs(frame.values[index + channel] - initialFrame.values[index + channel]);
        counts[region]++;
      }
    }
  }
  const edge = totals.edge / counts.edge;
  const center = totals.center / counts.center;
  assert.ok(edge > 0.5, `${label}: water movement must visibly change more than isolated pixels (mean edge RGB change ${edge.toFixed(3)}).`);
  assert.ok(edge > center, `${label}: the background edges must animate more strongly than its calm center (edge ${edge.toFixed(3)}, center ${center.toFixed(3)}).`);
  console.log(`PASS: ${label} water movement across 4 frames in 2 seconds; mean RGB change edges ${edge.toFixed(3)}, center ${center.toFixed(3)}.`);
}

async function renderedWater(page, movementLabel = null) {
  await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
  const canvas = background(page).locator("canvas");
  await expect(canvas).toHaveCount(1);
  assert.equal(await canvas.evaluate((node) => Boolean(node.closest('[aria-hidden="true"]'))), true, "The decorative background canvas must be hidden from the accessibility tree.");
  assert.equal(await canvas.evaluate((node) => Boolean(node.getContext("webgl2") || node.getContext("webgl"))), true, "The background must use a real WebGL context.");
  const pixels = await pixelFrame(canvas);
  assert.ok(pixels.visible > 0 && pixels.colors > 20, "The WebGL background must render visible, nonuniform pixels.");
  if (movementLabel) {
    await measureWaterMovement(canvas, pixels, movementLabel);
    return;
  }
  const first = createHash("sha256").update(Buffer.from(pixels.values)).digest("hex");
  await expect.poll(async () => {
    const next = await pixelFrame(canvas);
    assert.ok(next.visible > 0 && next.colors > 1);
    return createHash("sha256").update(Buffer.from(next.values)).digest("hex");
  }, {
    timeout: 10000, intervals: [150, 300, 500, 1000], message: "The visible water must animate between captured frames.",
  }).not.toBe(first);
}

async function assertNoThree(observation) {
  await observation.settle();
  for (const chunk of threeChunks) assert.equal(observation.chunks.has(chunk), false, "Static fallback must not download Three.js.");
}

async function checkDesktop() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const observation = await observe(page);
  try {
    await openHome(page);
    await renderedWater(page, "Desktop 1440px");
    await observation.settle();
    for (const [chunk, source] of observation.chunks) {
      if (/THREE\.WebGLRenderer|THREE\.WebGLProgram|threejs\.org\/docs/.test(source || "")) threeChunks.add(chunk);
    }
    assert.ok(threeChunks.size, "The production browser must load a separate Three.js chunk.");
    assert.ok((await page.locator(".hero-photo-frame").boundingBox()).width > 300, "The desktop hero must retain a large property photograph.");
    await noOverflow(page);
    await screenshot(page, "desktop");
    const pause = page.getByRole("button", { name: "Pause background", exact: true });
    assert.equal(await pause.evaluate((node) => Boolean(node.closest("footer"))), true, "Animation controls belong in the footer.");
    await pause.scrollIntoViewIfNeeded();
    await expect(pause).toBeInViewport();
    await expect(background(page)).toHaveAttribute("data-state", "ready");
    await pause.focus();
    await page.keyboard.press("Enter");
    await expect(background(page)).toHaveAttribute("data-state", "paused");
    const pausedDraws = await page.evaluate(() => window.fixtureWaterDraws);
    for (let index = 0; index < 3; index++) {
      await page.evaluate(() => new Promise(requestAnimationFrame));
      assert.equal(await page.evaluate(() => window.fixtureWaterDraws), pausedDraws, "Paused water must stop WebGL draw calls.");
    }
    await page.getByRole("button", { name: "Play background", exact: true }).click();
    await expect(background(page)).toHaveAttribute("data-state", "ready");
    await expect.poll(() => page.evaluate(() => window.fixtureWaterDraws)).toBeGreaterThan(pausedDraws);
    await contentWorks(page);
    const originalCanvas = await background(page).locator("canvas").elementHandle();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(background(page)).toHaveAttribute("data-state", "fallback");
    await expect(background(page).locator("canvas")).toHaveCount(0);
    assert.equal(await originalCanvas.evaluate((node) => node.isConnected), false, "Live reduced motion must remove the existing canvas.");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
    await expect(background(page).locator("canvas")).toHaveCount(1);
    assert.equal(await originalCanvas.evaluate((node) => node === document.querySelector(".home-water-background canvas")), false);
    await page.emulateMedia({ forcedColors: "active", colorScheme: "dark" });
    await expect(background(page)).toHaveAttribute("data-state", "fallback");
    await expect(background(page).locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pause background", exact: true })).toHaveCount(0);
    const contrastColors = await page.getByRole("heading", { level: 1 }).evaluate((node) => ({
      text: getComputedStyle(node).color, surface: getComputedStyle(document.body).backgroundColor,
    }));
    assert.notEqual(contrastColors.text, contrastColors.surface, "Forced-color text must remain distinct from the system surface.");
    await page.emulateMedia({ forcedColors: "none", colorScheme: "light" });
    await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
    await expect(background(page).locator("canvas")).toHaveCount(1);
    await page.goto(`${origin}/admin/login`);
    await expect(page.getByLabel("Host Password", { exact: true })).toBeVisible();
    await expect(background(page)).toHaveCount(0);
    console.log("PASS: restored hero photograph, fixed inert animated WebGL background, footer pause/play, desktop layout, keyboard booking/rates/gallery, live reduced motion and forced colors cleanup, and no admin background.");
  } finally { await context.close(); }
}

async function checkMobile() {
  for (const width of [375, 315]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await observe(page);
    try {
      await openHome(page);
      await renderedWater(page, `Mobile ${width}px`);
      await noOverflow(page);
      if (width === 375) {
        await screenshot(page, "mobile");
      }
      await contentWorks(page);
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
      await noOverflow(page);
    } finally { await context.close(); }
  }
  console.log("PASS: background WebGL, restored property photograph, content interactions, menu keyboard behavior, and no overflow at 375px and 315px.");
}

async function checkStatic(mode) {
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 }, reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference",
    forcedColors: mode === "forced-colors" ? "active" : "none", colorScheme: mode === "forced-colors" ? "dark" : "light",
  });
  if (mode === "save-data") {
    await context.addInitScript(() => {
      const connection = navigator.connection || new EventTarget();
      Object.defineProperty(connection, "saveData", { configurable: true, get: () => true });
      Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
    });
  }
  if (mode === "unavailable-webgl") {
    await context.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (name, ...options) {
        if (["webgl", "webgl2", "experimental-webgl"].includes(name)) return null;
        return getContext.call(this, name, ...options);
      };
    });
  }
  const page = await context.newPage();
  const observation = await observe(page);
  try {
    await openHome(page);
    await expect(background(page)).toHaveAttribute("data-state", "fallback");
    await expect(background(page).locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pause background", exact: true })).toHaveCount(0);
    if (mode !== "unavailable-webgl") await assertNoThree(observation);
    await noOverflow(page);
    await contentWorks(page);
    console.log(`PASS: ${mode} static fallback keeps all content usable${mode === "unavailable-webgl" ? "." : " without downloading Three.js."}`);
  } finally { await context.close(); }
}

async function checkVisibility() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    let hidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" });
    window.fixtureSetHidden = (value) => { hidden = value; document.dispatchEvent(new Event("visibilitychange")); };
  });
  const page = await context.newPage();
  await observe(page);
  try {
    await openHome(page);
    await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
    await page.evaluate(() => window.fixtureSetHidden(true));
    await expect(background(page)).toHaveAttribute("data-state", "paused");
    await page.evaluate(() => window.fixtureSetHidden(false));
    await expect(background(page)).toHaveAttribute("data-state", "ready");
    await expect(background(page).locator("canvas")).toHaveCount(1);
    await page.getByRole("heading", { name: "Simple pricing for every group.", exact: true }).scrollIntoViewIfNeeded();
    await expect(background(page)).toHaveAttribute("data-state", "ready");
    assert.equal((await background(page).boundingBox()).y, 0, "The animated background must remain fixed while scrolling.");
    console.log("PASS: hidden-tab pause/resume and viewport-fixed animation while scrolling.");
  } finally { await context.close(); }
}

async function checkContextLoss() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await observe(page);
  try {
    await openHome(page);
    await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
    assert.equal(await background(page).locator("canvas").evaluate((node) => {
      const extension = node.getContext("webgl2").getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      return true;
    }), true, "Chromium must expose its context-loss test extension.");
    await expect(background(page)).toHaveAttribute("data-state", "fallback");
    await expect(background(page).locator("canvas")).toHaveCount(0);
    await contentWorks(page);
    console.log("PASS: a real lost WebGL context removes the decoration while booking/rates/gallery remain usable.");
  } finally { await context.close(); }
}

async function checkLiveSaveData() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    let saveData = false;
    const connection = new EventTarget();
    Object.defineProperty(connection, "saveData", { get: () => saveData });
    Object.defineProperty(navigator, "connection", { configurable: true, value: connection });
    window.fixtureSetSaveData = (value) => { saveData = value; connection.dispatchEvent(new Event("change")); };
  });
  const page = await context.newPage();
  await observe(page);
  try {
    await openHome(page);
    await renderedWater(page);
    await page.evaluate(() => window.fixtureSetSaveData(true));
    await expect(background(page)).toHaveAttribute("data-state", "fallback");
    await expect(background(page).locator("canvas")).toHaveCount(0);
    await page.evaluate(() => window.fixtureSetSaveData(false));
    await expect(background(page)).toHaveAttribute("data-state", "ready", { timeout: 20000 });
    await expect(background(page).locator("canvas")).toHaveCount(1);
    console.log("PASS: live data-saving preference disposes and safely recreates the background canvas.");
  } finally { await context.close(); }
}

async function checkAdmin() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const observation = await observe(page);
  try {
    currentPage = page;
    await page.goto(`${origin}/admin/login`);
    await expect(page.getByLabel("Host Password", { exact: true })).toBeVisible();
    await expect(background(page)).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
    await assertNoThree(observation);
    assert.equal(await page.evaluate(() => window.fixtureWaterDraws), 0, "The admin page must not create WebGL work.");
    console.log("PASS: a fresh admin page creates no background canvas, downloads no Three.js, and issues no WebGL draws.");
  } finally { await context.close(); }
}

try {
  await expect.poll(async () => {
    if (server.exitCode !== null) throw new Error("The isolated local server exited before it was ready. Run npm run build before this check.");
    try { return (await fetch(`${origin}/admin/login`)).status; } catch { return 0; }
  }, { timeout: 30000 }).toBe(200);
  browser = await chromium.launch({ headless: true, chromiumSandbox: true });
  if (process.argv.includes("--screenshots-only")) {
    for (const width of [1440, 375]) {
      const context = await browser.newContext({ viewport: { width, height: width === 375 ? 900 : 1000 }, isMobile: width === 375, hasTouch: width === 375 });
      const page = await context.newPage();
      await observe(page);
      try {
        await openHome(page);
        await renderedWater(page);
        await screenshot(page, width === 375 ? "mobile" : "desktop");
      } finally { await context.close(); }
    }
  } else {
    await checkDesktop();
    await checkMobile();
    await checkStatic("reduced-motion");
    await checkStatic("save-data");
    await checkStatic("forced-colors");
    await checkStatic("unavailable-webgl");
    await checkVisibility();
    await checkContextLoss();
    await checkLiveSaveData();
    await checkAdmin();
  }
  assert.deepEqual(errors, [], "No application or first-party browser console errors are expected.");
  console.log("PASS: homepage background browser checks completed against an isolated production server.");
} catch (error) {
  if (currentPage && !currentPage.isClosed()) await currentPage.screenshot({ path: path.join(screenshots, "water-home-failure.png") }).catch(() => {});
  throw error;
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
  assert.ok(path.basename(resolved).startsWith("haus26-water-browser-"));
  await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
