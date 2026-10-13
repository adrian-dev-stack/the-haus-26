import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import {
  calculateBookingTotal, cancelBooking, confirmBooking, createBookingRequest, getAdminBooking, getBookingByPaymentReference,
  getBookingStore, getGuestBooking, getUnavailableDates, initializeBookingStore, listAdminBookings,
  refreshBookingPayment, syncBookingFromPayment, HOLD_DURATION_MS,
  addBlockedDate, getBlockedDates, removeBlockedDate, markBalancePaid,
  getStayDates, getCheckOutDate, runBookingMaintenance, getBookingEvents, recordBookingEvent,
  refundAndCancelBooking,
} from "../lib/bookings.js";

import { getPaymentConfig, readPaymentToken } from "../lib/payments.js";

const env = {
  PAYMONGO_SECRET_KEY: "sk_test_fake_for_booking_tests",
  PAYMENT_LINK_SECRET: "booking-tests-only-payment-secret-32-characters",
  SITE_URL: "http://localhost:3000",
  BOOKING_TOKEN_SECRET: "booking-tests-only-token-secret-32-characters",
};
Object.assign(process.env, env);
const config = getPaymentConfig(env);
const live = getPaymentConfig({ ...env, PAYMONGO_SECRET_KEY: "sk_live_fake_for_booking_tests", SITE_URL: "https://haus.example", PAYMENTS_LIVE_ENABLED: "true" });
const now = new Date("2030-01-01T16:10:00Z").getTime();
const rejectCode = (code) => (error) => error?.code === code;
const input = (overrides = {}) => ({ requestId: randomUUID(), name: "Test Guest", email: "guest@example.test", phone: "+639123456789",
  date: "2030-02-01", guests: 4, occasion: "Family stay", notes: "Private request notes", consent: true, ...overrides });
const approved = { totalAmount: 500000, terms: "22-hour stay. Final arrival and departure times confirmed with the host." };

test("a released refunded cancellation remains cancelled after repeated payment updates", async () => {
  await database(async (client) => {
    const fake = provider();
    const { booking } = await create(client);
    const pending = await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    const request = readPaymentToken(pending.paymentToken, config);
    fake.pay(request.sessionId, { refunds: [{ attributes: { amount: request.depositAmount, status: "succeeded" } }] });
    await refundAndCancelBooking(booking.id, { reason: "Guest refund verified and dates released" }, { client, config, fetchImpl: fake.fetchImpl });
    for (const status of ["refunded", "paid", "refunded"]) {
      await syncBookingFromPayment({ request, status, paymentId: `pay_${request.sessionId}` }, { client, now });
      const checked = await getAdminBooking(booking.id, { client });
      assert.equal(checked.status, "cancelled");
      assert.equal(checked.paymentStatus, "refunded");
      assert.deepEqual(await getUnavailableDates({ client, config }), []);
    }
  });
});

test("public availability never invokes payment maintenance even for overdue checkouts", async () => {
  await database(async (client) => {
    const fake = provider();
    const { booking } = await create(client);
    await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    const overdue = Date.now() - HOLD_DURATION_MS - 60000;
    await client.execute({ sql: "UPDATE bookings SET checkout_started_at=? WHERE id=?", args: [overdue, booking.id] });
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("Public reads must not contact payment providers"); };
    try {
      assert.deepEqual(await getUnavailableDates({ client, config }), [booking.date]);
      assert.equal(calls, 0);
      assert.equal((await getAdminBooking(booking.id, { client })).paymentIssue, null);
    } finally { globalThis.fetch = originalFetch; }
  });
});

