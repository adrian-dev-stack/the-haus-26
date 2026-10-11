import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const derive = promisify(scrypt);
export const ADMIN_COOKIE = "haus26_admin";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

export async function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 16 || password.length > 256) throw new Error("Use a password with 16 to 256 characters.");
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 32);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

function authConfig(env = process.env) {
  const passwordHash = env.BOOKING_ADMIN_PASSWORD_HASH || "";
  const secret = env.BOOKING_SESSION_SECRET || "";
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{64}$/.test(passwordHash) || secret.length < 32) throw new Error("Host sign-in is not configured.");
  return { passwordHash, secret };
}

export async function verifyAdminPassword(password, env = process.env) {
  const { passwordHash } = authConfig(env);
  if (typeof password !== "string" || password.length > 256 || password.length < 1) return false;
  const [, salt, encoded] = passwordHash.split(":");
  const actual = await derive(password, salt, 32);
  return timingSafeEqual(actual, Buffer.from(encoded, "hex"));
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(`haus26-admin:v1:${value}`).digest("base64url");
}

export function createAdminSession(env = process.env, now = Date.now()) {
  const { passwordHash, secret } = authConfig(env);
  const body = Buffer.from(JSON.stringify({ v: 1, issuedAt: now, expiresAt: now + ADMIN_SESSION_SECONDS * 1000,
    credential: createHash("sha256").update(passwordHash).digest("hex"), nonce: randomBytes(16).toString("base64url") })).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyAdminSession(value, env = process.env, now = Date.now()) {
  try {
    const { passwordHash, secret } = authConfig(env);
    if (typeof value !== "string" || value.length > 1024) return false;
    const [body, signature, extra] = value.split(".");
    if (extra || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== 32 || !timingSafeEqual(actual, Buffer.from(sign(body, secret), "base64url"))) return false;
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return session.v === 1 && Number.isSafeInteger(session.issuedAt) && Number.isSafeInteger(session.expiresAt) &&
      session.issuedAt <= now + 5000 && session.expiresAt > now && session.expiresAt - session.issuedAt === ADMIN_SESSION_SECONDS * 1000 &&
      session.credential === createHash("sha256").update(passwordHash).digest("hex");
  } catch { return false; }
}

export async function getAdminSession() {
  const { cookies } = await import("next/headers");
  return verifyAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}
