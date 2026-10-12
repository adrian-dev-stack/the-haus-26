import { timingSafeEqual } from "node:crypto";
import { runBookingMaintenance } from "@/lib/bookings";
import { BookingHttpError, bookingResponse, bookingFailure } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET || "";
    if (secret.length < 32) throw new Error("Booking maintenance is not configured.");
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(request.headers.get("authorization") || "");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new BookingHttpError("unauthorized", "Maintenance authorization is required.", 401);
    return bookingResponse(await runBookingMaintenance());
  } catch (error) { return bookingFailure(error); }
}
