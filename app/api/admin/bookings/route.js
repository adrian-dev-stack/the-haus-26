import { listAdminBookings } from "@/lib/bookings";
import { bookingResponse, bookingFailure, requireBookingAdmin } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request) {
  try {
    await requireBookingAdmin();
    const query = new URL(request.url).searchParams;
    return bookingResponse(await listAdminBookings({ status: query.get("status") || undefined, page: Number(query.get("page") || 1) }));
  } catch (error) { return bookingFailure(error); }
}
