import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  PaymentError,
  createCheckoutSession,
  createPaymentToken,
  expireCheckoutSession,
  getPaymentConfig,
  retrievePaymentRequest,
  validateQuote,
} from "../lib/payments.js";

const PROJECT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAFE_RETRY_WINDOW = 23 * 60 * 60 * 1000;

export function parsePesoAmount(value) {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new PaymentError("invalid-request", "Enter --total in pesos, for example 5000 or 5000.50.");
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw new PaymentError("invalid-request", "The booking total is too large.");
  return amount;
}

async function saveRecord(filename, record) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await open(temporary, "wx", 0o600).then(async (handle) => {
      try {
        await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
        await handle.sync();
      } finally {
        await handle.close();
      }
    });
    await rename(temporary, filename);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}

async function withRecord(reference, config, ledgerDir, action) {
  validateQuote({ reference, date: "2026-01-01", guests: 1, totalAmount: 200 });
  await mkdir(ledgerDir, { recursive: true, mode: 0o700 });
  const filename = path.join(ledgerDir, `${config.livemode ? "live" : "test"}-${reference}.json`);
  const lockname = `${filename}.lock`;
  let lock;
  try {
    lock = await open(lockname, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new PaymentError("ledger-locked", "This reference is already being processed. If a previous command stopped, check PayMongo before removing its ledger lock.");
    }
    throw error;
  }
  try {
    let record;
    try {
      record = JSON.parse(await readFile(filename, "utf8"));
      const savedQuote = validateQuote(record.quote);
      if (record.version !== 1 || savedQuote.reference !== reference || record.livemode !== config.livemode ||
        record.quote.depositAmount !== savedQuote.depositAmount || !Number.isSafeInteger(record.startedAt) ||
        typeof record.idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(record.idempotencyKey) ||
        typeof record.siteUrl !== "string" || !Array.isArray(record.paymentMethods)) {
        throw new Error("Invalid ledger");
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new PaymentError("invalid-ledger", "The saved payment record cannot be read. Check PayMongo and restore the ledger before creating a payment.");
      }
    }
    return await action(record, (updated) => saveRecord(filename, updated));
  } finally {
    await lock.close();
    await unlink(lockname);
  }
}

function requestFromRecord(record, config) {
  if (!record?.sessionId) {
    throw new PaymentError("creation-unresolved", "The payment creation is unresolved. Re-run the same confirmed create command within 23 hours, or check PayMongo before proceeding.");
  }
  return { sessionId: record.sessionId, ...validateQuote(record.quote), livemode: config.livemode };
}

async function summarizeRecord(record, config, fetchImpl) {
  const request = requestFromRecord(record, config);
  const token = createPaymentToken(request, config);
  const payment = await retrievePaymentRequest(token, config, fetchImpl);
  return { ...payment, guestUrl: `${config.siteUrl}/pay/${token}` };
}

