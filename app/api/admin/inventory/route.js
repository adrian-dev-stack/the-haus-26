import { adjustInventory, archiveInventoryItem, createInventoryItem, listInventory, updateInventoryItem } from "@/lib/admin-operations";
import { BookingHttpError, bookingFailure, bookingResponse, limitBookingRequest, readBookingBody, requireBookingAdmin, requireBookingOrigin } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    await requireBookingAdmin();
    const query = new URL(request.url).searchParams;
    return bookingResponse(await listInventory({ status: query.get("status") ?? undefined, page: query.get("page") ?? undefined,
      kind: query.get("kind") ?? undefined, lowStock: query.get("lowStock") ?? undefined, search: query.get("search") ?? undefined }));
  } catch (error) { return bookingFailure(error); }
}

export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await requireBookingAdmin();
    await limitBookingRequest(request, "admin-inventory", 60);
    const body = await readBookingBody(request, 8192);
    if (body.action === "create") return bookingResponse({ item: await createInventoryItem(body) }, 201);
    if (body.action === "update") return bookingResponse({ item: await updateInventoryItem(body.id, body) });
    if (body.action === "archive") return bookingResponse({ item: await archiveInventoryItem(body.id, body) });
    if (body.action === "adjust") return bookingResponse(await adjustInventory(body.id, body));
    throw new BookingHttpError("invalid-action", "Choose a supported inventory action.", 400);
  } catch (error) { return bookingFailure(error); }
}
