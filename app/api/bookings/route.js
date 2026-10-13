import { createBookingRequest } from "@/lib/bookings";
import { property } from "@/lib/property";
import { getPaymentConfig } from "@/lib/payments";
import { bookingResponse, bookingFailure, requireBookingOrigin, readBookingBody, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await limitBookingRequest(request, "booking-create", 8);
    const body = await readBookingBody(request);
    const hasCapacityLimit = Number.isSafeInteger(property.maxGuests) && property.maxGuests > 0;
    const hasTerms = Boolean(property.bookingTerms?.trim());
    const autoApprove = hasCapacityLimit && hasTerms && Number(body.guests) <= property.maxGuests;
    const result = await createBookingRequest(body, { blockedDates: property.bookedDates, autoApprove });
    return bookingResponse({
      booking: result.booking,
      guestUrl: `${getPaymentConfig().siteUrl}/book/${result.token}`,
      paymentToken: result.booking.paymentToken,
    }, result.replayed ? 200 : 201);
  } catch (error) { return bookingFailure(error); }
}
