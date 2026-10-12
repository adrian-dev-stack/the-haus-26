import { getCalendarEvents } from "@/lib/bookings";
import { generateIcalFeed } from "@/lib/booking-ical";
import { getAdminSession } from "@/lib/booking-auth";

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
      ].filter(Boolean);

      if (validSecrets.includes(key)) {
        isHost = true;
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

    return new Response(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="thehaus26-calendar.ics"',
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
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
