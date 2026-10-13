import { createHash, createHmac, randomUUID } from "node:crypto";
import { getBookingStore } from "./booking-store.js";
import { property } from "./property.js";
import { getNotificationConfig, NotificationError, normalizePhilippinePhone, sendEmail, sendSms } from "./notification-providers.js";

const KINDS = ["guest_email", "guest_sms", "host_email"];
const LEASE_MS = 90000;
const RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function notificationSettings() {
  try { return getNotificationConfig(); }
  catch { return { enabled: false, configurationError: true }; }
}

function eligible(booking, config) {
  return config.enabled && booking.payment_status === "paid" && !booking.cancellation_reason &&
    (Number(booking.livemode) === 1 ? booking.status === "confirmed" : config.testEnabled && booking.status === "test_paid");
}

export async function enqueueBookingConfirmation(tx, booking, { config, now = Date.now() }) {
  if (!eligible(booking, config)) return;
  for (const kind of KINDS) {
    await tx.execute({ sql: "INSERT OR IGNORE INTO booking_notifications (id,booking_id,kind,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?)",
      args: [randomUUID(), booking.id, kind, now, now, now] });
  }
}

function configured(kind, booking, config) {
  const test = Number(booking.livemode) === 0;
  if (kind === "guest_sms") return Boolean(config.unismsApiKey && config.smsSenderId && (!test || config.testPhone));
  return Boolean(config.resendApiKey && config.emailFrom && (!test || config.testEmail) &&
    (kind !== "host_email" || test || config.hostEmail) && (test || !/@resend\.dev(?:>|$)/i.test(config.emailFrom)));
}

function origin(siteUrl) {
  try {
    const url = new URL(siteUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local))) return "";
    return url.origin;
  } catch { return ""; }
}

