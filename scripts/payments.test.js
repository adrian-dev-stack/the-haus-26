import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createPaymentToken,
  getPaymentConfig,
  readPaymentToken,
  retrievePaymentRequest,
  validateQuote,
} from "../lib/payments.js";
import { createHostPaymentRequest, expireHostPaymentRequest, parsePesoAmount } from "./payment-request.js";

const env = {
  PAYMONGO_SECRET_KEY: "sk_test_fake_for_unit_tests",
  PAYMENT_LINK_SECRET: "unit-test-only-random-looking-link-secret-12345",
  SITE_URL: "http://localhost:3000",
};
const config = getPaymentConfig(env);
const quote = validateQuote({ reference: "H26-TEST-001", date: "2026-12-20", guests: 4, totalAmount: 500000 });
const request = { sessionId: "cs_unit_test_001", ...quote, livemode: false };
const token = createPaymentToken(request, config);

function session(overrides = {}) {
  return {
    id: request.sessionId,
    type: "checkout_session",
    attributes: {
      reference_number: quote.reference,
      livemode: false,
      status: "active",
      checkout_url: "https://checkout.paymongo.com/unit-test-checkout#provider-key",
      line_items: [{ name: "Deposit", amount: quote.depositAmount, currency: "PHP", quantity: 1 }],
      payments: [],
      ...overrides,
    },
  };
}

function payment(overrides = {}) {
  return { id: "pay_unit_test", attributes: {
    amount: quote.depositAmount, currency: "PHP", livemode: false, status: "paid", refunds: [],
    billing: { email: "private@example.test" }, source: { last4: "4242" }, ...overrides,
  } };
}

function fakeFetch(resource) {
  return async () => ({ ok: true, json: async () => ({ data: resource }) });
}

const rejectsCode = (code) => (error) => error?.code === code;

async function removeTestLedger(directory) {
  const resolved = path.resolve(directory);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith("haus26-payments-"));
  await rm(resolved, { recursive: true, force: true });
}

test("config separates live mode, accepts test localhost, and rejects unsafe origins", () => {
  assert.equal(config.livemode, false);
  assert.throws(() => getPaymentConfig({}), rejectsCode("not-configured"));
  assert.throws(() => getPaymentConfig({ ...env, PAYMONGO_SECRET_KEY: "sk_live_fake_for_unit_tests" }), rejectsCode("not-configured"));
  assert.throws(() => getPaymentConfig({ ...env, SITE_URL: "https://haus.test/pay?token=secret" }), rejectsCode("not-configured"));
  assert.throws(() => getPaymentConfig({ ...env, SITE_URL: "http://haus.test" }), rejectsCode("not-configured"));
  assert.throws(() => getPaymentConfig({ ...env, PAYMONGO_PAYMENT_METHODS: "card,unknown" }), rejectsCode("not-configured"));
  const live = getPaymentConfig({ ...env, SITE_URL: "https://haus.test", PAYMONGO_SECRET_KEY: "sk_live_fake_for_unit_tests", PAYMENTS_LIVE_ENABLED: "true" });
  assert.equal(live.livemode, true);
});

test("quote validates real dates and exact 50% centavo split; decimal parsing avoids floats", () => {
  assert.equal(quote.depositAmount, 250000);
  assert.equal(parsePesoAmount("5000.50"), 500050);
  assert.throws(() => parsePesoAmount("1e4"), rejectsCode("invalid-request"));
  assert.throws(() => validateQuote({ ...quote, date: "2026-02-30" }), rejectsCode("invalid-request"));
  assert.throws(() => validateQuote({ ...quote, totalAmount: 500001 }), rejectsCode("invalid-request"));
  assert.throws(() => validateQuote({ ...quote, reference: "../bad" }), rejectsCode("invalid-request"));
});

