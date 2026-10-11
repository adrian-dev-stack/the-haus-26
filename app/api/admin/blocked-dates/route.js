import { addBlockedDate, getBlockedDates, removeBlockedDate } from "@/lib/bookings";
import {
  BookingHttpError,
  bookingFailure,
  bookingResponse,
  limitBookingRequest,
  readBookingBody,
  requireBookingAdmin,
  requireBookingOrigin,
} from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireBookingAdmin();
    const blockedDates = await getBlockedDates();
    return bookingResponse({ blockedDates });
  } catch (error) {
    return bookingFailure(error);
  }
}

export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await requireBookingAdmin();
    await limitBookingRequest(request, "admin-blocked-dates", 60);
    const body = await readBookingBody(request);

    if (body.action === "block") {
      if (!body.date) {
        throw new BookingHttpError("invalid-date", "A stay date is required.", 422);
      }
      const blockedDates = await addBlockedDate(body.date, { reason: body.reason });
      return bookingResponse({ blockedDates });
    }

    if (body.action === "unblock") {
      if (!body.date) {
        throw new BookingHttpError("invalid-date", "A stay date is required.", 422);
      }
      const blockedDates = await removeBlockedDate(body.date);
      return bookingResponse({ blockedDates });
    }

    throw new BookingHttpError("invalid-action", "Choose a supported action (block or unblock).", 400);
  } catch (error) {
    return bookingFailure(error);
  }
}
