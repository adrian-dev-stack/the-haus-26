import { getGuestBooking } from "@/lib/bookings";
import { bookingResponse, bookingFailure, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request, { params }) {
  try {
    await limitBookingRequest(request, "booking-status", 60, 5 * 60 * 1000);
    const { token } = await params;
    return bookingResponse({ booking: await getGuestBooking(token, { refreshPayment: true }) });
  } catch (error) { return bookingFailure(error); }
}