async function database(operation) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "haus26-bookings-"));
  const url = `file:${path.join(directory, "bookings.db").replaceAll("\\", "/")}`;
  const client = createClient({ url });
  await initializeBookingStore(client);
  try { await operation(client, url); }
  finally {
    client.close();
    // Native SQLite statement finalizers can retain Windows file handles until GC.
    globalThis.gc?.();
    await new Promise((resolve) => setImmediate(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("haus26-bookings-"));
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
}

function provider(mode = false) {
  const sessions = new Map();
  const keys = new Map();
  const fixture = { sessions, calls: [], creationCalls: 0, expirations: 0, failCreateOnce: false, failExpire: false, badReference: false };
  fixture.fetchImpl = async (url, options) => {
    fixture.calls.push({ url, method: options.method, key: options.headers["Idempotency-Key"] });
    let resource;
    if (url.endsWith("/v2/checkout_sessions")) {
      fixture.creationCalls++;
      const key = options.headers["Idempotency-Key"];
      const attributes = JSON.parse(options.body).data.attributes;
      if (!keys.has(key)) {
        const id = `cs_booking_test_${sessions.size + 1}`;
        keys.set(key, id);
        sessions.set(id, { id, type: "checkout_session", attributes: { ...attributes, livemode: mode, status: "active", checkout_url: "https://checkout.paymongo.com/booking-test", payments: [] } });
      }
      resource = sessions.get(keys.get(key));
      if (fixture.failCreateOnce) { fixture.failCreateOnce = false; throw new Error("Lost response after provider persisted session"); }
    } else {
      const id = url.split("/").at(url.endsWith("/expire") ? -2 : -1);
      resource = sessions.get(id);
      assert.ok(resource, "Only the persisted checkout is retrieved");
      if (url.endsWith("/expire")) {
        fixture.expirations++;
        if (fixture.failExpire) throw new Error("Provider expiration unavailable");
        resource.attributes.status = "expired";
      }
    }
    const returned = structuredClone(resource);
    if (fixture.badReference) returned.attributes.reference_number = "H26-WRONG-REFERENCE";
    return { ok: true, json: async () => ({ data: returned }) };
  };
  fixture.pay = (id, overrides = {}) => {
    const session = sessions.get(id);
    session.attributes.payments = [{ id: `pay_${id}`, attributes: { status: "paid", currency: "PHP", amount: session.attributes.line_items[0].amount, livemode: mode, refunds: [], ...overrides } }];
  };
  return fixture;
}

async function create(client, overrides = {}, options = {}) {
  return createBookingRequest(input(overrides), { client, now, config, ...options });
}

test("local development DB is durable and production/Vercel fail closed without a remote store", async () => {
  await assert.rejects(getBookingStore({ env: { NODE_ENV: "production", SITE_URL: "http://localhost:3000" } }), rejectCode("store-not-configured"));
  await assert.rejects(getBookingStore({ env: { VERCEL: "1", BOOKING_DATABASE_URL: "file:bookings.db", BOOKING_ALLOW_LOCAL_DATABASE: "true" } }), rejectCode("store-not-configured"));
  await assert.rejects(getBookingStore({ env: { BOOKING_DATABASE_URL: "https://db.example" } }), rejectCode("store-not-configured"));
  await database(async (client, url) => {
    const { booking, token } = await create(client);
    const reopened = createClient({ url });
    try { assert.equal((await getAdminBooking(booking.id, { client: reopened })).reference, booking.reference); }
    finally { reopened.close(); }
  });
});

test("requests retain private contact only for admin and store only a hash of guest links", async () => {
  await database(async (client) => {
    const { booking, token } = await create(client);
    assert.equal(token.length, 43);
    const guest = await getGuestBooking(token, { client });
    for (const field of ["name", "email", "phone", "notes", "guest_token_hash", "request_id", "session_id"]) assert.equal(guest[field], undefined);
    assert.ok(!JSON.stringify(guest).includes("guest@example.test"));
    const stored = (await client.execute("SELECT * FROM bookings")).rows[0];
    assert.ok(!JSON.stringify(stored).includes(token));
    const admin = await getAdminBooking(booking.id, { client });
    assert.equal(admin.email, "guest@example.test");
    assert.equal(admin.guestUrl, `http://localhost:3000/book/${token}`);
    await assert.rejects(getGuestBooking(`${token.slice(0, 20)}x${token.slice(21)}`, { client }), rejectCode("not-found"));
    assert.deepEqual(await getUnavailableDates({ client, config }), [], "A request alone never holds a date");
  });
});

test("stable form IDs replay the original link and reject payload or token-secret changes", async () => {
  await database(async (client) => {
    const body = input();
    const first = await createBookingRequest(body, { client, now, config });
    const replay = await createBookingRequest({ ...body, name: `  ${body.name}  ` }, { client, now, config });
    assert.equal(replay.replayed, true);
    assert.equal(replay.token, first.token);
    assert.equal(replay.booking.id, first.booking.id);
    await assert.rejects(createBookingRequest({ ...body, guests: 5 }, { client, now, config }), rejectCode("request-conflict"));
    await assert.rejects(createBookingRequest(body, { client, now, config, tokenSecret: "rotated-booking-test-token-secret-32-chars" }), rejectCode("request-conflict"));
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM bookings")).rows[0].count, 1);
  });
});

test("Manila date, valid contact, guest count, consent, and confirmed-property blocks are enforced", async () => {
  await database(async (client) => {
    for (const overrides of [{ date: "2030-01-01" }, { date: "2030-01-02" }, { date: "2030-02-30" }, { guests: 1000 }, { guests: "4" }, { email: "invalid" }, { consent: false }, { notes: "x".repeat(1001) }]) {
      await assert.rejects(create(client, overrides), rejectCode("invalid-request"));
    }
    await assert.rejects(create(client, {}, { blockedDates: ["2030-02-01"] }), rejectCode("date-unavailable"));
    const { booking } = await create(client);
    await assert.rejects(confirmBooking(booking.id, approved, { client, config, now, blockedDates: [booking.date] }), rejectCode("date-unavailable"));
    assert.deepEqual(await getUnavailableDates({ client, config }), []);
  });
});

test("approval holds one date, freezes the 50% quote, and reuses a single verified checkout", async () => {
  await database(async (client) => {
    const { booking, token } = await create(client);
    const fake = provider();
    const confirmed = await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    assert.equal(confirmed.status, "awaiting_payment");
    assert.equal(confirmed.depositAmount, 250000);
    assert.equal(readPaymentToken(confirmed.paymentToken, config).depositAmount, 250000);
    assert.deepEqual(await getUnavailableDates({ client, config }), [booking.date]);
    await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    assert.equal(fake.creationCalls, 1);
    await assert.rejects(confirmBooking(booking.id, { ...approved, totalAmount: 600000 }, { client, config, now, fetchImpl: fake.fetchImpl }), rejectCode("booking-conflict"));
    assert.equal((await getGuestBooking(token, { client })).terms, approved.terms);
    await assert.rejects(create(client), rejectCode("date-unavailable"));
  });
});

test("two admin approvals racing across SQLite connections cannot double-book a date", async () => {
  await database(async (client, url) => {
    const first = await create(client);
    const second = await create(client);
    const other = createClient({ url });
    await initializeBookingStore(other);
    const fake = provider();
    try {
      const results = await Promise.allSettled([
        confirmBooking(first.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl }),
        confirmBooking(second.booking.id, approved, { client: other, config, now, fetchImpl: fake.fetchImpl }),
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      const failure = results.find((result) => result.status === "rejected").reason;
      assert.ok(["date-unavailable", "booking-busy"].includes(failure.code), failure.code);
      assert.equal(fake.sessions.size, 1);
      assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_holds")).rows[0].count, 1);
      const rejected = results[0].status === "rejected" ? first : second;
      await assert.rejects(confirmBooking(rejected.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl }), rejectCode("date-unavailable"));
    } finally { other.close(); }
  });
});

test("ambiguous provider creation keeps its hold and idempotency key, with bounded retry", async () => {
  await database(async (client) => {
    const first = await create(client);
    const fake = provider(); fake.failCreateOnce = true;
    await assert.rejects(confirmBooking(first.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl }), rejectCode("provider-unavailable"));
    assert.deepEqual(await getUnavailableDates({ client, config }), [first.booking.date]);
    await assert.rejects(cancelBooking(first.booking.id, { reason: "Changed plans" }, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("payment-review-required"));
    await confirmBooking(first.booking.id, approved, { client, config, now: now + 1000, fetchImpl: fake.fetchImpl });
    assert.equal(fake.sessions.size, 1);
    assert.equal(fake.calls[0].key, fake.calls[1].key);
    const second = await create(client, { date: "2030-02-02" }); fake.failCreateOnce = true;
    await assert.rejects(confirmBooking(second.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl }), rejectCode("provider-unavailable"));
    const calls = fake.creationCalls;
    await assert.rejects(confirmBooking(second.booking.id, approved, { client, config, now: now + 24 * 60 * 60 * 1000, fetchImpl: fake.fetchImpl }), rejectCode("payment-review-required"));
    assert.equal(fake.creationCalls, calls);
  });
});

