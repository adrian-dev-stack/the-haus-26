import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getHostCalendarUrl, verifyCalendarToken } from "../lib/booking-calendar-auth.js";

const calendarToken = "calendar-fixture-token-0123456789-abcdef";
const credentialEnv = {
  BOOKING_CALENDAR_TOKEN: calendarToken,
  BOOKING_SESSION_SECRET: "session-fixture-secret-0123456789-abcdef",
  BOOKING_TOKEN_SECRET: "booking-fixture-secret-0123456789-abcdef",
  PAYMENT_LINK_SECRET: "payment-fixture-secret-0123456789-abcdef",
  CRON_SECRET: "cron-fixture-secret-0123456789-abcdef",
};
const fixtures = new Map();
globalThis.__haus26CalendarRouteFixtures = fixtures;
let fixtureId = 0;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function routeFixture(operation, { signedIn = false, limited = false } = {}) {
  const id = ++fixtureId;
  const calls = { sessions: 0, passwords: 0, calendars: 0, limits: [] };
  const saved = Object.fromEntries(Object.keys(credentialEnv).map((key) => [key, process.env[key]]));
  Object.assign(process.env, credentialEnv);
  fixtures.set(id, {
    async getAdminSession() { calls.sessions++; return signedIn; },
    async verifyAdminPassword(key) { calls.passwords++; return key === "host-password-fixture-0123456789"; },
    async getCalendarEvents() {
      calls.calendars++;
      return { bookings: [{ id: "fixture", reference: "H26-FIXTURE", name: "Private Fixture Guest", phone: "+639123456789", email: "private@example.test", stayDate: "2030-01-02", guests: 4, days: 1, totalAmount: 500000, depositAmount: 250000 }], blockedDates: [] };
    },
    async limitBookingRequest(_request, scope, maximum) {
      calls.limits.push({ scope, maximum });
      if (limited) throw Object.assign(new Error("Too many attempts."), { status: 429, code: "rate-limited" });
    },
  });
  try {
    // Keep the real route and ICS renderer; replace Next request-context and database boundaries.
    const mocks = moduleUrl(`
      const fixture = globalThis.__haus26CalendarRouteFixtures.get(${id});
      export const getAdminSession = (...args) => fixture.getAdminSession(...args);
      export const verifyAdminPassword = (...args) => fixture.verifyAdminPassword(...args);
      export const getCalendarEvents = (...args) => fixture.getCalendarEvents(...args);
      export const limitBookingRequest = (...args) => fixture.limitBookingRequest(...args);
      export class BookingHttpError extends Error { constructor(code, message, status) { super(message); this.code=code; this.status=status; } }
      export const bookingFailure = (error) => new Response(JSON.stringify({ error: { code: error.code || 'unavailable' } }), { status: error.status || 503, headers: { 'Cache-Control': 'private, no-store' } });
    `);
    const imports = {
      "@/lib/bookings": mocks,
      "@/lib/booking-auth": mocks,
      "@/lib/booking-http": mocks,
      "@/lib/booking-ical": new URL("../lib/booking-ical.js", import.meta.url).href,
      "@/lib/booking-calendar-auth": new URL("../lib/booking-calendar-auth.js", import.meta.url).href,
    };
    let source = await readFile(new URL("../app/api/calendar.ics/route.js", import.meta.url), "utf8");
    for (const [specifier, replacement] of Object.entries(imports)) source = source.replaceAll(JSON.stringify(specifier), JSON.stringify(replacement));
    const route = await import(moduleUrl(source + `\n// fixture ${id}`));
    await operation(route.GET, calls);
  } finally {
    fixtures.delete(id);
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const request = (query = "") => new Request(`https://haus.example/api/calendar.ics${query}`);

test("calendar subscription URL requires its dedicated configured token", () => {
  const { BOOKING_CALENDAR_TOKEN: _token, ...coreSecrets } = credentialEnv;
  assert.equal(getHostCalendarUrl(coreSecrets), null);
  assert.equal(getHostCalendarUrl(credentialEnv), `/api/calendar.ics?key=${calendarToken}`);
  for (const value of Object.values(coreSecrets)) assert.equal(verifyCalendarToken(value, coreSecrets), false);
});

test("calendar token verification rejects missing, malformed, or tampered credentials", () => {
  for (const token of [undefined, null, "", "short", " ".repeat(32), "a".repeat(257), "a".repeat(32) + "\n", "é".repeat(32)]) {
    assert.equal(getHostCalendarUrl({ BOOKING_CALENDAR_TOKEN: token }), null);
    assert.equal(verifyCalendarToken(token, { BOOKING_CALENDAR_TOKEN: token }), false);
  }
  for (const supplied of [undefined, null, "", calendarToken + "x", "x" + calendarToken.slice(1), "é" + calendarToken.slice(1)]) {
    assert.equal(verifyCalendarToken(supplied, credentialEnv), false);
  }
  assert.equal(verifyCalendarToken(calendarToken, credentialEnv), true);
});

test("rotating only the calendar token revokes its old subscription URL", () => {
  const rotated = { ...credentialEnv, BOOKING_CALENDAR_TOKEN: "rotated-calendar-fixture-token-0123456789" };
  assert.equal(verifyCalendarToken(calendarToken, rotated), false);
  assert.equal(verifyCalendarToken(rotated.BOOKING_CALENDAR_TOKEN, rotated), true);
  assert.equal(getHostCalendarUrl(rotated), `/api/calendar.ics?key=${rotated.BOOKING_CALENDAR_TOKEN}`);
});

test("calendar feed authorizes a dedicated token without checking the admin password or cookie", async () => {
  await routeFixture(async (GET, calls) => {
    const response = await GET(request(`?key=${calendarToken}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Calendar-Role"), "host");
    assert.match(await response.text(), /Private Fixture Guest/);
    assert.equal(calls.passwords, 0);
    assert.equal(calls.sessions, 0);
    assert.equal(calls.limits.length, 0);
  });
});

test("calendar feed rejects core application secrets as feed credentials", async () => {
  await routeFixture(async (GET, calls) => {
    for (const key of Object.values(credentialEnv).filter((value) => value !== calendarToken)) {
      assert.equal((await GET(request(`?key=${key}`))).status, 401);
    }
    assert.equal(calls.calendars, 0);
    assert.equal(calls.passwords, 0);
    assert.equal(calls.limits.length, 4);
  });
});

test("calendar feed never accepts or checks the host password", async () => {
  await routeFixture(async (GET, calls) => {
    const response = await GET(request("?key=host-password-fixture-0123456789"));
    assert.equal(response.status, 401);
    assert.equal(calls.passwords, 0);
    assert.equal(calls.calendars, 0);
  });
});

test("an invalid supplied calendar key cannot fall back to an active host cookie", async () => {
  await routeFixture(async (GET, calls) => {
    for (const query of ["?key=incorrect", "?key=", `?key=${calendarToken}&key=incorrect`]) {
      const response = await GET(request(query));
      assert.equal(response.status, 401);
      assert.match(response.headers.get("Cache-Control"), /no-store/);
    }
    assert.equal(calls.sessions, 0);
    assert.equal(calls.calendars, 0);
  }, { signedIn: true });
});

test("invalid calendar credentials obey the existing request rate limit", async () => {
  await routeFixture(async (GET, calls) => {
    const response = await GET(request("?key=incorrect"));
    assert.equal(response.status, 429);
    assert.deepEqual(calls.limits, [{ scope: "calendar-auth", maximum: 10 }]);
    assert.equal(calls.calendars, 0);
    assert.equal(calls.passwords, 0);
  }, { limited: true });
});

test("public calendar without a supplied key stays redacted", async () => {
  await routeFixture(async (GET) => {
    const response = await GET(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Calendar-Role"), "public");
    const feed = await response.text();
    assert.match(feed, /Reserved/);
    assert.doesNotMatch(feed, /Private Fixture Guest|private@example\.test|639123456789/);
  });
});

test("host browser access without a supplied key still uses its session", async () => {
  await routeFixture(async (GET, calls) => {
    const response = await GET(request());
    assert.equal(response.headers.get("X-Calendar-Role"), "host");
    assert.equal(calls.sessions, 1);
    assert.equal(calls.passwords, 0);
    assert.equal(calls.limits.length, 0);
  }, { signedIn: true });
});
