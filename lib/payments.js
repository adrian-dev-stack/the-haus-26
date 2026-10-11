import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const API_ORIGIN = "https://api.paymongo.com";
const TOKEN_CONTEXT = Buffer.from("haus26-payment:v1");
const PAYMENT_METHODS = new Set(["card", "gcash", "qrph", "paymaya", "grab_pay"]);

export class PaymentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
  }
}

export function getPaymentConfig(env = process.env) {
  const secretKey = env.PAYMONGO_SECRET_KEY || "";
  const match = /^sk_(test|live)_[A-Za-z0-9_-]{8,}$/.exec(secretKey);
  const linkSecret = env.PAYMENT_LINK_SECRET || "";
  if (!match || typeof linkSecret !== "string" || linkSecret.length < 32) {
    throw new PaymentError("not-configured", "Payments are not configured. Contact the host for your payment request.");
  }
  const livemode = match[1] === "live";
  if (livemode && env.PAYMENTS_LIVE_ENABLED !== "true") {
    throw new PaymentError("not-configured", "Live payments have not been enabled.");
  }
  let url;
  try {
    url = new URL(env.SITE_URL);
  } catch {
    throw new PaymentError("not-configured", "Set SITE_URL to the website origin.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local && !livemode))) {
    throw new PaymentError("not-configured", "SITE_URL must be an HTTPS origin; test mode also allows localhost HTTP.");
  }
  const paymentMethods = [...new Set((env.PAYMONGO_PAYMENT_METHODS || "card,gcash").split(",").map((value) => value.trim()))];
  if (!paymentMethods.length || paymentMethods.some((method) => !PAYMENT_METHODS.has(method))) {
    throw new PaymentError("not-configured", "Choose supported PayMongo payment methods: card, gcash, qrph, paymaya, grab_pay.");
  }
  return { secretKey, linkSecret, siteUrl: url.origin, livemode, paymentMethods };
}

export function validateQuote({ reference, date, guests, totalAmount } = {}) {
  if (typeof reference !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(reference)) {
    throw new PaymentError("invalid-request", "Use a booking reference with 3 to 64 letters, numbers, hyphens, or underscores.");
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new PaymentError("invalid-request", "Use a valid stay date in YYYY-MM-DD format.");
  }
  if (!Number.isSafeInteger(guests) || guests < 1 || guests > 999) {
    throw new PaymentError("invalid-request", "Enter the guest count agreed with the host.");
  }
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 200 || totalAmount > 999999998 || totalAmount % 2 !== 0) {
    throw new PaymentError("invalid-request", "The total must allow an exact 50% deposit in centavos, with a deposit of at least PHP 1.00.");
  }
  return { reference, date, guests, totalAmount, depositAmount: totalAmount / 2 };
}

function normalizeRequest(request, config) {
  const quote = validateQuote(request);
  if (!/^cs_[A-Za-z0-9_-]{4,128}$/.test(request.sessionId || "") ||
    request.depositAmount !== quote.depositAmount || request.livemode !== config.livemode) {
    throw new PaymentError("invalid-link", "This payment link is invalid or belongs to another payment environment.");
  }
  return { sessionId: request.sessionId, ...quote, livemode: request.livemode };
}

function tokenKey(config) {
  return createHash("sha256").update(config.linkSecret).digest();
}

export function createPaymentToken(request, config) {
  const payload = normalizeRequest(request, config);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(config), iv);
  cipher.setAAD(TOKEN_CONTEXT);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(".");
}

export function readPaymentToken(token, config) {
  try {
    if (typeof token !== "string" || token.length > 4096) throw new Error("Invalid token");
    const parts = token.split(".");
    if (parts.length !== 4 || parts[0] !== "v1" || parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) {
      throw new Error("Invalid token");
    }
    const [iv, ciphertext, tag] = parts.slice(1).map((part) => Buffer.from(part, "base64url"));
    if (iv.length !== 12 || tag.length !== 16 ||
      [iv, ciphertext, tag].some((part, index) => part.toString("base64url") !== parts[index + 1])) throw new Error("Invalid token");
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(config), iv);
    decipher.setAAD(TOKEN_CONTEXT);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    return normalizeRequest(JSON.parse(plaintext), config);
  } catch {
    throw new PaymentError("invalid-link", "This payment link is invalid. Ask the host to resend your link.");
  }
}