test("test deposits are clearly separate from live reservations and availability", async () => {
  await database(async (client) => {
    const request = await create(client);
    const fake = provider();
    const pending = await confirmBooking(request.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    const sessionId = readPaymentToken(pending.paymentToken, config).sessionId;
    fake.pay(sessionId);
    assert.equal((await refreshBookingPayment(request.booking.id, { client, config, fetchImpl: fake.fetchImpl })).status, "test_paid");
    assert.deepEqual(await getUnavailableDates({ client, config: live }), []);
    const real = await create(client, {}, { config: live });
    const liveProvider = provider(true);
    const realPending = await confirmBooking(real.booking.id, approved, { client, config: live, now, fetchImpl: liveProvider.fetchImpl });
    liveProvider.pay(readPaymentToken(realPending.paymentToken, live).sessionId);
    assert.equal((await refreshBookingPayment(real.booking.id, { client, config: live, fetchImpl: liveProvider.fetchImpl })).status, "confirmed");
    assert.deepEqual(await getUnavailableDates({ client, config: live }), [request.booking.date]);
    await assert.rejects(refreshBookingPayment(request.booking.id, { client, config: live, fetchImpl: fake.fetchImpl }), rejectCode("payment-mode-mismatch"));
  });
});

test("only matching provider amounts and checkout details can mark a booking paid", async () => {
  await database(async (client) => {
    const { booking, token } = await create(client);
    const fake = provider();
    const pending = await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    const sessionId = readPaymentToken(pending.paymentToken, config).sessionId;
    fake.pay(sessionId, { amount: 1 });
    await assert.rejects(refreshBookingPayment(booking.id, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("request-mismatch"));
    assert.equal((await getAdminBooking(booking.id, { client })).status, "awaiting_payment");
    fake.pay(sessionId);
    fake.badReference = true;
    await assert.rejects(refreshBookingPayment(booking.id, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("request-mismatch"));
    const saved = await getGuestBooking(token, { client, refreshPayment: true, config, fetchImpl: fake.fetchImpl });
    assert.equal(saved.paymentCheckFailed, true);
    assert.equal(saved.paymentToken, null, "Do not offer a checkout while its verification failed");
    assert.deepEqual(await getUnavailableDates({ client, config }), [booking.date]);
    fake.badReference = false;
    assert.equal((await getGuestBooking(token, { client, refreshPayment: true, config, fetchImpl: fake.fetchImpl })).paymentCheckFailed, false);
    const request = readPaymentToken(pending.paymentToken, config);
    await assert.rejects(syncBookingFromPayment({ request: { ...request, guests: 99 }, status: "paid", paymentId: "pay_fake" }, { client }), rejectCode("payment-mismatch"));
    await syncBookingFromPayment({ request, status: "paid", paymentId: "pay_matching" }, { client });
    assert.equal((await getAdminBooking(booking.id, { client })).status, "test_paid");
  });
});

test("unpaid cancellation releases a date only after provider expiry is verified", async () => {
  await database(async (client) => {
    const { booking } = await create(client);
    const fake = provider();
    await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    fake.failExpire = true;
    await assert.rejects(cancelBooking(booking.id, { reason: "Guest changed plans" }, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("provider-unavailable"));
    assert.deepEqual(await getUnavailableDates({ client, config }), [booking.date]);
    fake.failExpire = false;
    const cancelled = await cancelBooking(booking.id, { reason: "Guest changed plans" }, { client, config, fetchImpl: fake.fetchImpl });
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.paymentStatus, "expired");
    assert.deepEqual(await getUnavailableDates({ client, config }), []);
    const calls = fake.expirations;
    await cancelBooking(booking.id, { reason: "Guest changed plans" }, { client, config, fetchImpl: fake.fetchImpl });
    assert.equal(fake.expirations, calls);
    const requested = await create(client);
    assert.equal((await cancelBooking(requested.booking.id, { reason: "Date declined", decline: true }, { client, config })).status, "declined");
  });
});

test("paid or refunded deposits retain their hold and require an operator refund decision", async () => {
  await database(async (client) => {
    const { booking } = await create(client);
    const fake = provider();
    const pending = await confirmBooking(booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl });
    const sessionId = readPaymentToken(pending.paymentToken, config).sessionId;
    fake.pay(sessionId);
    await assert.rejects(cancelBooking(booking.id, { reason: "Guest changed plans" }, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("refund-required"));
    assert.equal(fake.expirations, 0);
    fake.pay(sessionId, { refunds: [{ attributes: { amount: 100, status: "pending" } }] });
    assert.equal((await refreshBookingPayment(booking.id, { client, config, fetchImpl: fake.fetchImpl })).status, "refunded");
    await assert.rejects(cancelBooking(booking.id, { reason: "Refund reviewed" }, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("refund-required"));
    assert.deepEqual(await getUnavailableDates({ client, config }), [booking.date]);
    await syncBookingFromPayment({ request: readPaymentToken(pending.paymentToken, config), status: "paid", paymentId: "pay_stale" }, { client });
    assert.equal((await getAdminBooking(booking.id, { client })).status, "refunded", "A stale paid result cannot undo a refund flag");
  });
});

test("admin listings paginate and payment-reference lookup exposes no personal data", async () => {
  await database(async (client) => {
    const first = await create(client);
    for (let index = 0; index < 21; index++) await create(client);
    const page = await listAdminBookings({ client, page: 2, status: "requested" });
    assert.equal(page.bookings.length, 2);
    assert.equal(page.pagination.totalItems, 22);
    const minimal = await getBookingByPaymentReference(first.booking.reference, { client });
    assert.equal(minimal.id, first.booking.id);
    assert.equal(minimal.email, undefined);
    assert.equal(await getBookingByPaymentReference("H26-LEGACY-CLI", { client }), null);
    await assert.rejects(listAdminBookings({ client, status: "made-up" }), rejectCode("invalid-request"));
  });
});

test("pricing tiers calculate exact totals and auto-approval holds date for 30 minutes", async () => {
  assert.equal(calculateBookingTotal(1), 500000);
  assert.equal(calculateBookingTotal(4), 500000);
  assert.equal(calculateBookingTotal(5), 600000);
  assert.equal(calculateBookingTotal(6), 600000);
  assert.equal(calculateBookingTotal(7), 800000);
  assert.equal(calculateBookingTotal(10), 800000);
  assert.equal(calculateBookingTotal(11), 850000);
  assert.equal(calculateBookingTotal(12), 900000);
  assert.equal(calculateBookingTotal(15), 1050000);

  await database(async (client) => {
    const fake = provider();
    const result = await createBookingRequest(input({ guests: 6 }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    assert.equal(result.booking.status, "awaiting_payment");
    assert.equal(result.booking.totalAmount, 600000);
    assert.equal(result.booking.depositAmount, 300000);
    assert.ok(result.booking.paymentToken);
    assert.deepEqual(await getUnavailableDates({ client, config, now }), [result.booking.date]);

    // The deadline releases a date only after its provider checkout is expired.
    const future = now + HOLD_DURATION_MS + 60000;
    const providerCalls = fake.calls.length;
    assert.deepEqual(await getUnavailableDates({ client, config, now: future, fetchImpl: fake.fetchImpl }), [result.booking.date]);
    assert.equal(fake.calls.length, providerCalls, "Public availability never invokes provider maintenance");
    assert.deepEqual(await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl }), { checked: 1, released: 1, retained: 0, skipped: 0 });
    assert.deepEqual(await getUnavailableDates({ client, config }), []);
    assert.equal(fake.expirations, 1);
    assert.equal(fake.sessions.values().next().value.attributes.status, "expired");
    const checked = await getAdminBooking(result.booking.id, { client });
    assert.equal(checked.status, "cancelled");
  });
});

test("host can dynamically block and unblock dates with reasons", async () => {
  await database(async (client) => {
    assert.deepEqual(await getBlockedDates({ client }), []);
    await addBlockedDate("2030-05-15", { reason: "Maintenance", client, now });
    const blocked = await getBlockedDates({ client });
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0].date, "2030-05-15");
    assert.equal(blocked[0].reason, "Maintenance");
    assert.deepEqual(await getUnavailableDates({ client, config, now }), ["2030-05-15"]);

    await assert.rejects(
      createBookingRequest(input({ date: "2030-05-15" }), { client, now, config, autoApprove: true }),
      rejectCode("date-unavailable")
    );

    await removeBlockedDate("2030-05-15", { client });
    assert.deepEqual(await getBlockedDates({ client }), []);
    assert.deepEqual(await getUnavailableDates({ client, config, now }), []);
    const requested = await create(client, { date: "2030-05-15", days: 2 });
    await addBlockedDate("2030-05-16", { reason: "Maintenance", client, now });
    const fake = provider();
    await assert.rejects(confirmBooking(requested.booking.id, approved, { client, config, now, fetchImpl: fake.fetchImpl }), rejectCode("date-unavailable"));
    assert.equal(fake.creationCalls, 0);
    assert.equal((await client.execute({ sql: "SELECT COUNT(*) AS count FROM booking_holds WHERE booking_id=?", args: [requested.booking.id] })).rows[0].count, 0, "A blocked later night rolls back every proposed hold");
  });
});

test("host can record balance paid on arrival for confirmed bookings and reset if needed", async () => {
  await database(async (client) => {
    const fake = provider();
    const result = await createBookingRequest(input(), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const bookingId = result.booking.id;

    // Cannot mark balance paid while still awaiting payment
    await assert.rejects(
      markBalancePaid(bookingId, { method: "Cash on arrival", client }),
      rejectCode("invalid-request")
    );

    // Simulate deposit payment confirmed via webhook / sync
    await syncBookingFromPayment({
      request: {
        sessionId: fake.sessions.keys().next().value,
        reference: result.booking.reference,
        date: result.booking.date,
        guests: 4,
        totalAmount: 500000,
        depositAmount: 250000,
        livemode: false,
      },
      status: "paid",
      paymentId: "pay_test_deposit_receipt_123",
    }, { client });

    // Now confirmed/test_paid - mark balance paid
    const updated = await markBalancePaid(bookingId, { method: "GCash on arrival", client });
    assert.equal(updated.balanceMethod, "GCash on arrival");
    assert.ok(updated.balancePaidAt);

    // Host can reset to unpaid if marked by mistake
    const reset = await markBalancePaid(bookingId, { paid: false, client });
    assert.equal(reset.balanceMethod, null);
    assert.equal(reset.balancePaidAt, null);
  });
});

test("multi-day bookings multiply rate by days and hold all consecutive dates", async () => {
  // Rate multipliers
  assert.equal(calculateBookingTotal(4, 1), 500000);
  assert.equal(calculateBookingTotal(4, 2), 1000000);
  assert.equal(calculateBookingTotal(4, 3), 1500000);
  assert.equal(calculateBookingTotal(6, 2), 1200000);
  assert.equal(calculateBookingTotal(10, 3), 2400000);
  assert.equal(calculateBookingTotal(12, 2), 1800000);

  // Helper date generators
  assert.deepEqual(getStayDates("2030-05-10", 1), ["2030-05-10"]);
  assert.deepEqual(getStayDates("2030-05-10", 3), ["2030-05-10", "2030-05-11", "2030-05-12"]);
  assert.equal(getCheckOutDate("2030-05-10", 3), "2030-05-13");

  await database(async (client) => {
    const fake = provider();
    // Book 3 days: 2030-05-10, 2030-05-11, 2030-05-12
    const result = await createBookingRequest(
      input({ date: "2030-05-10", days: 3, guests: 4 }),
      { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl }
    );
    assert.equal(result.booking.days, 3);
    assert.equal(result.booking.endDate, "2030-05-13");
    assert.equal(result.booking.totalAmount, 1500000); // ₱5,000 * 3 = ₱15,000
    assert.equal(result.booking.depositAmount, 750000); // 50% = ₱7,500
    assert.ok(result.booking.terms.includes("3-day private stay"));

    // Verify all 3 dates are held in unavailable dates
    const held = await getUnavailableDates({ client, config, now });
    assert.deepEqual(held, ["2030-05-10", "2030-05-11", "2030-05-12"]);

    // Attempting to book overlapping date in the middle should fail
    await assert.rejects(
      createBookingRequest(
        input({ requestId: randomUUID(), date: "2030-05-11", days: 1, guests: 4 }),
        { client, now, config }
      ),
      rejectCode("date-unavailable")
    );

    // One verified checkout expiration releases every night of the same booking.
    const future = now + HOLD_DURATION_MS + 60000;
    await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl });
    assert.deepEqual(await getUnavailableDates({ client, config }), []);
    assert.equal(fake.expirations, 1);
  });
});

test("timeout keeps dates when checkout creation or provider expiration is unresolved", async () => {
  await database(async (client) => {
    const fake = provider();
    fake.failCreateOnce = true;
    const unknown = await createBookingRequest(input({ date: "2030-05-20" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const pending = await createBookingRequest(input({ date: "2030-05-21" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    fake.failExpire = true;
    const future = now + HOLD_DURATION_MS + 60000;
    await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl });
    await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl });
    assert.deepEqual(await getUnavailableDates({ client, config, now: future, fetchImpl: fake.fetchImpl }), ["2030-05-20", "2030-05-21"]);
    const unknownRow = (await client.execute({ sql: "SELECT status,idempotency_key,session_id,payment_error_code FROM bookings WHERE id=?", args: [unknown.booking.id] })).rows[0];
    assert.equal(unknownRow.status, "awaiting_payment");
    assert.equal(unknownRow.session_id, null);
    assert.ok(unknownRow.idempotency_key);
    assert.equal(unknownRow.payment_error_code, "payment-review-required");
    assert.equal((await getAdminBooking(pending.booking.id, { client })).status, "awaiting_payment");
    await assert.rejects(createBookingRequest(input({ date: "2030-05-21" }), { client, now: future, config, fetchImpl: fake.fetchImpl }), rejectCode("date-unavailable"));
  });
});

test("timeout discovers paid or refunded deposits and never releases their dates", async () => {
  await database(async (client) => {
    const fake = provider();
    const paid = await createBookingRequest(input({ date: "2030-05-25", days: 2 }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const refunded = await createBookingRequest(input({ date: "2030-05-27" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    fake.pay(readPaymentToken(paid.booking.paymentToken, config).sessionId);
    fake.pay(readPaymentToken(refunded.booking.paymentToken, config).sessionId, { refunds: [{ attributes: { amount: 100, status: "pending" } }] });
    const future = now + HOLD_DURATION_MS + 60000;
    await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl });
    await runBookingMaintenance({ client, config, now: future, fetchImpl: fake.fetchImpl });
    assert.deepEqual(await getUnavailableDates({ client, config, now: future, fetchImpl: fake.fetchImpl }), ["2030-05-25", "2030-05-26", "2030-05-27"]);
    assert.equal(fake.expirations, 0);
    assert.equal((await getAdminBooking(paid.booking.id, { client })).status, "test_paid");
    assert.equal((await getAdminBooking(refunded.booking.id, { client })).status, "refunded");
  });
});

test("paid multi-night date collisions record the receipt for review without stealing any date", async () => {
  await database(async (client) => {
    const fake = provider();
    const older = await createBookingRequest(input({ date: "2030-06-01", days: 3 }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const olderPayment = readPaymentToken(older.booking.paymentToken, config);
    // Reproduce a historical unsafe release before applying the fixed reconciliation.
    await client.execute({ sql: "DELETE FROM booking_holds WHERE booking_id=?", args: [older.booking.id] });
    const newer = await createBookingRequest(input({ date: "2030-06-02" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    fake.pay(olderPayment.sessionId);
    await assert.rejects(refreshBookingPayment(older.booking.id, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("date-hold-conflict"));
    const checked = await getAdminBooking(older.booking.id, { client });
    assert.equal(checked.status, "payment_issue");
    assert.equal(checked.paymentStatus, "paid");
    assert.equal(checked.paymentIssue, "date-hold-conflict");
    assert.equal(checked.paymentToken, null);
    const receipt = (await client.execute({ sql: "SELECT payment_id FROM bookings WHERE id=?", args: [older.booking.id] })).rows[0];
    assert.ok(receipt.payment_id.startsWith("pay_"));
    const holds = (await client.execute("SELECT stay_date,booking_id FROM booking_holds ORDER BY stay_date")).rows;
    assert.deepEqual(holds.map((row) => [row.stay_date, row.booking_id]), [
      ["2030-06-01", older.booking.id], ["2030-06-02", newer.booking.id], ["2030-06-03", older.booking.id],
    ]);
    await assert.rejects(refreshBookingPayment(older.booking.id, { client, config, fetchImpl: fake.fetchImpl }), rejectCode("date-hold-conflict"));
    assert.equal((await getAdminBooking(newer.booking.id, { client })).status, "awaiting_payment");
    assert.deepEqual(await getUnavailableDates({ client, config, now, fetchImpl: fake.fetchImpl }), ["2030-06-01", "2030-06-02", "2030-06-03"]);
  });
});

test("admin revenue and collected money exclude all test payments", async () => {
  await database(async (client) => {
    const testProvider = provider();
    const testBooking = await createBookingRequest(input(), { client, now, config, autoApprove: true, fetchImpl: testProvider.fetchImpl });
    testProvider.pay(readPaymentToken(testBooking.booking.paymentToken, config).sessionId);
    await refreshBookingPayment(testBooking.booking.id, { client, config, fetchImpl: testProvider.fetchImpl });
    await markBalancePaid(testBooking.booking.id, { method: "Cash on arrival", client });
    assert.equal((await listAdminBookings({ client })).summary.collectedDeposits, 0);
    const liveProvider = provider(true);
    const liveBooking = await createBookingRequest(input(), { client, now, config: live, autoApprove: true, fetchImpl: liveProvider.fetchImpl });
    liveProvider.pay(readPaymentToken(liveBooking.booking.paymentToken, live).sessionId);
    await refreshBookingPayment(liveBooking.booking.id, { client, config: live, fetchImpl: liveProvider.fetchImpl });
    await markBalancePaid(liveBooking.booking.id, { method: "Cash on arrival", client });
    const { summary } = await listAdminBookings({ client });
    assert.equal(summary.confirmed, 1);
    assert.equal(summary.confirmedRevenue, 500000);
    assert.equal(summary.collectedDeposits, 250000);
    assert.equal(summary.collectedBalances, 250000);
  });
});

test("overlapping maintenance shares a durable lease and outages have a retry backoff", async () => {
  await database(async (client, url) => {
    const fake = provider();
    const booking = await createBookingRequest(input(), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const other = createClient({ url });
    await initializeBookingStore(other);
    let releaseFetch;
    let markStarted;
    const started = new Promise((resolve) => { markStarted = resolve; });
    const gate = new Promise((resolve) => { releaseFetch = resolve; });
    const future = now + HOLD_DURATION_MS + 60000;
    let calls = 0;
    const delayedProvider = async (...args) => { calls++; if (calls === 1) { markStarted(); await gate; } return fake.fetchImpl(...args); };
    const first = runBookingMaintenance({ client, config, now: future, fetchImpl: delayedProvider });
    await started;
    try {
      const competing = await runBookingMaintenance({ client: other, config, now: future, fetchImpl: delayedProvider });
      assert.equal(competing.checked, 0);
      assert.equal(calls, 1, "Only the lease owner contacts PayMongo");
      assert.deepEqual(await getUnavailableDates({ client: other, config }), [booking.booking.date]);
      releaseFetch();
      assert.equal((await first).released, 1);
      const failed = await createBookingRequest(input({ date: "2030-07-01" }), { client, now: future, config, autoApprove: true, fetchImpl: fake.fetchImpl });
      fake.failExpire = true;
      const expired = future + HOLD_DURATION_MS + 60000;
      assert.equal((await runBookingMaintenance({ client, config, now: expired, fetchImpl: fake.fetchImpl })).retained, 1);
      const count = fake.calls.length;
      assert.equal((await runBookingMaintenance({ client: other, config, now: expired + 1000, fetchImpl: fake.fetchImpl })).checked, 0);
      assert.equal(fake.calls.length, count, "An outage cannot trigger immediate repeated provider work");
      assert.deepEqual(await getUnavailableDates({ client, config }), [failed.booking.date]);
    } finally { releaseFetch(); await first; other.close(); }
  });
});

test("guest timeout maintenance touches only its validated private booking", async () => {
  await database(async (client) => {
    const fake = provider();
    const first = await createBookingRequest(input({ date: "2030-08-01" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const second = await createBookingRequest(input({ date: "2030-08-02" }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl });
    const future = now + HOLD_DURATION_MS + 60000;
    const calls = fake.calls.length;
    await assert.rejects(getGuestBooking("invalid", { client, refreshPayment: true, config, now: future, fetchImpl: fake.fetchImpl }), rejectCode("not-found"));
    assert.equal(fake.calls.length, calls);
    const checked = await getGuestBooking(second.token, { client, refreshPayment: true, config, now: future, fetchImpl: fake.fetchImpl });
    assert.equal(checked.status, "cancelled");
    assert.equal(fake.expirations, 1);
    assert.equal((await getAdminBooking(first.booking.id, { client })).status, "awaiting_payment");
    assert.deepEqual(await getUnavailableDates({ client, config }), [first.booking.date]);
  });
});

test("unpayable instant totals fail before persistence or provider work", async () => {
  await database(async (client) => {
    const fake = provider();
    await assert.rejects(createBookingRequest(input({ guests: 999, days: 30 }), { client, now, config, autoApprove: true, fetchImpl: fake.fetchImpl }), rejectCode("invalid-request"));
    assert.equal(fake.calls.length, 0);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM bookings")).rows[0].count, 0);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_holds")).rows[0].count, 0);
  });
});

test("audit log records lifecycle events and retrieves chronological history", async () => {
  await database(async (client) => {
    const fake = provider();
    const result = await createBookingRequest(input(), { client, now, config });
    const eventsAfterCreate = await getBookingEvents(result.booking.id, { client });
    assert.equal(eventsAfterCreate.length, 1);
    assert.equal(eventsAfterCreate[0].eventType, "requested");
    assert.equal(eventsAfterCreate[0].actor, "guest");

    await confirmBooking(result.booking.id, { totalAmount: 500000, terms: "Standard stay terms" }, { client, config, fetchImpl: fake.fetchImpl, now });
    const eventsAfterConfirm = await getBookingEvents(result.booking.id, { client });
    assert.equal(eventsAfterConfirm.length, 2);
    assert.equal(eventsAfterConfirm[1].eventType, "quote_approved");
    assert.equal(eventsAfterConfirm[1].actor, "host");

    const admin = await getAdminBooking(result.booking.id, { client });
    assert.ok(Array.isArray(admin.events));
    assert.equal(admin.events.length, 2);
  });
});





