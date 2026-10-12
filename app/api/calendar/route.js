import { GET as calendarGet } from "../calendar.ics/route.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  return calendarGet(request);
}
