import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationConfig, normalizePhilippinePhone, NotificationError, sendEmail, sendSms } from "../lib/notification-providers.js";

const env = {
  BOOKING_NOTIFICATIONS_ENABLED: "true",
  RESEND_API_KEY: "re_unit_test_fake_key",
  BOOKING_EMAIL_FROM: "HauS 26 <bookings@example.test>",
  BOOKING_EMAIL_REPLY_TO: "host@example.test",
  BOOKING_HOST_EMAIL: "host@example.test",
  UNISMS_API_KEY: "unit_test_fake_sms_key",
  UNISMS_SENDER_ID: "TestSender",
};
const config = getNotificationConfig(env);
const email = { to: "guest@example.test", subject: "Booking confirmed", text: "Your booking is confirmed." };
const sms = { to: "09123456789", text: "Your booking is confirmed." };
const emailOptions = { config, idempotencyKey: "deposit-paid/booking-unit-test/guest" };
const response = (status, body) => ({ status, json: async () => body });
const emailSuccess = () => response(200, { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
const smsSuccess = (status = "pending") => response(201, { message: { status, reference_id: "msg_unit_test_001" } });

function outcome(code, retryable = false, ambiguous = false) {
  return (error) => {
    assert.ok(error instanceof NotificationError);
    assert.equal(error.code, code);
    assert.equal(error.retryable, retryable);
    assert.equal(error.ambiguous, ambiguous);
    for (const privateValue of [env.RESEND_API_KEY, env.UNISMS_API_KEY, email.to, sms.to, "secret-provider-response"]) {
      assert.ok(!error.message.includes(privateValue));
    }
    return true;
  };
}

test("configuration is disabled by default and permits individually unconfigured channels", () => {
  const empty = getNotificationConfig({});
  assert.equal(empty.enabled, false);
  assert.equal(empty.testEnabled, false);
  assert.equal(empty.resendApiKey, "");
  assert.equal(empty.unismsApiKey, "");
  assert.equal(empty.smsSenderId, "");
  assert.equal(getNotificationConfig({ BOOKING_NOTIFICATIONS_ENABLED: "TRUE" }).enabled, false);
  assert.equal(getNotificationConfig({ RESEND_API_KEY: env.RESEND_API_KEY }).emailFrom, "");
});

test("test configuration normalizes the chosen recipient and never invents a sender", () => {
  const testConfig = getNotificationConfig({
    BOOKING_NOTIFICATIONS_TEST_ENABLED: "true",
    BOOKING_NOTIFICATION_TEST_EMAIL: "tester@example.test",
    BOOKING_NOTIFICATION_TEST_PHONE: "0912 345 6789",
  });
  assert.equal(testConfig.testEnabled, true);
  assert.equal(testConfig.testEmail, "tester@example.test");
  assert.equal(testConfig.testPhone, "+639123456789");
  assert.equal(testConfig.emailFrom, "");
  assert.equal(testConfig.smsSenderId, "");
});

test("invalid private settings fail without including their values", () => {
  for (const change of [
    { RESEND_API_KEY: "key\nInjected: value" },
    { UNISMS_API_KEY: "username:password" },
    { BOOKING_EMAIL_FROM: "HauS 26 <guest@example.test>\nBcc: leak@example.test" },
    { BOOKING_EMAIL_REPLY_TO: "invalid" },
    { BOOKING_HOST_EMAIL: "invalid" },
    { UNISMS_SENDER_ID: "Test\nSender" },
    { BOOKING_NOTIFICATION_TEST_EMAIL: "invalid" },
    { BOOKING_NOTIFICATION_TEST_PHONE: "+14155550123" },
  ]) assert.throws(() => getNotificationConfig({ ...env, ...change }), outcome("not-configured"));
});

test("Philippine mobile normalization accepts local and international formatting and rejects foreign numbers", () => {
  for (const value of ["09123456789", "9123456789", "639123456789", "+639123456789", "(0912) 345-6789"]) {
    assert.equal(normalizePhilippinePhone(value), "+639123456789");
  }
  for (const value of [undefined, 9123456789, "", "+14155550123", "02 8123 4567", "009123456789", "091234567891", "09abc3456789", "09123456789\n", "++639123456789"]) {
    assert.throws(() => normalizePhilippinePhone(value), outcome("invalid-recipient"));
  }
});

test("email sends only to the fixed API with stable idempotency, private auth and a bounded request", async () => {
  const result = await sendEmail(email, { ...emailOptions, fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
    assert.equal(options.headers["Idempotency-Key"], emailOptions.idempotencyKey);
    assert.deepEqual(JSON.parse(options.body), { from: env.BOOKING_EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text, reply_to: env.BOOKING_EMAIL_REPLY_TO });
    return emailSuccess();
  } });
  assert.deepEqual(result, { id: "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794" });
});

test("SMS follows documented Basic auth, E.164 recipient and registered sender; accepted is not delivered", async () => {
  for (const status of ["pending", "retrying", "sent"]) {
    assert.deepEqual(await sendSms(sms, { config, fetchImpl: async (url, options) => {
      assert.equal(url, "https://unismsapi.com/api/sms");
      assert.equal(options.redirect, "error");
      assert.equal(options.method, "POST");
      assert.ok(options.signal instanceof AbortSignal);
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from(`${env.UNISMS_API_KEY}:`).toString("base64")}`);
      assert.equal(options.headers["Idempotency-Key"], undefined);
      assert.deepEqual(JSON.parse(options.body), { recipient: "+639123456789", content: sms.text, sender_id: env.UNISMS_SENDER_ID });
      return smsSuccess(status);
    } }), { id: "msg_unit_test_001" });
  }
});

test("disabled or unconfigured channels never send", async () => {
  const forbiddenFetch = async () => assert.fail("Unexpected network request");
  await assert.rejects(sendEmail(email, { ...emailOptions, config: { ...config, enabled: false }, fetchImpl: forbiddenFetch }), outcome("notifications-disabled"));
  await assert.rejects(sendSms(sms, { config: { ...config, enabled: false }, fetchImpl: forbiddenFetch }), outcome("notifications-disabled"));
  await assert.rejects(sendEmail(email, { ...emailOptions, config: { ...config, emailFrom: "" }, fetchImpl: forbiddenFetch }), outcome("not-configured"));
  await assert.rejects(sendSms(sms, { config: { ...config, smsSenderId: "" }, fetchImpl: forbiddenFetch }), outcome("not-configured"));
});

test("recipient, content and idempotency validation occurs before sending", async () => {
  const forbiddenFetch = async () => assert.fail("Unexpected network request");
  const options = { ...emailOptions, fetchImpl: forbiddenFetch };
  await assert.rejects(sendEmail({ ...email, to: "Name <guest@example.test>" }, options), outcome("invalid-recipient"));
  await assert.rejects(sendEmail({ ...email, subject: "Subject\nInjected" }, options), outcome("invalid-message"));
  await assert.rejects(sendEmail({ ...email, text: "" }, options), outcome("invalid-message"));
  await assert.rejects(sendEmail(email, { ...options, idempotencyKey: undefined }), outcome("invalid-idempotency-key"));
  await assert.rejects(sendEmail(email, { ...options, idempotencyKey: "key\nInjected" }), outcome("invalid-idempotency-key"));
  await assert.rejects(sendSms({ ...sms, to: "+14155550123" }, { config, fetchImpl: forbiddenFetch }), outcome("invalid-recipient"));
  await assert.rejects(sendSms({ ...sms, text: "a".repeat(671) }, { config, fetchImpl: forbiddenFetch }), outcome("invalid-message"));
});

test("explicit rate limiting permits a retry; other rejected HTTP requests are permanent", async () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    const fetchImpl = async () => response(status, { message: "secret-provider-response" });
    const code = status === 429 ? "provider-rate-limited" : "provider-rejected";
    await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl }), outcome(code, status === 429));
    await assert.rejects(sendSms(sms, { config, fetchImpl }), outcome(code, status === 429));
  }
});

test("Resend idempotency concurrency retries the same intent and a changed payload requires review", async () => {
  const cases = [
    { name: "concurrent_idempotent_requests", code: "provider-idempotency-pending", retryable: true, ambiguous: true },
    { name: "invalid_idempotent_request", code: "provider-idempotency-conflict", retryable: false, ambiguous: true },
    { name: "unknown", code: "provider-rejected", retryable: false, ambiguous: false },
  ];
  for (const { name, code, retryable, ambiguous } of cases) {
    const fetchImpl = async (_url, options) => {
      assert.equal(options.headers["Idempotency-Key"], emailOptions.idempotencyKey);
      return response(409, { name, message: "secret-provider-response" });
    };
    await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl }), outcome(code, retryable, ambiguous));
    await assert.rejects(sendSms(sms, { config, fetchImpl: async () => response(409, { name, message: "secret-provider-response" }) }), outcome("provider-rejected"));
  }
  await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl: async () => ({
    status: 409, json: async () => { throw new Error("secret-provider-response"); },
  }) }), outcome("provider-rejected"));
});

test("network, timeout and server failures have ambiguous outcomes; SMS cannot automatically retry", async () => {
  const failures = [
    async () => { throw new Error(`secret-provider-response ${env.RESEND_API_KEY}`); },
    async () => { throw new DOMException("secret-provider-response", "TimeoutError"); },
    async () => response(500, { message: "secret-provider-response" }),
    async () => response(503, { message: "secret-provider-response" }),
  ];
  for (const fetchImpl of failures) {
    await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl }), outcome("provider-unknown", true, true));
    await assert.rejects(sendSms(sms, { config, fetchImpl }), outcome("provider-unknown", false, true));
  }
});

test("malformed accepted responses are ambiguous and cannot trigger an SMS resend", async () => {
  for (const body of [{}, { id: "https://malicious.test" }, { id: 123 }, { id: "" }]) {
    await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl: async () => response(200, body) }), outcome("invalid-provider-response", true, true));
  }
  for (const body of [{}, { message: { status: "unknown", reference_id: "msg_unit_test_001" } }, { message: { status: "pending", reference_id: "https://malicious.test" } }]) {
    await assert.rejects(sendSms(sms, { config, fetchImpl: async () => response(201, body) }), outcome("invalid-provider-response", false, true));
  }
  const invalidJson = async () => ({ status: 201, json: async () => { throw new Error("secret-provider-response"); } });
  await assert.rejects(sendEmail(email, { ...emailOptions, fetchImpl: invalidJson }), outcome("invalid-provider-response", true, true));
  await assert.rejects(sendSms(sms, { config, fetchImpl: invalidJson }), outcome("invalid-provider-response", false, true));
});

test("documented failed SMS status is permanent and hides the provider's failure reason", async () => {
  await assert.rejects(sendSms(sms, { config, fetchImpl: async () => response(201, { message: {
    status: "failed", reference_id: "msg_unit_test_001", fail_reason: "secret-provider-response",
  } }) }), outcome("sms-failed"));
});
