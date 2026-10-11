import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { BookingError, getBookingStore, initializeBookingStore } from "./booking-store.js";
import { createCheckoutSession, createPaymentToken, expireCheckoutSession, getPaymentConfig, retrievePaymentRequest, validateQuote } from "./payments.js";

export { BookingError, getBookingStore, initializeBookingStore };

export const HOLD_DURATION_MS = 30 * 60 * 1000;
export const DEFAULT_BOOKING_TERMS = "22-hour private stay (Check-in 11:00 AM to 1:00 PM, Check-out next day). 50% deposit paid via PayMongo; remaining balance payable upon arrival. Quiet hours after 10:00 PM. No smoking indoors. Pets allowed.";

export function calculateBookingTotal(guests) {
  const count = Number(guests);
  if (!Number.isSafeInteger(count) || count < 1 || count > 999) {
    throw new BookingError("invalid-request", "Enter the number of guests.", 422);
  }
  let pesos;
  if (count <= 4) pesos = 5000;
  else if (count <= 6) pesos = 6000;
  else if (count <= 10) pesos = 8000;
  else pesos = 8000 + (count - 10) * 500;
  return pesos * 100;
}

export async function cleanupExpiredHolds(database, now) {
  const current = timestamp(now);
  const cutoff = current - HOLD_DURATION_MS;
  await database.execute({
    sql: `DELETE FROM booking_holds WHERE booking_id IN (
      SELECT id FROM bookings
      WHERE status = 'awaiting_payment'
        AND (payment_status IS NULL OR payment_status NOT IN ('paid', 'refunded'))
        AND checkout_started_at IS NOT NULL
        AND checkout_started_at < ?
    )`,
    args: [cutoff],
  });
  await database.execute({
    sql: `UPDATE bookings
      SET status = 'cancelled', cancellation_reason = 'Payment hold expired after 30 minutes', updated_at = ?
      WHERE status = 'awaiting_payment'
        AND (payment_status IS NULL OR payment_status NOT IN ('paid', 'refunded'))
        AND checkout_started_at IS NOT NULL
        AND checkout_started_at < ?`,
    args: [current, cutoff],
  });
}

const STATUSES = new Set(["requested", "awaiting_payment", "confirmed", "test_paid", "cancelled", "declined", "payment_issue", "refunded"]);
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const timestamp = (now) => {
  const value = now === undefined ? Date.now() : new Date(now).getTime();
  if (!Number.isFinite(value)) throw new BookingError("invalid-request", "Use a valid date.", 422);
  return value;
};

function todayInManila(now) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));
}

function validateStayDate(date, now) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date ||
    date < todayInManila(now)) {
    throw new BookingError("invalid-request", "Choose today or a future stay date in the Philippines.", 422);
  }
  return date;
}

function text(value, field, max, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return "";
  if (typeof value !== "string") throw new BookingError("invalid-request", `Enter a valid ${field}.`, 422);
  const normalized = value.trim();
  if ((!optional && !normalized) || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw new BookingError("invalid-request", `Enter a valid ${field} (${max} characters maximum).`, 422);
  }
  return normalized;
}

function normalizeInput(input, now) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
    typeof input.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestId)) {
    throw new BookingError("invalid-request", "Please refresh the booking form and try again.", 422);
  }
  const name = text(input.name, "name", 100);
  const email = text(input.email, "email address", 254).toLowerCase();
  const phone = text(input.phone, "phone number", 30);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[0-9 ()-]{7,30}$/.test(phone) || phone.replace(/\D/g, "").length < 7) {
    throw new BookingError("invalid-request", "Enter a valid email address and phone number.", 422);
  }
  if (!Number.isSafeInteger(input.guests) || input.guests < 1 || input.guests > 999) {
    throw new BookingError("invalid-request", "Enter the number of guests. The host will confirm capacity.", 422);
  }
  if (input.consent !== true) throw new BookingError("invalid-request", "Agree to contact details being used for this booking request.", 422);
  return { requestId: input.requestId.toLowerCase(), name, email, phone, date: validateStayDate(input.date, now), guests: input.guests,
    occasion: text(input.occasion, "occasion", 120, { optional: true }), notes: text(input.notes, "notes", 1000, { optional: true }), consent: true };
}

