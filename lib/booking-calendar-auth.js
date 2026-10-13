import { timingSafeEqual } from "node:crypto";

function configuredToken(env) {
  const token = env.BOOKING_CALENDAR_TOKEN;
  return typeof token === "string" && /^[A-Za-z0-9_-]{32,256}$/.test(token) ? token : null;
}

export function verifyCalendarToken(value, env = process.env) {
  const token = configuredToken(env);
  if (!token || typeof value !== "string" || value.length !== token.length) return false;
  const expected = Buffer.from(token);
  const received = Buffer.from(value);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function getHostCalendarUrl(env = process.env) {
  const token = configuredToken(env);
  return token ? `/api/calendar.ics?key=${encodeURIComponent(token)}` : null;
}
