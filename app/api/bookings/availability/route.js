import { getUnavailableDates } from "@/lib/bookings";
import { property } from "@/lib/property";
import { getPaymentConfig } from "@/lib/payments";
import { bookingResponse, bookingFailure, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    await limitBookingRequest(request, "availability", 120, 5 * 60 * 1000);
    return bookingResponse({ bookedDates: [...new Set([...property.bookedDates, ...await getUnavailableDates()])].sort(), livemode: getPaymentConfig().livemode });
  }
  catch (error) { return bookingFailure(error); }
}
