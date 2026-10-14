import { createExpense, deleteExpense, listExpenses, updateExpense } from "@/lib/admin-operations";
import { BookingHttpError, bookingFailure, bookingResponse, limitBookingRequest, readBookingBody, requireBookingAdmin, requireBookingOrigin } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireBookingAdmin();
    const query = new URL(request.url).searchParams;
    return bookingResponse(await listExpenses({ month: query.get("month") ?? undefined, page: query.get("page") ?? undefined,
      category: query.get("category") ?? undefined, search: query.get("search") ?? undefined }));
  } catch (error) { return bookingFailure(error); }
}

export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await requireBookingAdmin();
    await limitBookingRequest(request, "admin-expenses", 60);
    const body = await readBookingBody(request, 8192);
    if (body.action === "create") return bookingResponse({ expense: await createExpense(body) }, 201);
    if (body.action === "update") return bookingResponse({ expense: await updateExpense(body.id, body) });
    if (body.action === "delete") return bookingResponse(await deleteExpense(body.id, body));
    throw new BookingHttpError("invalid-action", "Choose a supported expense action.", 400);
  } catch (error) { return bookingFailure(error); }
}