test("encrypted links authenticate all quote fields and reject forgery, rotation, or another mode", () => {
  assert.deepEqual(readPaymentToken(token, config), request);
  assert.ok(!token.includes(quote.reference));
  const parts = token.split(".");
  const encrypted = Buffer.from(parts[2], "base64url");
  encrypted[0] ^= 1;
  parts[2] = encrypted.toString("base64url");
  assert.throws(() => readPaymentToken(parts.join("."), config), rejectsCode("invalid-link"));
  assert.throws(() => readPaymentToken(token, { ...config, linkSecret: `${config.linkSecret}-rotated` }), rejectsCode("invalid-link"));
  assert.throws(() => readPaymentToken(token, { ...config, livemode: true }), rejectsCode("invalid-link"));
});

test("only matching provider payment proves receipt; raw private fields stay server-side", async () => {
  assert.equal((await retrievePaymentRequest(token, config, fakeFetch(session()))).status, "pending");
  const paid = await retrievePaymentRequest(token, config, fakeFetch(session({ payments: [payment()] })));
  assert.equal(paid.status, "paid");
  assert.equal(paid.paymentId, "pay_unit_test");
  assert.ok(!JSON.stringify(paid).includes("private@example.test"));
  assert.ok(!JSON.stringify(paid).includes("4242"));
  assert.equal((await retrievePaymentRequest(token, config, fakeFetch(session({ status: "expired" })))).status, "expired");
});

test("provider mode, reference, line-item and received-amount mismatches fail closed", async () => {
  for (const change of [
    { livemode: true }, { reference_number: "H26-OTHER" }, { status: "unknown" },
    { line_items: [{ amount: 100, currency: "PHP", quantity: 1 }] },
    { line_items: [{ amount: quote.depositAmount, currency: "USD", quantity: 1 }] },
    { payments: [payment({ amount: quote.depositAmount - 1 })] },
    { payments: [payment({ livemode: true })] },
    { payments: [payment({ status: "unknown" })] },
  ]) {
    await assert.rejects(retrievePaymentRequest(token, config, fakeFetch(session(change))), rejectsCode("request-mismatch"));
  }
});

test("refunds including partial or pending refunds suppress the paid state", async () => {
  for (const change of [
    { status: "refunded" },
    { refunds: [{ attributes: { amount: 100, status: "succeeded" } }] },
    { refunds: [{ amount: 100, status: "pending" }] },
  ]) {
    assert.equal((await retrievePaymentRequest(token, config, fakeFetch(session({ payments: [payment(change)] })))).status, "refunded");
  }
});

test("redirects reject lookalike hosts, userinfo, HTTP, and custom ports", async () => {
  for (const checkout_url of [
    "https://checkout.paymongo.com.evil.test/pay", "https://user@checkout.paymongo.com/pay",
    "http://checkout.paymongo.com/pay", "https://checkout.paymongo.com:444/pay", "javascript:alert(1)",
  ]) {
    await assert.rejects(retrievePaymentRequest(token, config, fakeFetch(session({ checkout_url }))), rejectsCode("request-mismatch"));
  }
});

test("provider failures expose no provider internals and never invent a paid state", async () => {
  const failing = async () => ({ ok: false, json: async () => ({ errors: [{ detail: "private internal error" }] }) });
  await assert.rejects(retrievePaymentRequest(token, config, failing), (error) => error.code === "provider-unavailable" && !error.message.includes("private"));
});

test("host creates once, stores marker before network, reuses original session and rejects changed quote", async () => {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "haus26-payments-"));
  let creates = 0;
  const fetchImpl = async (url, options) => {
    if (options.method === "POST") {
      creates++;
      const saved = JSON.parse(await readFile(path.join(ledgerDir, `test-${quote.reference}.json`), "utf8"));
      assert.equal(saved.state, "creating");
      assert.equal(saved.idempotencyKey, options.headers["Idempotency-Key"]);
      const attributes = JSON.parse(options.body).data.attributes;
      assert.equal(attributes.line_items[0].amount, 250000);
      assert.equal(attributes.success_url, `${config.siteUrl}/payment/return?reference=${quote.reference}`);
      assert.equal(attributes.cancel_url, attributes.success_url);
      assert.equal(attributes.send_email_receipt, true);
      assert.equal(url, "https://api.paymongo.com/v2/checkout_sessions");
    }
    return fakeFetch(session())();
  };
  try {
    await assert.rejects(createHostPaymentRequest(quote, config, { ledgerDir, fetchImpl }), rejectsCode("confirmation-required"));
    assert.equal(creates, 0);
    const options = { ledgerDir, fetchImpl, confirmed: true };
    const first = await createHostPaymentRequest(quote, config, options);
    const second = await createHostPaymentRequest(quote, config, options);
    assert.equal(creates, 1);
    assert.equal(readPaymentToken(second.guestUrl.split("/pay/")[1], config).sessionId, first.request.sessionId);
    await assert.rejects(createHostPaymentRequest({ ...quote, totalAmount: 600000 }, config, options), rejectsCode("quote-changed"));
    assert.equal(creates, 1);
  } finally {
    await removeTestLedger(ledgerDir);
  }
});

