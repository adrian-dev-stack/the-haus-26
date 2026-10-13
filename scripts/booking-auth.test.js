import test from "node:test";
import assert from "node:assert/strict";
import { hashAdminPassword, verifyAdminPassword, createAdminSession, verifyAdminSession, shouldRefreshAdminSession, ADMIN_SESSION_SECONDS } from "../lib/booking-auth.js";

test("admin passwords are salted and verified without storing plaintext", async () => {
  const password = "a long host password 0123456789";
  const passwordHash = await hashAdminPassword(password);
  const env = { BOOKING_ADMIN_PASSWORD_HASH: passwordHash, BOOKING_SESSION_SECRET: "s".repeat(64) };
  assert.notEqual(passwordHash, await hashAdminPassword(password));
  assert.equal(passwordHash.includes(password), false);
  assert.equal(await verifyAdminPassword(password, env), true);
  assert.equal(await verifyAdminPassword("incorrect password", env), false);
  assert.equal(await verifyAdminPassword(null, env), false);
  await assert.rejects(hashAdminPassword("short"));
});

test("admin sessions reject forgery, expiry, future issuance, and credential rotation", async () => {
  const env = { BOOKING_ADMIN_PASSWORD_HASH: await hashAdminPassword("a long host password 0123456789"), BOOKING_SESSION_SECRET: "s".repeat(64) };
  const now = 100000;
  const session = createAdminSession(env, now);
  assert.equal(verifyAdminSession(session, env, now), true);
  assert.equal(verifyAdminSession(session, env, now + ADMIN_SESSION_SECONDS * 1000), false);
  assert.equal(verifyAdminSession(session, env, now - 6000), false);
  const [body, signature] = session.split(".");
  assert.equal(verifyAdminSession(`${body}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`, env, now), false);
  const payload = JSON.parse(Buffer.from(body, "base64url"));
  payload.expiresAt += 100000;
  assert.equal(verifyAdminSession(`${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`, env, now), false);
  assert.equal(verifyAdminSession(session, { ...env, BOOKING_SESSION_SECRET: "x".repeat(64) }, now), false);
  assert.equal(verifyAdminSession(session, { ...env, BOOKING_ADMIN_PASSWORD_HASH: await hashAdminPassword("another long host password") }, now), false);
  assert.equal(verifyAdminSession(undefined, env, now), false);
});

test("admin session sliding refresh detects when session is past halfway", async () => {
  const env = { BOOKING_ADMIN_PASSWORD_HASH: await hashAdminPassword("a long host password 0123456789"), BOOKING_SESSION_SECRET: "s".repeat(64) };
  const start = 100000;
  const session = createAdminSession(env, start);
  assert.equal(shouldRefreshAdminSession(session, env, start + 1000), false);
  assert.equal(shouldRefreshAdminSession(session, env, start + (ADMIN_SESSION_SECONDS * 1000) / 2 + 1000), true);
  assert.equal(shouldRefreshAdminSession("invalid.token", env, start), false);
});
