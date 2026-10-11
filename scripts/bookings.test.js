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
    for (const overrides of [{ date: "2030-01-01" }, { date: "2030-02-30" }, { guests: 1000 }, { guests: "4" }, { email: "invalid" }, { consent: false }, { notes: "x".repeat(1001) }]) {
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

    // Fast-forward 31 minutes: unpaid hold expires and date opens back up
    const future = now + HOLD_DURATION_MS + 60000;
    assert.deepEqual(await getUnavailableDates({ client, config, now: future }), []);
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