export function renderBookingNotification(booking, kind, { config, siteUrl = process.env.SITE_URL, tokenSecret = process.env.BOOKING_TOKEN_SECRET } = {}) {
  if (!KINDS.includes(kind)) throw new NotificationError("invalid-message", "Notification type is invalid.");
  const test = Number(booking.livemode) === 0;
  if (test && !config.testEnabled) throw new NotificationError("notifications-disabled", "Test notifications are disabled.");
  const reference = booking.reference;
  const days = Number(booking.days) || 1;
  const money = (amount) => `PHP ${(Number(amount) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const deposit = money(booking.deposit_amount);
  const balance = money(Number(booking.total_amount) - Number(booking.deposit_amount));
  const host = kind === "host_email";
  const details = [`Reference: ${reference}`, `Stay starts: ${booking.stay_date}`, `Duration: ${days} day(s)`, `Guests: ${booking.guests}`,
    `Total: ${money(booking.total_amount)}`, `Verified deposit: ${deposit}`, `Remaining balance: ${balance}`];
  if (kind === "guest_sms") {
    const to = normalizePhilippinePhone(test ? config.testPhone : booking.phone);
    return { to, text: `${property.name}: ${test ? "TEST deposit verified; no real reservation" : "Booking confirmed"}. ${reference}, ${booking.stay_date}, ${days} day(s). Deposit ${deposit}. Balance ${balance}. See email for details.` };
  }
  const to = test ? config.testEmail : host ? config.hostEmail : booking.email;
  const site = origin(siteUrl);
  let link = "";
  if (site && host) link = `Review in the private host dashboard: ${site}/admin`;
  else if (site && typeof tokenSecret === "string" && tokenSecret.length >= 32 && booking.request_id && booking.guest_token_hash) {
    const token = createHmac("sha256", tokenSecret).update(`haus26-booking:v1:${booking.request_id}`).digest("base64url");
    if (hash(token) === booking.guest_token_hash) link = `Your private booking details: ${site}/book/${token}\nKeep this link private.`;
  }
  const introduction = test ? "TEST ONLY. A test deposit was verified. No real reservation was made and no real money was collected." :
    host ? "A guest reservation is confirmed after a verified deposit." : "Your reservation is confirmed. Your 50% deposit has been verified.";
  return { to, subject: `${test ? "[TEST] " : ""}${property.name}: ${host ? "new paid booking" : test ? "test deposit verified" : "booking confirmed"} ${reference}`,
    text: [introduction, details.join("\n"), host ? "Sign in to review the guest's details and arrange arrival." : booking.terms || "",
      link, !host && config.emailReplyTo ? `Contact the host: ${config.emailReplyTo}` : ""].filter(Boolean).join("\n\n") };
}

export async function runBookingNotifications({ client, config = notificationSettings(), fetchImpl = fetch, now, limit = 3, bookingId, siteUrl, tokenSecret } = {}) {
  const counts = { checked: 0, accepted: 0, deferred: 0, failed: 0, review: 0, skipped: 0 };
  if (!config.enabled) return { ...counts, ...(config.configurationError ? { configurationError: true } : {}) };
  const database = client || await getBookingStore();
  const current = Number(now ?? Date.now());
  if (!Number.isSafeInteger(current) || current < 0) throw new Error("Use a valid notification maintenance timestamp.");
  const batchSize = Math.min(3, Math.max(1, Number(limit) || 1));
  const jobs = (await database.execute({
    sql: `SELECT * FROM booking_notifications WHERE status IN ('pending','sending') AND next_attempt_at<=? AND lease_until<=?
      ${bookingId ? "AND booking_id=?" : ""} ORDER BY next_attempt_at,created_at,kind,id LIMIT ?`,
    args: [current, current, ...(bookingId ? [bookingId] : []), batchSize],
  })).rows;
  for (const selected of jobs) {
    const claimTime = now === undefined ? Date.now() : current;
    const nonce = randomUUID();
    const claim = await database.execute({ sql: "UPDATE booking_notifications SET status='sending',lease_nonce=?,lease_until=?,updated_at=? WHERE id=? AND status=? AND attempts=? AND lease_nonce IS ? AND lease_until<=? AND next_attempt_at<=? RETURNING *",
      args: [nonce, claimTime + LEASE_MS, claimTime, selected.id, selected.status, selected.attempts, selected.lease_nonce, claimTime, claimTime] });
    if (!claim.rows.length) continue;
    const job = claim.rows[0];
    const staleSms = job.kind === "guest_sms" && selected.status === "sending";
    counts.checked++;
    const finish = async (status, code = null, providerId = null, next = claimTime) => {
      await database.execute({ sql: "UPDATE booking_notifications SET status=?,error_code=?,provider_id=COALESCE(?,provider_id),next_attempt_at=?,lease_until=0,lease_nonce=NULL,updated_at=? WHERE id=? AND lease_nonce=?",
        args: [status, code, providerId, next, claimTime, job.id, nonce] });
      const counter = status === "pending" ? "deferred" : status;
      if (Object.hasOwn(counts, counter)) counts[counter]++;
    };
    try {
      if (staleSms) { await finish("review", "sms-outcome-unknown"); continue; }
      const latest = (await database.execute({ sql: "SELECT * FROM bookings WHERE id=?", args: [job.booking_id] })).rows[0];
      if (!latest || !eligible(latest, config) || !latest.email || !latest.phone) { await finish("skipped", "booking-ineligible"); continue; }
      if (claimTime - Number(job.first_attempt_at ?? job.created_at) >= RETRY_WINDOW_MS) {
        await finish(job.first_attempt_at ? "review" : "skipped", "notification-window-expired"); continue;
      }
      if (latest.payment_error_code) { await finish("pending", "payment-recheck-required", null, claimTime + 60000); continue; }
      if (!configured(job.kind, latest, config)) { await finish("pending", "channel-not-configured", null, claimTime + 60000); continue; }
      const payload = renderBookingNotification(latest, job.kind, { config, siteUrl, tokenSecret });
      const fingerprint = hash(JSON.stringify({ ...payload, sender: job.kind === "guest_sms" ? config.smsSenderId : config.emailFrom,
        replyTo: job.kind === "guest_sms" ? "" : config.emailReplyTo }));
      if (job.payload_hash && job.payload_hash !== fingerprint) { await finish("review", "notification-payload-changed"); continue; }
      const persisted = await database.execute({ sql: "UPDATE booking_notifications SET payload_hash=?,first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1 WHERE id=? AND lease_nonce=?",
        args: [fingerprint, claimTime, job.id, nonce] });
      if (!persisted.rowsAffected) continue;
      const sent = job.kind === "guest_sms" ? await sendSms(payload, { config, fetchImpl }) :
        await sendEmail(payload, { config, fetchImpl, idempotencyKey: `haus26-confirmation/${job.id}` });
      await finish("accepted", null, sent.id);
    } catch (error) {
      const known = error instanceof NotificationError;
      const ambiguous = !known || error.ambiguous;
      const code = known ? error.code : "notification-outcome-unknown";
      if (ambiguous && job.kind === "guest_sms") await finish("review", code);
      else if ((!known || error.retryable) && Number(job.attempts) + 1 < MAX_ATTEMPTS) {
        await finish("pending", code, null, claimTime + Math.min(600000, 60000 * 2 ** Number(job.attempts)));
      } else await finish(ambiguous ? "review" : "failed", code);
    }
  }
  return counts;
}
