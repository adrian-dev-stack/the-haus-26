import { ADMIN_COOKIE } from "@/lib/booking-auth";
import { getPaymentConfig } from "@/lib/payments";
import { bookingResponse, bookingFailure, requireBookingOrigin } from "@/lib/booking-http";

export const runtime = "nodejs";
export async function POST(request) {
  try {
    requireBookingOrigin(request);
    const response = bookingResponse({ signedIn: false });
    response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: getPaymentConfig().siteUrl.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) { return bookingFailure(error); }
}
