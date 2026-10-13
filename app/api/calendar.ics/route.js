import { createHash } from "node:crypto";
import { getCalendarEvents } from "@/lib/bookings";
import { generateIcalFeed } from "@/lib/booking-ical";
import { getAdminSession, verifyAdminPassword } from "@/lib/booking-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key") || "";

    let isHost = false;

    // Check host key authorization
    if (key) {
      const validSecrets = [
        process.env.BOOKING_SESSION_SECRET,
        process.env.CRON_SECRET,
        process.env.BOOKING_TOKEN_SECRET,
        process.env.PAYMENT_LINK_SECRET,
      ].filter(Boolean);

      if (validSecrets.includes(key)) {
        isHost = true;
      } else {
        try {
          if (await verifyAdminPassword(key)) {
            isHost = true;
          }
        } catch {}
      }
    }

    // Also check active admin cookie session if accessing from browser
    if (!isHost) {
      try {
        const session = await getAdminSession();
        if (session) isHost = true;
      } catch {}
    }

    const { bookings, blockedDates } = await getCalendarEvents({ isHost });
    const icsContent = generateIcalFeed({ bookings, blockedDates, isHost });
    const etag = `"${createHash("sha256").update(icsContent).digest("hex").slice(0, 32)}"`;
    const cacheControl = isHost ? "private, no-cache, max-age=0, must-revalidate" : "public, max-age=300, stale-while-revalidate=600";

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
    return new Response(`Failed to generate calendar: ${error?.message || "Internal error"}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
}
