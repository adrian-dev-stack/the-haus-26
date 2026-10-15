import { confirmBooking, refreshBookingPayment, cancelBooking, markBalancePaid, refundAndCancelBooking, getAdminBooking } from "@/lib/bookings";
import { parsePesoAmount } from "@/lib/payments";
import { property } from "@/lib/property";
import { BookingHttpError, bookingResponse, bookingFailure, requireBookingAdmin, requireBookingOrigin, readBookingBody, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    await requireBookingAdmin();
    const { id } = await params;
    const booking = await getAdminBooking(id);
    return bookingResponse({ booking });
  } catch (error) { return bookingFailure(error); }
}
export async function POST(request, { params }) {
  try {
    requireBookingOrigin(request);
    await requireBookingAdmin();
    await limitBookingRequest(request, "admin-booking-actions", 60);
    const body = await readBookingBody(request);
    const { id } = await params;
    let booking;
    if (body.action === "confirm") {
      let totalAmount;
      try { totalAmount = parsePesoAmount(body.total); }
      catch { throw new BookingHttpError("invalid-total", "Enter the final total in pesos, for example 5000.", 422); }
      booking = await confirmBooking(id, { totalAmount, terms: body.terms }, { blockedDates: property.bookedDates });
    } else if (body.action === "refresh") booking = await refreshBookingPayment(id);
    else if (body.action === "cancel") booking = await cancelBooking(id, { reason: body.reason });
    else if (body.action === "refund_cancel") booking = await refundAndCancelBooking(id, { reason: body.reason });
    else if (body.action === "mark_balance_paid") booking = await markBalancePaid(id, { method: body.method, paid: body.paid !== false });
    else throw new BookingHttpError("invalid-action", "Choose a supported booking action.", 400);
    return bookingResponse({ booking });
  } catch (error) { return bookingFailure(error); }
}

