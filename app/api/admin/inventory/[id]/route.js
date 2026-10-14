import { getInventoryHistory } from "@/lib/admin-operations";
import { bookingFailure, bookingResponse, requireBookingAdmin } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    await requireBookingAdmin();
    const { id } = await params;
    return bookingResponse(await getInventoryHistory(id, { page: new URL(request.url).searchParams.get("page") ?? undefined }));
  } catch (error) { return bookingFailure(error); }
}