export async function paymongoRequest(path, config, { method = "GET", body, idempotencyKey, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${API_ORIGIN}${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("Provider rejected request");
    const result = await response.json();
    if (!result?.data) throw new Error("Invalid provider response");
    return result.data;
  } catch {
    throw new PaymentError("provider-unavailable", "Payment details are unavailable right now. Contact the host before making another payment.");
  }
}

function safeCheckoutUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "checkout.paymongo.com" || url.username || url.password || url.port) {
      throw new Error("Untrusted checkout URL");
    }
    return url.href;
  } catch {
    throw new PaymentError("request-mismatch", "The payment checkout could not be verified. Contact the host.");
  }
}

function hasRefund(payment) {
  return payment.status === "refunded" || (Array.isArray(payment.refunds) && payment.refunds.some((refund) => {
    const attributes = refund.attributes || refund;
    return ["succeeded", "pending", "processing"].includes(attributes.status) ||
      (attributes.amount > 0 && !["failed", "cancelled"].includes(attributes.status));
  }));
}

export async function retrievePaymentRequest(token, config, fetchImpl = fetch) {
  const request = readPaymentToken(token, config);
  const session = await paymongoRequest(`/v1/checkout_sessions/${encodeURIComponent(request.sessionId)}`, config, { fetchImpl });
  const attributes = session.attributes;
  const item = attributes?.line_items?.[0];
  if (session.id !== request.sessionId || session.type !== "checkout_session" ||
    attributes?.reference_number !== request.reference || attributes?.livemode !== request.livemode ||
    attributes?.line_items?.length !== 1 || item?.amount !== request.depositAmount || item?.currency !== "PHP" || item?.quantity !== 1 ||
    !["active", "expired"].includes(attributes?.status) || !Array.isArray(attributes.payments)) {
    throw new PaymentError("request-mismatch", "The booking payment details do not match this link. Contact the host.");
  }
  const checkoutUrl = safeCheckoutUrl(attributes.checkout_url);
  let paidPayment;
  let refunded = false;
  for (const payment of attributes.payments) {
    const details = payment.attributes;
    if (!["paid", "refunded", "failed", "pending"].includes(details?.status)) {
      throw new PaymentError("request-mismatch", "The payment status could not be verified. Contact the host before paying again.");
    }
    if (details?.status === "paid" || details?.status === "refunded") {
      if (typeof payment.id !== "string" || !payment.id.startsWith("pay_") ||
        details.amount !== request.depositAmount || details.currency !== "PHP" || details.livemode !== request.livemode) {
        throw new PaymentError("request-mismatch", "The received payment does not match the agreed deposit. Contact the host.");
      }
      paidPayment = payment;
      refunded ||= hasRefund(details);
    }
  }
  const status = refunded ? "refunded" : paidPayment ? "paid" : attributes.status === "expired" ? "expired" : "pending";
  return { request, status, checkoutUrl, ...(paidPayment ? { paymentId: paidPayment.id } : {}) };
}

export async function createCheckoutSession(quote, config, idempotencyKey, fetchImpl = fetch) {
  const confirmed = validateQuote(quote);
  return paymongoRequest("/v2/checkout_sessions", config, {
    method: "POST",
    idempotencyKey,
    fetchImpl,
    body: {
      data: {
        attributes: {
          line_items: [{ name: "The HauS 26 booking deposit (50%)", amount: confirmed.depositAmount, currency: "PHP", quantity: 1 }],
          payment_method_types: config.paymentMethods,
          reference_number: confirmed.reference,
          success_url: `${config.siteUrl}/payment/return?reference=${encodeURIComponent(confirmed.reference)}`,
          cancel_url: `${config.siteUrl}/payment/return?reference=${encodeURIComponent(confirmed.reference)}`,
          send_email_receipt: true,
          metadata: { stay_date: confirmed.date, guests: String(confirmed.guests), total_amount: String(confirmed.totalAmount), deposit_amount: String(confirmed.depositAmount) },
        },
      },
    },
  });
}

export async function expireCheckoutSession(sessionId, config, fetchImpl = fetch) {
  const session = await paymongoRequest(`/v1/checkout_sessions/${encodeURIComponent(sessionId)}/expire`, config, { method: "POST", fetchImpl });
  if (session.id !== sessionId || session.attributes?.status !== "expired") {
    throw new PaymentError("provider-unavailable", "The checkout expiration could not be verified. Check the PayMongo dashboard before releasing the date.");
  }
  return session;
}
