import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createClient } from "@libsql/client";
import { createBookingRequest, initializeBookingStore, syncBookingFromPayment } from "../lib/bookings.js";
import { renderBookingNotification, runBookingNotifications } from "../lib/booking-notifications.js";

const paymentConfig = { secretKey: "sk_live_notification_fixture", linkSecret: "notification-payment-test-secret-0123456789", siteUrl: "https://haus.example", livemode: true, paymentMethods: ["card"] };
const notificationConfig = { enabled: true, testEnabled: false, resendApiKey: "re_fixture", emailFrom: "The HauS 26 <bookings@haus.example>", emailReplyTo: "host@haus.example", hostEmail: "host@haus.example", unismsApiKey: "sms_fixture", smsSenderId: "TEST", testEmail: "tester@haus.example", testPhone: "+639123456789" };
const now = new Date("2030-01-01T16:10:00Z").getTime();

async function fixture(operation, { livemode = true } = {}) {
  const client = createClient({ url: ":memory:" });
  await initializeBookingStore(client);
  try {
    const config = { ...paymentConfig, livemode };
    const result = await createBookingRequest({ requestId: randomUUID(), name: "Fixture Guest", email: "guest@example.test", phone: "09123456789", date: "2030-02-01", days: 2, guests: 4, consent: true }, { client, config, now, tokenSecret: "notification-guest-test-secret-0123456789" });
    await client.execute({ sql: "UPDATE bookings SET status='awaiting_payment',session_id='cs_notify_fixture',total_amount=1000000,deposit_amount=500000,payment_status='pending',checkout_started_at=? WHERE id=?", args: [now, result.booking.id] });
    for (const date of ["2030-02-01", "2030-02-02"]) await client.execute({ sql: "INSERT INTO booking_holds VALUES (?,?,?)", args: [date, Number(livemode), result.booking.id] });
    const payment = { request: { reference: result.booking.reference, sessionId: "cs_notify_fixture", date: "2030-02-01", guests: 4, totalAmount: 1000000, depositAmount: 500000, livemode }, status: "paid", paymentId: "pay_notify_fixture" };
    await operation({ client, payment, id: result.booking.id, config });
  } finally { client.close(); }
}

test("a verified deposit durably queues each confirmation channel once", async () => {
  await fixture(async ({ client, payment }) => {
    await syncBookingFromPayment(payment, { client, notificationConfig, now });
    const jobs = (await client.execute("SELECT kind,status FROM booking_notifications ORDER BY kind")).rows;
    assert.deepEqual(jobs.map((job) => [job.kind, job.status]), [["guest_email", "pending"], ["guest_sms", "pending"], ["host_email", "pending"]]);
    await syncBookingFromPayment(payment, { client, notificationConfig, now });
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_notifications")).rows[0].count, 3);
  });
});

const worker = (client, overrides = {}) => ({ client, config: notificationConfig, now: now + 1000, siteUrl: paymentConfig.siteUrl, tokenSecret: "notification-guest-test-secret-0123456789", ...overrides });
const success = async (url) => ({ status: url.includes("unismsapi") ? 201 : 200, json: async () => url.includes("unismsapi") ? { message: { reference_id: "msg_notification_fixture", status: "pending" } } : { id: "email_notification_fixture" } });
async function queue(client, payment, config = notificationConfig) { await syncBookingFromPayment(payment, { client, notificationConfig: config, now }); }
async function only(client, kind) { await client.execute({ sql: "DELETE FROM booking_notifications WHERE kind!=?", args: [kind] }); }
async function job(client) { return (await client.execute("SELECT * FROM booking_notifications")).rows[0]; }

test("activation does not backfill earlier confirmed deposits", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment, { ...notificationConfig, enabled: false });
    await queue(client, payment);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_notifications")).rows[0].count, 0);
  });
});

test("test deposits require explicit test mode and redirect all recipients", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_notifications")).rows[0].count, 0);
  }, { livemode: false });
  await fixture(async ({ client, payment, id }) => {
    const config = { ...notificationConfig, testEnabled: true, emailFrom: "onboarding@resend.dev" };
    await queue(client, payment, config);
    const requests = [];
    await runBookingNotifications(worker(client, { config, fetchImpl: async (url, options) => { requests.push([url, JSON.parse(options.body)]); return success(url); } }));
    assert.equal(requests.length, 3);
    for (const [url, payload] of requests) {
      if (url.includes("unismsapi")) { assert.equal(payload.recipient, config.testPhone); assert.match(payload.content, /TEST.*no real reservation/); }
      else { assert.deepEqual(payload.to, [config.testEmail]); assert.match(payload.subject, /^\[TEST\]/); assert.match(payload.text, /No real reservation/); }
      assert.ok(!JSON.stringify(payload).includes("guest@example.test"));
    }
    const row = (await client.execute({ sql: "SELECT * FROM bookings WHERE id=?", args: [id] })).rows[0];
    assert.equal(row.status, "test_paid");
  }, { livemode: false });
});

