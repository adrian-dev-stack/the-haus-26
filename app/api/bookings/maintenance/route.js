import { timingSafeEqual } from "node:crypto";
import { runBookingMaintenance } from "@/lib/bookings";
import { BookingHttpError, bookingResponse, bookingFailure } from "@/lib/booking-http";
import { getAdminSession } from "@/lib/booking-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET || "";
    let authorized = false;

    // 1. Check Bearer Authorization header or query param ?key=
    if (secret && secret.length >= 32) {
      const authHeader = request.headers.get("authorization") || "";
      const expected = Buffer.from(`Bearer ${secret}`);
      const received = Buffer.from(authHeader);
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        authorized = true;
      }

      const { searchParams } = new URL(request.url);
      if (searchParams.get("key") === secret) {
        authorized = true;
      }
    }

    // 2. Allow active host admin session (e.g. from host workspace button)
    if (!authorized) {
      const session = await getAdminSession();
      if (session) authorized = true;
    }

    if (!authorized) {
      throw new BookingHttpError("unauthorized", "Maintenance authorization is required.", 401);
    }

    const result = await runBookingMaintenance();
    return bookingResponse({ success: true, ...result });
  } catch (error) {
    return bookingFailure(error);
  }
}

export async function POST(request) {
  return GET(request);
}
