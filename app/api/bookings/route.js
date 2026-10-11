import { createBookingRequest } from "@/lib/bookings";
import { property } from "@/lib/property";
import { getPaymentConfig } from "@/lib/payments";
import { bookingResponse, bookingFailure, requireBookingOrigin, readBookingBody, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await limitBookingRequest(request, "booking-create", 8);
    const result = await createBookingRequest(await readBookingBody(request), { blockedDates: property.bookedDates });
    return bookingResponse({ booking: result.booking, guestUrl: `${getPaymentConfig().siteUrl}/book/${result.token}` }, result.replayed ? 200 : 201);
  } catch (error) { return bookingFailure(error); }
}
