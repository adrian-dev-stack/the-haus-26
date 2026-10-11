import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyPaymongoWebhook(rawBody, signature, secret, livemode, now = Date.now()) {
  if (!Buffer.isBuffer(rawBody) || typeof secret !== "string" || secret.length < 16 || typeof signature !== "string" || signature.length > 1024) return false;
  const values = new Map();
  for (const field of signature.split(",")) {
    const parts = field.trim().split("=");
    if (parts.length !== 2 || values.has(parts[0])) return false;
    values.set(parts[0], parts[1]);
  }
  const timestamp = values.get("t");
  const received = values.get(livemode ? "li" : "te");
  if (!/^\d{10}$/.test(timestamp || "") || !/^[a-f0-9]{64}$/i.test(received || "") || Math.abs(now - Number(timestamp) * 1000) > 300000) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(received, "hex"));
}
