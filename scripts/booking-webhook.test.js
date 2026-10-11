import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyPaymongoWebhook } from "../lib/booking-webhook.js";

test("webhook verification binds exact raw bytes, timestamp, signing secret and payment mode", () => {
  const now = 1791750000000;
  const timestamp = String(Math.floor(now / 1000));
  const secret = "test-webhook-endpoint-secret-0123456789";
  const raw = Buffer.from('{"data":{"type":"event"}}');
  const signature = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest("hex");
  const header = `t=${timestamp},te=${signature},li=`;
  assert.equal(verifyPaymongoWebhook(raw, header, secret, false, now), true);
  assert.equal(verifyPaymongoWebhook(raw, header, secret, true, now), false);
  assert.equal(verifyPaymongoWebhook(Buffer.from('{ "data":{"type":"event"}}'), header, secret, false, now), false);
  assert.equal(verifyPaymongoWebhook(raw, header, "wrong-secret-0123456789", false, now), false);
  assert.equal(verifyPaymongoWebhook(raw, header, secret, false, now + 300001), false);
  assert.equal(verifyPaymongoWebhook(raw, `${header},t=${timestamp}`, secret, false, now), false);
  assert.equal(verifyPaymongoWebhook(raw, `t=${timestamp},te=aa`, secret, false, now), false);
  assert.equal(verifyPaymongoWebhook(raw, undefined, secret, false, now), false);
  const rawOnly = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(verifyPaymongoWebhook(raw, `t=${timestamp},te=${rawOnly}`, secret, false, now), false);
});
