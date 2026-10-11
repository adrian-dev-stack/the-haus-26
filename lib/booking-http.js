import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { getPaymentConfig } from "./payments.js";
import { getBookingStore } from "./booking-store.js";
import { getAdminSession } from "./booking-auth.js";

export class BookingHttpError extends Error {
  constructor(code, message, status) { super(message); this.code = code; this.status = status; }
}

export function bookingResponse(data, status = 200) {
  return NextResponse.json({ data }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export function bookingFailure(error) {
  const expected = Number.isInteger(error.status) && error.status >= 400 && error.status < 500;
  const status = expected ? error.status : 503;
  return NextResponse.json({ error: { code: expected ? error.code : "unavailable",
    message: expected ? error.message : "Bookings are unavailable right now. Please contact the host or try again shortly." } },
    { status, headers: { "Cache-Control": "private, no-store, max-age=0", ...(status === 429 ? { "Retry-After": "900" } : {}) } });
}

export function requireBookingOrigin(request) {
  const origin = request.headers.get("origin");
  const siteUrl = getPaymentConfig().siteUrl;
  if (!origin) throw new BookingHttpError("origin", "Please use the booking form on this website.", 403);
  if (origin === siteUrl) return;
  try {
    const originUrl = new URL(origin);
    const configuredUrl = new URL(siteUrl);
    if (
      originUrl.protocol === configuredUrl.protocol &&
      originUrl.hostname.replace(/^www\./, "") === configuredUrl.hostname.replace(/^www\./, "") &&
      originUrl.port === configuredUrl.port
    ) {
      return;
    }
  } catch {}
  throw new BookingHttpError("origin", "Please use the booking form on this website.", 403);
}

export async function requireBookingAdmin() {
  if (!await getAdminSession()) throw new BookingHttpError("unauthorized", "Sign in to manage bookings.", 401);
}

export async function readBookingBody(request, maxBytes = 16384, raw = false) {
  if (!raw && !request.headers.get("content-type")?.split(";")[0].trim().match(/^application\/json$/i)) {
    throw new BookingHttpError("content-type", "Submit the booking form in the supported format.", 415);
  }
  if (Number(request.headers.get("content-length")) > maxBytes) throw new BookingHttpError("too-large", "This request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new BookingHttpError("invalid-body", "Please complete the booking form.", 400);
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) { await reader.cancel(); throw new BookingHttpError("too-large", "This request is too large.", 413); }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks);
  if (raw) return body;
  try {
    const value = JSON.parse(body.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new BookingHttpError("invalid-body", "Please complete the booking form.", 400); }
}

export async function limitBookingRequest(request, scope, maximum = 30, windowMs = 15 * 60 * 1000) {
  const secret = process.env.BOOKING_SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("Booking security is not configured.");
  const candidate = process.env.VERCEL ? (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim() : "";
  const identity = isIP(candidate) ? candidate : "shared";
  const digest = createHmac("sha256", secret).update(identity).digest("hex");
  const now = Date.now();
  const window = Math.floor(now / windowMs);
  const client = await getBookingStore();
  await client.execute("CREATE TABLE IF NOT EXISTS booking_rate_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, expires_at INTEGER NOT NULL)");
  const result = await client.execute({ sql: "INSERT INTO booking_rate_limits (bucket, attempts, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET attempts = attempts + 1 RETURNING attempts",
    args: [`${scope}:${digest}:${window}`, (window + 1) * windowMs] });
  await client.execute({ sql: "DELETE FROM booking_rate_limits WHERE expires_at < ?", args: [now] });
  if (Number(result.rows[0].attempts) > maximum) throw new BookingHttpError("rate-limited", "Too many attempts. Please try again in a few minutes.", 429);
}

export async function limitPaymentRead() {
  const { headers } = await import("next/headers");
  await limitBookingRequest(new Request(getPaymentConfig().siteUrl, { headers: await headers() }), "payment-read", 60, 5 * 60 * 1000);
}
