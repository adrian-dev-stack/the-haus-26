import { createHash } from "node:crypto";
import { getCalendarEvents } from "@/lib/bookings";
import { generateIcalFeed } from "@/lib/booking-ical";
import { getAdminSession } from "@/lib/booking-auth";
import { verifyCalendarToken } from "@/lib/booking-calendar-auth";
import { BookingHttpError, bookingFailure, limitBookingRequest } from "@/lib/booking-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let isHost = false;
    if (searchParams.has("key")) {
      const keys = searchParams.getAll("key");
      if (keys.length !== 1 || !verifyCalendarToken(keys[0])) {
        await limitBookingRequest(request, "calendar-auth", 10);
        throw new BookingHttpError("invalid-calendar-key", "Calendar authorization is invalid.", 401);
      }
      isHost = true;
    } else {
      try { isHost = Boolean(await getAdminSession()); } catch {}
    }

    const { bookings, blockedDates } = await getCalendarEvents({ isHost });
    const icsContent = generateIcalFeed({ bookings, blockedDates, isHost });
    const etag = `"${createHash("sha256").update(icsContent).digest("hex").slice(0, 32)}"`;
    const cacheControl = isHost ? "private, no-store, max-age=0" : "public, max-age=300, stale-while-revalidate=600";

    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "ETag": etag,
          "Cache-Control": cacheControl,
          "X-Calendar-Role": isHost ? "host" : "public",
        },
      });
    }

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="thehaus26-calendar.ics"',
        "ETag": etag,
        "Cache-Control": cacheControl,
        "X-Calendar-Role": isHost ? "host" : "public",
      },
    });
  } catch (error) {
    return bookingFailure(error);
  }
}
