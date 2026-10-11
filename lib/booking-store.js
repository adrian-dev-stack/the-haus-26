import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";

export class BookingError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "BookingError";
    this.code = code;
    this.status = status;
  }
}

const initialized = new WeakMap();
const storeKey = Symbol.for("haus26.booking-store");

export async function initializeBookingStore(client) {
  if (!initialized.has(client)) {
    const pending = (async () => {
      await client.batch([
        `CREATE TABLE IF NOT EXISTS bookings (
          id TEXT PRIMARY KEY,
          reference TEXT NOT NULL UNIQUE,
          request_id TEXT NOT NULL UNIQUE,
          request_hash TEXT NOT NULL,
          guest_token_hash TEXT NOT NULL UNIQUE,
          livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
          status TEXT NOT NULL CHECK(status IN ('requested','awaiting_payment','confirmed','test_paid','cancelled','declined','payment_issue','refunded')),
          name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
          stay_date TEXT NOT NULL, guests INTEGER NOT NULL CHECK(guests BETWEEN 1 AND 999),
          occasion TEXT NOT NULL, notes TEXT NOT NULL,
          consent_at INTEGER NOT NULL,
          total_amount INTEGER, deposit_amount INTEGER, terms TEXT,
          session_id TEXT, payment_id TEXT, payment_status TEXT,
          idempotency_key TEXT, checkout_started_at INTEGER,
          payment_error_code TEXT, cancellation_reason TEXT,
          balance_paid_at INTEGER, balance_method TEXT,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS booking_holds (
          stay_date TEXT NOT NULL, livemode INTEGER NOT NULL CHECK(livemode IN (0,1)),
          booking_id TEXT NOT NULL UNIQUE REFERENCES bookings(id),
          PRIMARY KEY(stay_date, livemode)
        )`,
        "CREATE TABLE IF NOT EXISTS blocked_dates (stay_date TEXT PRIMARY KEY, reason TEXT, created_at INTEGER NOT NULL)",
        "CREATE INDEX IF NOT EXISTS bookings_status_created ON bookings(status, created_at DESC)",
        "CREATE INDEX IF NOT EXISTS bookings_mode_date ON bookings(livemode, stay_date)",
      ], "write");
      await client.execute("ALTER TABLE bookings ADD COLUMN balance_paid_at INTEGER").catch(() => {});
      await client.execute("ALTER TABLE bookings ADD COLUMN balance_method TEXT").catch(() => {});
    })().catch(() => {
      initialized.delete(client);
      throw new BookingError("store-unavailable", "The booking service is unavailable. Please contact the host.", 503);
    });
    initialized.set(client, pending);
  }
  await initialized.get(client);
  return client;
}

export async function getBookingStore({ env = process.env } = {}) {
  const url = env.BOOKING_DATABASE_URL || "file:.booking-data/bookings.db";
  const local = url.startsWith("file:");
  if (local) {
    if (env.VERCEL || (env.NODE_ENV === "production" && env.BOOKING_ALLOW_LOCAL_DATABASE !== "true")) {
      throw new BookingError("store-not-configured", "Configure a persistent booking database before accepting bookings.", 503);
    }
    const filename = url.startsWith("file://") ? fileURLToPath(url) : path.resolve(url.slice(5));
    if (!filename || filename.includes(":memory:")) {
      throw new BookingError("store-not-configured", "Use a persistent booking database file.", 503);
    }
    await mkdir(path.dirname(filename), { recursive: true });
  } else {
    let parsed;
    try { parsed = new URL(url); } catch {}
    if (!parsed || !["libsql:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || !env.BOOKING_DATABASE_AUTH_TOKEN) {
      throw new BookingError("store-not-configured", "Configure the booking database URL and private authentication token.", 503);
    }
  }
  const fingerprint = createHash("sha256").update(`${url}\0${env.BOOKING_DATABASE_AUTH_TOKEN || ""}`).digest("hex");
  let current = globalThis[storeKey];
  if (!current || current.fingerprint !== fingerprint) {
    current = { fingerprint, client: createClient({ url, ...(local ? {} : { authToken: env.BOOKING_DATABASE_AUTH_TOKEN }) }) };
    globalThis[storeKey] = current;
  }
  return initializeBookingStore(current.client);
}