export async function createHostPaymentRequest(quote, config, {
  confirmed = false,
  ledgerDir = path.join(PROJECT_DIR, ".payment-requests"),
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  if (!confirmed) throw new PaymentError("confirmation-required", "Confirm the date, guest count, total, and booking terms with the guest, then include --confirmed.");
  const approved = validateQuote(quote);
  return withRecord(approved.reference, config, ledgerDir, async (record, save) => {
    if (record && JSON.stringify(record.quote) !== JSON.stringify(approved)) {
      throw new PaymentError("quote-changed", "This reference already has a different quote. Expire its checkout before issuing an agreed replacement under a new reference.");
    }
    if (record?.sessionId) return summarizeRecord(record, config, fetchImpl);
    if (record && (now < record.startedAt || now - record.startedAt >= SAFE_RETRY_WINDOW)) {
      throw new PaymentError("creation-unresolved", "This unresolved creation is outside the safe retry window. Check PayMongo and recover the original session ID; do not create another checkout blindly.");
    }
    if (record && (record.siteUrl !== config.siteUrl || JSON.stringify(record.paymentMethods) !== JSON.stringify(config.paymentMethods))) {
      throw new PaymentError("quote-changed", "The checkout configuration changed during an unresolved request. Restore the original configuration before retrying.");
    }
    if (!record) {
      record = {
        version: 1,
        quote: approved,
        livemode: config.livemode,
        siteUrl: config.siteUrl,
        paymentMethods: config.paymentMethods,
        startedAt: now,
        idempotencyKey: randomUUID(),
        state: "creating",
      };
      await save(record);
    }
    const session = await createCheckoutSession(approved, config, record.idempotencyKey, fetchImpl);
    if (!/^cs_[A-Za-z0-9_-]{4,128}$/.test(session.id || "") || session.type !== "checkout_session" || session.attributes?.livemode !== config.livemode) {
      throw new PaymentError("creation-unresolved", "PayMongo returned unexpected checkout details. Check the dashboard before retrying this reference.");
    }
    record = { ...record, state: "created", sessionId: session.id, createdAt: now };
    await save(record);
    const summary = await summarizeRecord(record, config, fetchImpl);
    await save({ ...record, token: summary.guestUrl.split("/pay/")[1] });
    return summary;
  });
}

export async function showHostPaymentRequest(reference, config, {
  ledgerDir = path.join(PROJECT_DIR, ".payment-requests"), fetchImpl = fetch,
} = {}) {
  return withRecord(reference, config, ledgerDir, async (record) => {
    if (!record) throw new PaymentError("not-found", "No saved payment request exists for this reference.");
    return summarizeRecord(record, config, fetchImpl);
  });
}

export async function expireHostPaymentRequest(reference, config, {
  ledgerDir = path.join(PROJECT_DIR, ".payment-requests"), fetchImpl = fetch,
} = {}) {
  return withRecord(reference, config, ledgerDir, async (record, save) => {
    if (!record) throw new PaymentError("not-found", "No saved payment request exists for this reference.");
    const summary = await summarizeRecord(record, config, fetchImpl);
    if (summary.status === "paid" || summary.status === "refunded") {
      throw new PaymentError("already-paid", "This checkout has a payment or refund recorded. Manage it through PayMongo; expiration does not refund a payment.");
    }
    if (summary.status !== "expired") {
      await expireCheckoutSession(record.sessionId, config, fetchImpl);
    }
    await save({ ...record, state: "expired", expiredAt: Date.now() });
    return { ...summary, status: "expired" };
  });
}

function printSummary(summary) {
  const { request } = summary;
  const money = (value) => `PHP ${(value / 100).toFixed(2)}`;
  process.stdout.write([
    `Reference: ${request.reference}`,
    `Stay: ${request.date} / ${request.guests} guest(s)`,
    `Agreed total: ${money(request.totalAmount)}`,
    `50% deposit: ${money(request.depositAmount)}`,
    `Mode: ${request.livemode ? "LIVE" : "TEST (no real payment)"}`,
    `Payment status: ${summary.status}`,
    `Guest link: ${summary.guestUrl}`,
    "The host must reconcile payment and confirm the reservation separately.",
    "",
  ].join("\n"));
}

export async function runPaymentCli(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    reference: { type: "string" }, date: { type: "string" }, guests: { type: "string" }, total: { type: "string" },
    confirmed: { type: "boolean", default: false }, help: { type: "boolean", short: "h" },
  } });
  if (values.help) {
    process.stdout.write("Create: npm run payment:request -- create --reference HAUS-001 --date 2026-12-20 --guests 4 --total 5000 --confirmed\nShow: npm run payment:request -- show --reference HAUS-001\nExpire: npm run payment:request -- expire --reference HAUS-001\nUse one reference per agreed quote; back up .payment-requests and never delete its records to retry.\n");
    return;
  }
  const envModule = await import("@next/env");
  const loadEnvConfig = envModule.loadEnvConfig || envModule.default.loadEnvConfig;
  loadEnvConfig(PROJECT_DIR);
  const config = getPaymentConfig();
  const command = positionals[0] || "create";
  if (positionals.length > 1 || !["create", "show", "expire"].includes(command)) {
    throw new PaymentError("invalid-request", "Choose create, show, or expire.");
  }
  let summary;
  if (command === "create") {
    summary = await createHostPaymentRequest({ reference: values.reference, date: values.date, guests: Number(values.guests), totalAmount: parsePesoAmount(values.total) }, config, { confirmed: values.confirmed });
  } else {
    summary = await (command === "show" ? showHostPaymentRequest : expireHostPaymentRequest)(values.reference, config);
  }
  printSummary(summary);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPaymentCli().catch((error) => {
    process.stderr.write(`${error instanceof PaymentError ? error.message : "The payment command failed. Check the saved ledger and PayMongo before retrying."}\n`);
    process.exitCode = 1;
  });
}
