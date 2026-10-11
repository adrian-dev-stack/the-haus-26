import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createAdminSession, verifyAdminPassword } from "@/lib/booking-auth";
import { getPaymentConfig } from "@/lib/payments";
import { BookingHttpError, bookingResponse, bookingFailure, requireBookingOrigin, readBookingBody, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    requireBookingOrigin(request);
    await limitBookingRequest(request, "admin-login", 10);
    const { password } = await readBookingBody(request, 2048);
    if (!await verifyAdminPassword(password)) throw new BookingHttpError("invalid-login", "The password is incorrect.", 401);
    const response = bookingResponse({ signedIn: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), { httpOnly: true, secure: getPaymentConfig().siteUrl.startsWith("https:"), sameSite: "lax", path: "/", maxAge: ADMIN_SESSION_SECONDS });
    return response;
  } catch (error) { return bookingFailure(error); }
}