test("pending, refunded, mismatched and cancelled payments do not queue confirmations", async () => {
  for (const mode of ["pending", "refunded", "mismatch", "cancelled", "dateConflict"]) {
    await fixture(async ({ client, payment, id }) => {
      if (mode === "cancelled") await client.execute({ sql: "UPDATE bookings SET status='cancelled',cancellation_reason='Fixture cancellation' WHERE id=?", args: [id] });
      if (mode === "dateConflict") {
        const second = await createBookingRequest({ requestId: randomUUID(), name: "Other Guest", email: "other@example.test", phone: "09123456789", date: "2030-03-01", guests: 4, consent: true }, { client, config: paymentConfig, now, tokenSecret: "notification-guest-test-secret-0123456789" });
        await client.execute({ sql: "UPDATE booking_holds SET booking_id=? WHERE stay_date='2030-02-01'", args: [second.booking.id] });
      }
      const changed = mode === "mismatch" ? { ...payment, request: { ...payment.request, depositAmount: 1 } } :
        ["pending", "refunded"].includes(mode) ? { ...payment, status: mode } : payment;
      if (["mismatch", "dateConflict"].includes(mode)) await assert.rejects(queue(client, changed));
      else await queue(client, changed);
      assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_notifications")).rows[0].count, 0, mode);
    });
  }
});

test("outbox writes roll back together with the payment transition", async () => {
  await fixture(async ({ client, payment, id }) => {
    await client.execute("CREATE TRIGGER fixture_notification_failure BEFORE INSERT ON booking_notifications BEGIN SELECT RAISE(ABORT,'fixture queue failure'); END");
    await assert.rejects(queue(client, payment));
    assert.equal((await client.execute({ sql: "SELECT status FROM bookings WHERE id=?", args: [id] })).rows[0].status, "awaiting_payment");
    assert.equal((await client.execute("SELECT COUNT(*) AS count FROM booking_notifications")).rows[0].count, 0);
  });
});

test("delivery records acceptance once without storing message bodies or contacts", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    const requests = [];
    const fetchImpl = async (url, options) => { requests.push([url, JSON.parse(options.body)]); return success(url); };
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl }))).accepted, 3);
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl }))).checked, 0);
    assert.equal(requests.length, 3);
    const email = requests.find(([url, body]) => url.includes("resend") && body.to[0] === "guest@example.test")[1];
    assert.match(email.text, /https:\/\/haus\.example\/book\/[A-Za-z0-9_-]{43}/);
    const rows = (await client.execute("SELECT * FROM booking_notifications")).rows;
    assert.ok(rows.every((row) => row.status === "accepted" && row.payload_hash.length === 64));
    assert.ok(!JSON.stringify(rows).includes("guest@example.test"));
    assert.ok(!JSON.stringify(rows).includes("private booking details"));
  });
});

test("competing workers cannot send the same SMS", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_sms");
    let resolveStart;
    let release;
    const started = new Promise((resolve) => { resolveStart = resolve; });
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    const first = runBookingNotifications(worker(client, { fetchImpl: async (url) => { calls++; resolveStart(); await gate; return success(url); } }));
    await started;
    try { assert.equal((await runBookingNotifications(worker(client, { fetchImpl: success }))).checked, 0); }
    finally { release(); }
    assert.equal((await first).accepted, 1);
    assert.equal(calls, 1);
  });
});

test("an ambiguous SMS send goes to review and is never retried automatically", async () => {
  await fixture(async ({ client, payment, id }) => {
    await queue(client, payment);
    await only(client, "guest_sms");
    let calls = 0;
    const fetchImpl = async () => { calls++; throw new Error("Fixture response lost after sending"); };
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl }))).review, 1);
    await runBookingNotifications(worker(client, { fetchImpl, now: now + 200000 }));
    assert.equal(calls, 1);
    assert.equal((await job(client)).status, "review");
    assert.equal((await client.execute({ sql: "SELECT status FROM bookings WHERE id=?", args: [id] })).rows[0].status, "confirmed");
  });
});

test("a crashed SMS attempt requires review after its lease expires", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_sms");
    await client.execute({ sql: "UPDATE booking_notifications SET status='sending',attempts=1,first_attempt_at=?,lease_until=?", args: [now, now + 90000] });
    const result = await runBookingNotifications(worker(client, { now: now + 90001, fetchImpl: async () => { assert.fail("An uncertain SMS must not be sent again"); } }));
    assert.equal(result.review, 1);
    assert.equal((await job(client)).error_code, "sms-outcome-unknown");
  });
});

test("email retries use exactly the same request and idempotency key within the window", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_email");
    const requests = [];
    const fetchImpl = async (url, options) => { requests.push([options.body, options.headers["Idempotency-Key"]]); if (requests.length === 1) throw new Error("Fixture timeout"); return success(url); };
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl }))).deferred, 1);
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl, now: now + 61001 }))).accepted, 1);
    assert.deepEqual(requests[0], requests[1]);
  });
});

