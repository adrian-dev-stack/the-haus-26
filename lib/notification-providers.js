const EMAIL_ENDPOINT = "https://api.resend.com/emails";
const SMS_ENDPOINT = "https://unismsapi.com/api/sms";
const EMAIL_ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const RESPONSE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export class NotificationError extends Error {
  constructor(code, message, { retryable = false, ambiguous = false } = {}) {
    super(message);
    this.name = "NotificationError";
    this.code = code;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

export function normalizePhilippinePhone(phone) {
  if (typeof phone !== "string" || !phone || phone.length > 40 || /[^+\d ()-]/.test(phone)) {
    throw new NotificationError("invalid-recipient", "Use a valid Philippine mobile number.");
  }
  const digits = phone.replace(/[ ()-]/g, "");
  if (/^09\d{9}$/.test(digits)) return `+63${digits.slice(1)}`;
  if (/^9\d{9}$/.test(digits)) return `+63${digits}`;
  if (/^639\d{9}$/.test(digits)) return `+${digits}`;
  if (/^\+639\d{9}$/.test(digits)) return digits;
  throw new NotificationError("invalid-recipient", "Use a valid Philippine mobile number.");
}

function isEmail(value) {
  return typeof value === "string" && value.length <= 254 && !/\s/.test(value) && EMAIL_ADDRESS.test(value) && value.split("@")[0].length <= 64;
}

function isEmailSender(value) {
  if (typeof value !== "string" || value.length > 320 || /[\r\n\0]/.test(value)) return false;
  if (isEmail(value)) return true;
  const match = /^([^<>]+) <([^<>]+)>$/.exec(value);
  return Boolean(match && match[1].trim() && isEmail(match[2]));
}

function isSecret(value, { basic = false } = {}) {
  return typeof value === "string" && value.length >= 1 && value.length <= 512 && !/[^!-~]/.test(value) && (!basic || !value.includes(":"));
}

function isSenderId(value) {
  return typeof value === "string" && value.length >= 1 && value.length <= 64 && !/[\x00-\x1f\x7f]/.test(value);
}

function configValue(env, name, validate) {
  const raw = env[name];
  if (raw === undefined || raw === null || raw === "") return "";
  if (typeof raw !== "string") throw new NotificationError("not-configured", "Notification settings are invalid.");
  const value = raw.trim();
  if (value && validate && !validate(value)) throw new NotificationError("not-configured", "Notification settings are invalid.");
  return value;
}

export function getNotificationConfig(env = process.env) {
  const testPhone = configValue(env, "BOOKING_NOTIFICATION_TEST_PHONE");
  let normalizedTestPhone = "";
  if (testPhone) {
    try {
      normalizedTestPhone = normalizePhilippinePhone(testPhone);
    } catch {
      throw new NotificationError("not-configured", "Notification settings are invalid.");
    }
  }
  return {
    enabled: env.BOOKING_NOTIFICATIONS_ENABLED === "true",
    testEnabled: env.BOOKING_NOTIFICATIONS_TEST_ENABLED === "true",
    testEmail: configValue(env, "BOOKING_NOTIFICATION_TEST_EMAIL", isEmail),
    testPhone: normalizedTestPhone,
    resendApiKey: configValue(env, "RESEND_API_KEY", isSecret),
    emailFrom: configValue(env, "BOOKING_EMAIL_FROM", isEmailSender),
    emailReplyTo: configValue(env, "BOOKING_EMAIL_REPLY_TO", isEmail),
    hostEmail: configValue(env, "BOOKING_HOST_EMAIL", isEmail),
    unismsApiKey: configValue(env, "UNISMS_API_KEY", (value) => isSecret(value, { basic: true })),
    smsSenderId: configValue(env, "UNISMS_SENDER_ID", isSenderId),
  };
}

function checkEnabled(config) {
  if (!config?.enabled) throw new NotificationError("notifications-disabled", "Notifications are disabled.");
}

function validateText(text, maxLength) {
  if (typeof text !== "string" || !text.trim() || text.length > maxLength || text.includes("\0")) {
    throw new NotificationError("invalid-message", "Notification content is invalid.");
  }
}

function unknownOutcome(code, retryable) {
  return new NotificationError(code, "The notification outcome could not be verified.", { retryable, ambiguous: true });
}

async function sendRequest(endpoint, headers, body, { fetchImpl, retryAmbiguous }) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw unknownOutcome("provider-unknown", retryAmbiguous);
  }
  if (response?.status === 429) {
    throw new NotificationError("provider-rate-limited", "Notification sending is temporarily limited.", { retryable: true });
  }
  if (!Number.isInteger(response?.status) || response.status >= 500) {
    throw unknownOutcome("provider-unknown", retryAmbiguous);
  }
  // https://resend.com/docs/api-reference/errors
  if (endpoint === EMAIL_ENDPOINT && response.status === 409) {
    let details;
    try { details = await response.json(); }
    catch { details = null; }
    if (details?.name === "concurrent_idempotent_requests") {
      throw unknownOutcome("provider-idempotency-pending", true);
    }
    if (details?.name === "invalid_idempotent_request") {
      throw unknownOutcome("provider-idempotency-conflict", false);
    }
  }
  if (response.status < 200 || response.status >= 300) {
    throw new NotificationError("provider-rejected", "The notification request was rejected.");
  }
  try {
    return await response.json();
  } catch {
    throw unknownOutcome("invalid-provider-response", retryAmbiguous);
  }
}