function guestToken(requestId, secret = process.env.BOOKING_TOKEN_SECRET) {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new BookingError("store-not-configured", "Booking links are not configured. Please contact the host.", 503);
  }
  return createHmac("sha256", secret).update(`haus26-booking:v1:${requestId}`).digest("base64url");
}

async function store(client) { return client ? initializeBookingStore(client) : getBookingStore(); }

async function rowById(client, id) {
  if (typeof id !== "string" || id.length > 64) throw new BookingError("not-found", "Booking not found.", 404);
  const row = (await client.execute({ sql: "SELECT * FROM bookings WHERE id = ?", args: [id] })).rows[0];
  if (!row) throw new BookingError("not-found", "Booking not found.", 404);
  return row;
}

function requestFor(row) {
  return { sessionId: row.session_id, reference: row.reference, date: row.stay_date, guests: Number(row.guests),
    totalAmount: Number(row.total_amount), depositAmount: Number(row.deposit_amount), livemode: Boolean(row.livemode) };
}

function checkedConfig(row, config = getPaymentConfig()) {
  if (Boolean(row.livemode) !== config.livemode) {
    throw new BookingError("payment-mode-mismatch", "This booking belongs to a different payment environment. Switch back before managing it.", 409);
  }
  return config;
}

function guestDto(row, config) {
  let paymentToken = null;
  if (row.session_id && row.status === "awaiting_payment" && row.payment_status !== "expired" && !row.payment_error_code) {
    try { paymentToken = createPaymentToken(requestFor(row), checkedConfig(row, config)); } catch {}
  }
  return { id: row.id, reference: row.reference, status: row.status, livemode: Boolean(row.livemode), date: row.stay_date,
    guests: Number(row.guests), occasion: row.occasion, totalAmount: row.total_amount === null ? null : Number(row.total_amount),
    depositAmount: row.deposit_amount === null ? null : Number(row.deposit_amount), terms: row.terms,
    balancePaidAt: row.balance_paid_at ? new Date(Number(row.balance_paid_at)).toISOString() : null,
    balanceMethod: row.balance_method || null,
    paymentStatus: row.payment_status, paymentToken, paymentCheckFailed: Boolean(row.payment_error_code),
    createdAt: new Date(Number(row.created_at)).toISOString(), updatedAt: new Date(Number(row.updated_at)).toISOString() };
}

function adminDto(row, config) {
  let guestUrl = null;
  try {
    const token = guestToken(row.request_id);
    if (digest(token) === row.guest_token_hash) guestUrl = `${(config || getPaymentConfig()).siteUrl}/book/${token}`;
  } catch {}
  return { ...guestDto(row, config), name: row.name, email: row.email, phone: row.phone, notes: row.notes,
    cancellationReason: row.cancellation_reason, paymentIssue: row.payment_error_code, guestUrl };
}

async function transaction(client, operation) {
  const tx = await client.transaction("write");
  try { const result = await operation(tx); await tx.commit(); return result; }
  catch (error) { if (!tx.closed) await tx.rollback(); throw error; }
  finally { tx.close(); }
}

function translateStoreError(error) {
  if (error instanceof BookingError) return error;
  if (error?.code === "SQLITE_BUSY" || error?.code === "SQLITE_BUSY_SNAPSHOT") {
    return new BookingError("booking-busy", "Another booking is being updated. Please try again.", 409);
  }
  return new BookingError("store-unavailable", "The booking service is unavailable. Please contact the host.", 503);
}