test("changed retry payloads and exhausted idempotency windows require review", async () => {
  for (const expired of [false, true]) await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_email");
    await runBookingNotifications(worker(client, { fetchImpl: async () => { throw new Error("Fixture unknown outcome"); } }));
    const options = expired ? { now: now + 23 * 3600000 + 2000 } : { now: now + 61001, config: { ...notificationConfig, emailFrom: "new@haus.example" } };
    const result = await runBookingNotifications(worker(client, { ...options, fetchImpl: async () => { assert.fail("Do not resend beyond a safe unchanged payload/window"); } }));
    assert.equal(result.review, 1);
  });
});

test("refunds and contact erasure suppress unsent confirmations", async () => {
  for (const erased of [false, true]) await fixture(async ({ client, payment, id }) => {
    await queue(client, payment);
    await client.execute({ sql: erased ? "UPDATE bookings SET email='',phone='' WHERE id=?" : "UPDATE bookings SET status='refunded',payment_status='refunded' WHERE id=?", args: [id] });
    const result = await runBookingNotifications(worker(client, { fetchImpl: async () => { assert.fail("No notification after refund or erasure"); } }));
    assert.equal(result.skipped, 3);
  });
});

test("missing channel settings defer jobs without blocking configured SMS", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    const config = { ...notificationConfig, resendApiKey: "" };
    assert.equal((await runBookingNotifications(worker(client, { config, limit: 1, fetchImpl: success }))).deferred, 1);
    assert.equal((await runBookingNotifications(worker(client, { config, limit: 1, fetchImpl: success }))).accepted, 1);
    const disabled = await runBookingNotifications(worker(client, { config: { ...config, enabled: false }, fetchImpl: async () => { assert.fail("Disabled means no sends"); } }));
    assert.equal(disabled.checked, 0);
  });
});

test("Resend's testing sender cannot email real guests on live bookings", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_email");
    const result = await runBookingNotifications(worker(client, { config: { ...notificationConfig, emailFrom: "onboarding@resend.dev" }, fetchImpl: async () => { assert.fail("Test sender must not send live confirmations"); } }));
    assert.equal(result.deferred, 1);
    assert.equal((await job(client)).attempts, 0);
  });
});

test("a cleared or replaced lease prevents a stale worker from initiating a send", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_sms");
    const execute = client.execute.bind(client);
    client.execute = async (statement) => {
      if (statement.sql?.startsWith("UPDATE booking_notifications SET payload_hash=")) {
        await execute("UPDATE booking_notifications SET lease_nonce='other-worker'");
      }
      return execute(statement);
    };
    const result = await runBookingNotifications(worker(client, { fetchImpl: async () => { assert.fail("Lease ownership was lost before sending"); } }));
    assert.equal(result.accepted, 0);
  });
});

test("an expired unconfigured email lease does not starve a configured SMS", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await client.execute("DELETE FROM booking_notifications WHERE kind='host_email'");
    await client.execute({ sql: "UPDATE booking_notifications SET status='sending',attempts=1,first_attempt_at=?,lease_until=? WHERE kind='guest_email'", args: [now - 100000, now - 1] });
    const options = worker(client, { config: { ...notificationConfig, resendApiKey: "" }, limit: 1, fetchImpl: success });
    assert.equal((await runBookingNotifications(options)).deferred, 1);
    assert.equal((await runBookingNotifications(options)).accepted, 1);
  });
});

test("a transient payment recheck outage defers confirmations until verification recovers", async () => {
  await fixture(async ({ client, payment, id }) => {
    await queue(client, payment);
    await client.execute({ sql: "UPDATE bookings SET payment_error_code='provider-unavailable' WHERE id=?", args: [id] });
    assert.equal((await runBookingNotifications(worker(client, { fetchImpl: async () => { assert.fail("Pause during a verification outage"); } }))).deferred, 3);
    await client.execute({ sql: "UPDATE bookings SET payment_error_code=NULL WHERE id=?", args: [id] });
    assert.equal((await runBookingNotifications(worker(client, { now: now + 61001, fetchImpl: success }))).accepted, 3);
  });
});

test("a stale pending snapshot cannot reclaim an attempted SMS as a fresh send", async () => {
  await fixture(async ({ client, payment }) => {
    await queue(client, payment);
    await only(client, "guest_sms");
    let snapshotReady;
    let allowClaim;
    let firstStarted;
    let finishFirst;
    const snapshot = new Promise((resolve) => { snapshotReady = resolve; });
    const claimGate = new Promise((resolve) => { allowClaim = resolve; });
    const sent = new Promise((resolve) => { firstStarted = resolve; });
    const responseGate = new Promise((resolve) => { finishFirst = resolve; });
    const secondClient = { execute: async (statement) => {
      const result = await client.execute(statement);
      if (statement.sql?.startsWith("SELECT * FROM booking_notifications WHERE")) { snapshotReady(); await claimGate; }
      return result;
    } };
    let calls = 0;
    const second = runBookingNotifications(worker(secondClient, { now: now + 200000, fetchImpl: async (url) => { calls++; return success(url); } }));
    await snapshot;
    const first = runBookingNotifications(worker(client, { fetchImpl: async (url) => { calls++; firstStarted(); await responseGate; return success(url); } }));
    await sent;
    allowClaim();
    try { assert.equal((await second).checked, 0); }
    finally { finishFirst(); await first; }
    assert.equal(calls, 1);
  });
});