// https://resend.com/docs/api-reference/emails/send-email
export async function sendEmail({ to, subject, text } = {}, { config = getNotificationConfig(), idempotencyKey, fetchImpl = fetch } = {}) {
  checkEnabled(config);
  if (!isSecret(config.resendApiKey) || !isEmailSender(config.emailFrom) ||
    (config.emailReplyTo && !isEmail(config.emailReplyTo))) {
    throw new NotificationError("not-configured", "Email notifications are not configured.");
  }
  if (!isEmail(to)) throw new NotificationError("invalid-recipient", "Use a valid email address.");
  if (typeof subject !== "string" || !subject.trim() || subject.length > 200 || /[\r\n\0]/.test(subject)) {
    throw new NotificationError("invalid-message", "Notification content is invalid.");
  }
  validateText(text, 50000);
  if (typeof idempotencyKey !== "string" || /\s/.test(idempotencyKey) || !/^[A-Za-z0-9][A-Za-z0-9_./:-]{0,255}$/.test(idempotencyKey)) {
    throw new NotificationError("invalid-idempotency-key", "A valid notification identifier is required.");
  }
  const result = await sendRequest(EMAIL_ENDPOINT, {
    Authorization: `Bearer ${config.resendApiKey}`,
    "Idempotency-Key": idempotencyKey,
  }, {
    from: config.emailFrom,
    to: [to],
    subject,
    text,
    ...(config.emailReplyTo ? { reply_to: config.emailReplyTo } : {}),
  }, { fetchImpl, retryAmbiguous: true });
  if (typeof result?.id !== "string" || /\s/.test(result.id) || !RESPONSE_ID.test(result.id)) {
    throw unknownOutcome("invalid-provider-response", true);
  }
  return { id: result.id };
}

// https://unismsapi.com/docs/sms; no request idempotency is documented.
export async function sendSms({ to, text } = {}, { config = getNotificationConfig(), fetchImpl = fetch } = {}) {
  checkEnabled(config);
  if (!isSecret(config.unismsApiKey, { basic: true }) || !isSenderId(config.smsSenderId)) {
    throw new NotificationError("not-configured", "SMS notifications are not configured.");
  }
  const recipient = normalizePhilippinePhone(to);
  validateText(text, 670);
  const result = await sendRequest(SMS_ENDPOINT, {
    Authorization: `Basic ${Buffer.from(`${config.unismsApiKey}:`).toString("base64")}`,
  }, { recipient, content: text, sender_id: config.smsSenderId }, { fetchImpl, retryAmbiguous: false });
  const message = result?.message;
  if (message?.status === "failed") {
    throw new NotificationError("sms-failed", "The SMS could not be sent.");
  }
  if (!message || typeof message.reference_id !== "string" || /\s/.test(message.reference_id) || !/^msg_[A-Za-z0-9_-]{1,124}$/.test(message.reference_id) ||
    !["pending", "retrying", "sent"].includes(message.status)) {
    throw unknownOutcome("invalid-provider-response", false);
  }
  return { id: message.reference_id };
}