test("ambiguous creation retries with the persisted key and stops before provider key expiry", async () => {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "haus26-payments-"));
  const attempts = [];
  let fail = true;
  const start = Date.now();
  const fetchImpl = async (_url, options) => {
    if (options.method === "POST") {
      attempts.push(options.headers["Idempotency-Key"]);
      if (fail) throw new Error("simulated network loss after provider may have created session");
    }
    return fakeFetch(session())();
  };
  try {
    const options = { ledgerDir, fetchImpl, confirmed: true, now: start };
    await assert.rejects(createHostPaymentRequest(quote, config, options), rejectsCode("provider-unavailable"));
    await assert.rejects(createHostPaymentRequest(quote, config, { ...options, now: start + 23 * 3600000 }), rejectsCode("creation-unresolved"));
    assert.equal(attempts.length, 1);
    fail = false;
    await createHostPaymentRequest(quote, config, { ...options, now: start + 3600000 });
    assert.equal(attempts[0], attempts[1]);
    assert.ok(!(await readdir(ledgerDir)).some((name) => name.endsWith(".lock")));
  } finally {
    await removeTestLedger(ledgerDir);
  }
});

test("concurrent host commands cannot create two sessions for one reference", async () => {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "haus26-payments-"));
  let networkStarted;
  let releaseNetwork;
  const started = new Promise((resolve) => { networkStarted = resolve; });
  const gate = new Promise((resolve) => { releaseNetwork = resolve; });
  let creates = 0;
  const fetchImpl = async (_url, options) => {
    if (options.method === "POST") {
      creates++;
      networkStarted();
      await gate;
    }
    return fakeFetch(session())();
  };
  let first;
  try {
    const options = { ledgerDir, fetchImpl, confirmed: true };
    first = createHostPaymentRequest(quote, config, options);
    await started;
    await assert.rejects(createHostPaymentRequest(quote, config, options), rejectsCode("ledger-locked"));
    releaseNetwork();
    await first;
    assert.equal(creates, 1);
  } finally {
    releaseNetwork();
    await first?.catch(() => {});
    await removeTestLedger(ledgerDir);
  }
});

test("expiration calls the provider and refuses to treat paid checkout as refundable", async () => {
  const ledgerDir = await mkdtemp(path.join(os.tmpdir(), "haus26-payments-"));
  let paid = false;
  let expires = 0;
  const fetchImpl = async (url, options) => {
    if (url.endsWith("/expire")) {
      expires++;
      assert.equal(options.method, "POST");
      return fakeFetch(session({ status: "expired" }))();
    }
    return fakeFetch(session({ payments: paid ? [payment()] : [] }))();
  };
  try {
    await createHostPaymentRequest(quote, config, { ledgerDir, fetchImpl, confirmed: true });
    paid = true;
    await assert.rejects(expireHostPaymentRequest(quote.reference, config, { ledgerDir, fetchImpl }), rejectsCode("already-paid"));
    assert.equal(expires, 0);
    paid = false;
    assert.equal((await expireHostPaymentRequest(quote.reference, config, { ledgerDir, fetchImpl })).status, "expired");
    assert.equal(expires, 1);
  } finally {
    await removeTestLedger(ledgerDir);
  }
});