export async function createBookingRequest(input, { client, now, blockedDates = [], config = getPaymentConfig(), tokenSecret, autoApprove = false, fetchImpl = fetch } = {}) {
  const current = timestamp(now);
  const normalized = normalizeInput(input, current);
  if (blockedDates.includes(normalized.date)) throw new BookingError("date-unavailable", "That date is unavailable. Please choose another date.", 409);
  const database = await store(client);
  await cleanupExpiredHolds(database, current);
  const isBlocked = (await database.execute({ sql: "SELECT stay_date FROM blocked_dates WHERE stay_date = ?", args: [normalized.date] })).rows.length > 0;
  if (isBlocked) throw new BookingError("date-unavailable", "That date is unavailable. Please choose another date.", 409);
  const token = guestToken(normalized.requestId, tokenSecret);
  const inputHash = digest(JSON.stringify(normalized));
  try {
    const result = await transaction(database, async (tx) => {
      const existing = (await tx.execute({ sql: "SELECT * FROM bookings WHERE request_id = ?", args: [normalized.requestId] })).rows[0];
      if (existing) {
        if (existing.request_hash !== inputHash || existing.guest_token_hash !== digest(token) || Boolean(existing.livemode) !== config.livemode) {
          throw new BookingError("request-conflict", "This form was already submitted with different details. Start a new request.", 409);
        }
        return { row: existing, replayed: true, autoApproved: false };
      }
      if ((await tx.execute({ sql: "SELECT booking_id FROM booking_holds WHERE stay_date = ? AND livemode = ?", args: [normalized.date, Number(config.livemode)] })).rows.length) {
        throw new BookingError("date-unavailable", "That date is unavailable. Please choose another date.", 409);
      }
      const id = randomUUID();
      const reference = `H26-${normalized.date.replaceAll("-", "")}-${randomBytes(5).toString("hex").toUpperCase()}`;
      if (autoApprove) {
        const totalAmount = calculateBookingTotal(normalized.guests);
        const depositAmount = totalAmount / 2;
        const idempotencyKey = randomUUID();
        await tx.execute({
          sql: `INSERT INTO bookings (id,reference,request_id,request_hash,guest_token_hash,livemode,status,name,email,phone,stay_date,guests,occasion,notes,consent_at,total_amount,deposit_amount,terms,idempotency_key,checkout_started_at,payment_status,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [id, reference, normalized.requestId, inputHash, digest(token), Number(config.livemode), "awaiting_payment",
            normalized.name, normalized.email, normalized.phone, normalized.date, normalized.guests, normalized.occasion, normalized.notes, current,
            totalAmount, depositAmount, DEFAULT_BOOKING_TERMS, idempotencyKey, current, "creating", current, current],
        });
        await tx.execute({
          sql: "INSERT INTO booking_holds (stay_date,livemode,booking_id) VALUES (?,?,?)",
          args: [normalized.date, Number(config.livemode), id],
        });
        return { row: await rowById(tx, id), replayed: false, autoApproved: true };
      }
      await tx.execute({ sql: `INSERT INTO bookings (id,reference,request_id,request_hash,guest_token_hash,livemode,status,name,email,phone,stay_date,guests,occasion,notes,consent_at,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'requested',?,?,?,?,?,?,?,?,?,?)`, args: [id, reference, normalized.requestId, inputHash, digest(token), Number(config.livemode),
        normalized.name, normalized.email, normalized.phone, normalized.date, normalized.guests, normalized.occasion, normalized.notes, current, current, current] });
      return { row: await rowById(tx, id), replayed: false, autoApproved: false };
    });

    let row = result.row;
    if (result.autoApproved && !result.replayed && !row.session_id) {
      try {
        const session = await createCheckoutSession(requestFor(row), config, row.idempotency_key, fetchImpl);
        if (/^cs_[A-Za-z0-9_-]{4,128}$/.test(session.id || "")) {
          await database.execute({
            sql: "UPDATE bookings SET session_id = ?, payment_status = 'pending', payment_error_code = NULL, updated_at = ? WHERE id = ?",
            args: [session.id, current, row.id],
          });
          row = await rowById(database, row.id);
        }
      } catch (err) {
        const code = err?.code === "request-mismatch" ? "request-mismatch" : "provider-unavailable";
        await database.execute({
          sql: "UPDATE bookings SET payment_error_code = ?, updated_at = ? WHERE id = ?",
          args: [code, current, row.id],
        });
        row = await rowById(database, row.id);
      }
    }

    return { booking: guestDto(row, config), token, replayed: result.replayed };
  } catch (error) { throw translateStoreError(error); }
}

export async function getGuestBooking(token, { client, refreshPayment = false, config, fetchImpl } = {}) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, "base64url").toString("base64url") !== token) {
    throw new BookingError("not-found", "Booking link not found. Ask the host for your link.", 404);
  }
  const database = await store(client);
  let row = (await database.execute({ sql: "SELECT * FROM bookings WHERE guest_token_hash = ?", args: [digest(token)] })).rows[0];
  if (!row) throw new BookingError("not-found", "Booking link not found. Ask the host for your link.", 404);
  if (refreshPayment && row.session_id && !["cancelled", "declined"].includes(row.status)) {
    try { await refreshBookingPayment(row.id, { client: database, config, fetchImpl }); } catch (error) {
      if (error instanceof BookingError && error.code === "payment-mode-mismatch") throw error;
    }
    row = await rowById(database, row.id);
  }
  return guestDto(row, config);
}

export async function listAdminBookings({ client, status, page = 1 } = {}) {
  if (status && !STATUSES.has(status)) throw new BookingError("invalid-request", "Choose a valid booking status.", 422);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new BookingError("invalid-request", "Choose a valid page.", 422);
  const database = await store(client);
  const where = status ? "WHERE status = ?" : "";
  const args = status ? [status] : [];
  const totalItems = Number((await database.execute({ sql: `SELECT COUNT(*) AS count FROM bookings ${where}`, args })).rows[0].count);
  const pageSize = 20;
  const rows = (await database.execute({ sql: `SELECT * FROM bookings ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`, args: [...args, pageSize, (page - 1) * pageSize] })).rows;
  const summaryResult = (await database.execute({
    sql: `SELECT 
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'requested' THEN 1 ELSE 0 END) AS requested_count,
      SUM(CASE WHEN status = 'awaiting_payment' THEN 1 ELSE 0 END) AS awaiting_count,
      SUM(CASE WHEN status IN ('confirmed', 'test_paid') THEN 1 ELSE 0 END) AS confirmed_count,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_count,
      SUM(CASE WHEN status IN ('confirmed', 'test_paid') THEN COALESCE(total_amount, 0) ELSE 0 END) AS confirmed_revenue,
      SUM(CASE WHEN status IN ('confirmed', 'test_paid') THEN COALESCE(deposit_amount, 0) ELSE 0 END) AS collected_deposits,
      SUM(CASE WHEN status IN ('confirmed', 'test_paid') AND balance_paid_at IS NOT NULL THEN COALESCE(total_amount - deposit_amount, 0) ELSE 0 END) AS collected_balances
    FROM bookings`
  })).rows[0];
  const summary = {
    total: Number(summaryResult?.total || 0),
    requested: Number(summaryResult?.requested_count || 0),
    awaitingPayment: Number(summaryResult?.awaiting_count || 0),
    confirmed: Number(summaryResult?.confirmed_count || 0),
    cancelled: Number(summaryResult?.cancelled_count || 0),
    confirmedRevenue: Number(summaryResult?.confirmed_revenue || 0),
    collectedDeposits: Number(summaryResult?.collected_deposits || 0),
    collectedBalances: Number(summaryResult?.collected_balances || 0),
  };
  return { bookings: rows.map((row) => adminDto(row)), pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }, summary };
}

export async function getAdminBooking(id, { client, config } = {}) { return adminDto(await rowById(await store(client), id), config); }

export async function confirmBooking(id, { totalAmount, terms } = {}, { client, config = getPaymentConfig(), fetchImpl = fetch, now, blockedDates = [] } = {}) {
  const database = await store(client);
  const current = timestamp(now);
  const agreedTerms = text(terms, "booking terms", 2000);
  let row;
  try {
    row = await transaction(database, async (tx) => {
      const existing = await rowById(tx, id);
      checkedConfig(existing, config);
      try { validateQuote({ ...requestFor(existing), totalAmount }); } catch {
        throw new BookingError("invalid-request", "Set an exact confirmed total allowing a 50% deposit of at least PHP 1.00.", 422);
      }
      if (existing.status !== "requested") {
        if (!["awaiting_payment", "confirmed", "test_paid"].includes(existing.status) || Number(existing.total_amount) !== totalAmount || existing.terms !== agreedTerms) {
          throw new BookingError("booking-conflict", "The approved quote cannot be changed. Review the current booking and payment first.", 409);
        }
        if (!existing.session_id && current - Number(existing.checkout_started_at) > RETRY_WINDOW) {
          throw new BookingError("payment-review-required", "Checkout creation needs manual review in PayMongo before another attempt. The date remains held.", 409);
        }
        return existing;
      }
      validateStayDate(existing.stay_date, current);
      if (blockedDates.includes(existing.stay_date)) throw new BookingError("date-unavailable", "That date is unavailable. Decline this request or discuss another date.", 409);
      try {
        await tx.execute({ sql: "INSERT INTO booking_holds (stay_date,livemode,booking_id) VALUES (?,?,?)", args: [existing.stay_date, existing.livemode, id] });
      } catch (error) {
        if (String(error?.code).startsWith("SQLITE_CONSTRAINT")) throw new BookingError("date-unavailable", "Another booking already holds that date.", 409);
        throw error;
      }
      await tx.execute({ sql: `UPDATE bookings SET status='awaiting_payment',total_amount=?,deposit_amount=?,terms=?,idempotency_key=?,checkout_started_at=?,payment_status='creating',updated_at=? WHERE id=? AND status='requested'`,
        args: [totalAmount, totalAmount / 2, agreedTerms, randomUUID(), current, current, id] });
      return rowById(tx, id);
    });
  } catch (error) { throw translateStoreError(error); }
  if (row.session_id || ["confirmed", "test_paid"].includes(row.status)) return adminDto(row, config);
  try {
    const session = await createCheckoutSession(requestFor(row), config, row.idempotency_key, fetchImpl);
    if (!/^cs_[A-Za-z0-9_-]{4,128}$/.test(session.id || "")) throw new BookingError("payment-review-required", "Checkout could not be verified. Review PayMongo before retrying.", 502);
    const saved = await database.execute({ sql: "UPDATE bookings SET session_id=?,payment_status='pending',payment_error_code=NULL,updated_at=? WHERE id=? AND status='awaiting_payment' AND (session_id IS NULL OR session_id=?)", args: [session.id, current, id, session.id] });
    if (!saved.rowsAffected) throw new BookingError("payment-review-required", "The checkout needs manual review before proceeding.", 409);
    return refreshBookingPayment(id, { client: database, config, fetchImpl });
  } catch (error) {
    const code = error?.code === "request-mismatch" ? "request-mismatch" : "provider-unavailable";
    await database.execute({ sql: "UPDATE bookings SET payment_error_code=?,updated_at=? WHERE id=?", args: [code, current, id] });
    if (error instanceof BookingError) throw error;
    throw new BookingError(code, "The checkout could not be completed. The date remains held; retry this same approved booking or review PayMongo.", 502);
  }
}

export async function syncBookingFromPayment(payment, { client } = {}) {
  const request = payment?.request;
  if (!request || typeof request.reference !== "string" || !["pending", "expired", "paid", "refunded"].includes(payment.status)) {
    throw new BookingError("payment-mismatch", "Payment could not be matched to a booking.", 409);
  }
  const database = await store(client);
  return transaction(database, async (tx) => {
    const row = (await tx.execute({ sql: "SELECT * FROM bookings WHERE reference = ?", args: [request.reference] })).rows[0];
    if (!row) return null;
    const stored = requestFor(row);
    if (Object.keys(stored).some((field) => stored[field] !== request[field]) ||
      (["paid", "refunded"].includes(payment.status) && !/^pay_[A-Za-z0-9_-]+$/.test(payment.paymentId || ""))) {
      throw new BookingError("payment-mismatch", "Payment details do not match the approved booking.", 409);
    }
    let status = row.status;
    if (payment.status === "paid" && row.status !== "refunded") status = row.livemode ? "confirmed" : "test_paid";
    else if (payment.status === "refunded") status = "refunded";
    else if (payment.status === "expired" && !["confirmed", "test_paid", "refunded", "cancelled", "declined"].includes(row.status)) status = "payment_issue";
    if ((["cancelled", "declined"].includes(row.status) || row.cancellation_reason) && ["paid", "refunded"].includes(payment.status)) status = "payment_issue";
    if (["paid", "refunded"].includes(payment.status)) {
      try {
        await tx.execute({ sql: "INSERT INTO booking_holds (stay_date,livemode,booking_id) VALUES (?,?,?) ON CONFLICT(booking_id) DO NOTHING", args: [row.stay_date, row.livemode, row.id] });
      } catch {
        throw new BookingError("payment-review-required", "Payment received after the date was released. Contact the host to resolve the date conflict.", 409);
      }
    }
    const paymentStatus = row.payment_status === "refunded" || (row.payment_status === "paid" && ["pending", "expired"].includes(payment.status)) ? row.payment_status : payment.status;
    await tx.execute({ sql: "UPDATE bookings SET status=?,payment_status=?,payment_id=COALESCE(?,payment_id),payment_error_code=NULL,updated_at=? WHERE id=?", args: [status, paymentStatus, payment.paymentId || null, Date.now(), row.id] });
    return adminDto(await rowById(tx, row.id));
  });
}

export async function refreshBookingPayment(id, { client, config = getPaymentConfig(), fetchImpl = fetch } = {}) {
  const database = await store(client);
  const row = await rowById(database, id);
  checkedConfig(row, config);
  if (!row.session_id) throw new BookingError("payment-not-ready", "The host has not created a verified payment checkout yet.", 409);
  try {
    const payment = await retrievePaymentRequest(createPaymentToken(requestFor(row), config), config, fetchImpl);
    await syncBookingFromPayment(payment, { client: database });
    return getAdminBooking(id, { client: database, config });
  } catch (error) {
    const code = error?.code === "request-mismatch" ? "request-mismatch" : "provider-unavailable";
    await database.execute({ sql: "UPDATE bookings SET payment_error_code=?,updated_at=? WHERE id=?", args: [code, Date.now(), id] });
    if (error instanceof BookingError) throw error;
    throw new BookingError(code, "Payment status is unavailable. The date remains held; check PayMongo before making changes.", 502);
  }
}

export async function markBalancePaid(id, { method = "Cash on arrival", paid = true, client: optClient } = {}, { client: ctxClient } = {}) {
  const database = await store(optClient || ctxClient);
  const row = await rowById(database, id);

  if (!["confirmed", "test_paid"].includes(row.status)) {
    throw new BookingError("invalid-request", "Balance can only be marked as paid for confirmed bookings with an approved deposit.", 422);
  }
  const now = Date.now();
  if (!paid) {
    await database.execute({
      sql: "UPDATE bookings SET balance_paid_at = NULL, balance_method = NULL, updated_at = ? WHERE id = ?",
      args: [now, id],
    });
    return adminDto(await rowById(database, id));
  }
  const cleanMethod = text(method, "balance payment method", 60);
  await database.execute({
    sql: "UPDATE bookings SET balance_paid_at = ?, balance_method = ?, updated_at = ? WHERE id = ?",
    args: [now, cleanMethod, now, id],
  });
  return adminDto(await rowById(database, id));
}

export async function cancelBooking(id, { reason, decline = false } = {}, { client, config = getPaymentConfig(), fetchImpl = fetch } = {}) {

  const database = await store(client);
  const explanation = text(reason, "cancellation reason", 500);
  let row = await rowById(database, id);
  checkedConfig(row, config);
  if (["cancelled", "declined"].includes(row.status)) return adminDto(row, config);
  if (row.status !== "requested") {
    if (!row.session_id) throw new BookingError("payment-review-required", "Checkout creation is unresolved. Recover this same checkout or review PayMongo before releasing the date.", 409);
    await refreshBookingPayment(id, { client: database, config, fetchImpl });
    row = await rowById(database, id);
    if (["paid", "refunded"].includes(row.payment_status) || ["confirmed", "test_paid", "refunded"].includes(row.status)) {
      throw new BookingError("refund-required", "This deposit was paid. Handle any refund and booking decision in PayMongo; the date remains held.", 409);
    }
    if (row.payment_status !== "expired") await expireCheckoutSession(row.session_id, config, fetchImpl);
    const checked = await retrievePaymentRequest(createPaymentToken(requestFor(row), config), config, fetchImpl);
    await syncBookingFromPayment(checked, { client: database });
    if (checked.status !== "expired") throw new BookingError("payment-review-required", "The checkout is not verified as unpaid and expired. The date remains held.", 409);
  }
  return transaction(database, async (tx) => {
    const latest = await rowById(tx, id);
    if (latest.status !== "requested" && latest.payment_status !== "expired") {
      throw new BookingError("booking-conflict", "The booking payment changed. Review it before releasing the date.", 409);
    }
    await tx.execute({ sql: "UPDATE bookings SET status=?,cancellation_reason=?,updated_at=? WHERE id=?", args: [decline && latest.status === "requested" ? "declined" : "cancelled", explanation, Date.now(), id] });
    await tx.execute({ sql: "DELETE FROM booking_holds WHERE booking_id=?", args: [id] });
    return adminDto(await rowById(tx, id), config);
  });
}

export async function getUnavailableDates({ client, config = getPaymentConfig(), now } = {}) {
  const database = await store(client);
  await cleanupExpiredHolds(database, now);
  const held = (await database.execute({ sql: "SELECT stay_date FROM booking_holds WHERE livemode=? ORDER BY stay_date", args: [Number(config.livemode)] })).rows.map((row) => row.stay_date);
  const blocked = (await database.execute({ sql: "SELECT stay_date FROM blocked_dates ORDER BY stay_date" })).rows.map((row) => row.stay_date);
  return Array.from(new Set([...held, ...blocked])).sort();
}

export async function getBlockedDates({ client } = {}) {
  const database = await store(client);
  const rows = (await database.execute({ sql: "SELECT stay_date, reason, created_at FROM blocked_dates ORDER BY stay_date" })).rows;
  return rows.map((row) => ({
    date: row.stay_date,
    reason: row.reason || null,
    createdAt: new Date(Number(row.created_at)).toISOString(),
  }));
}

export async function addBlockedDate(date, { reason = null, client, now } = {}) {
  const current = timestamp(now);
  const validatedDate = validateStayDate(date, current);
  const database = await store(client);
  const cleanReason = reason ? text(reason, "reason", 200, { optional: true }) : null;
  await database.execute({
    sql: "INSERT INTO blocked_dates (stay_date, reason, created_at) VALUES (?, ?, ?) ON CONFLICT(stay_date) DO UPDATE SET reason = excluded.reason",
    args: [validatedDate, cleanReason, current],
  });
  return getBlockedDates({ client: database });
}

export async function removeBlockedDate(date, { client } = {}) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new BookingError("invalid-request", "Choose a valid date to unblock.", 422);
  }
  const database = await store(client);
  await database.execute({ sql: "DELETE FROM blocked_dates WHERE stay_date = ?", args: [date] });
  return getBlockedDates({ client: database });
}

export async function getBookingByPaymentReference(reference, { client } = {}) {
  if (typeof reference !== "string" || reference.length > 64) return null;
  const row = (await (await store(client)).execute({ sql: "SELECT id,reference,status,livemode,stay_date,payment_status FROM bookings WHERE reference=?", args: [reference] })).rows[0];
  return row ? { id: row.id, reference: row.reference, status: row.status, livemode: Boolean(row.livemode), date: row.stay_date, paymentStatus: row.payment_status } : null;
}

