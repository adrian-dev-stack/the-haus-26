import { getFinancialOverview } from "@/lib/admin-operations";
import { bookingFailure, bookingResponse, requireBookingAdmin } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireBookingAdmin();
    const query = new URL(request.url).searchParams;
    return bookingResponse(await getFinancialOverview({ month: query.get("month") ?? undefined }));
  } catch (error) {
    return bookingFailure(error);
  }
}
