import { getPaymentConfig } from "@/lib/payments";
import { getBookingStore } from "@/lib/booking-store";
import { getBookingByPaymentReference, refreshBookingPayment } from "@/lib/bookings";
import { verifyPaymongoWebhook } from "@/lib/booking-webhook";
import { BookingHttpError, bookingResponse, bookingFailure, readBookingBody } from "@/lib/booking-http";
import { runBookingNotifications } from "@/lib/booking-notifications";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request) {
  let client;
  let eventKey;
  try {
    const config = getPaymentConfig();
    const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
    if (!secret || secret.length < 16) throw new Error("Webhook is not configured.");
    const raw = await readBookingBody(request, 262144, true);
    if (!verifyPaymongoWebhook(raw, request.headers.get("paymongo-signature"), secret, config.livemode)) {
      throw new BookingHttpError("invalid-signature", "Webhook signature is invalid.", 401);
    }
    let event;
    try { event = JSON.parse(raw.toString("utf8")).data; } catch {}
    if (!event || !/^evt_[A-Za-z0-9_-]{4,128}$/.test(event.id || "") || event.type !== "event" || event.attributes?.livemode !== config.livemode) {
      throw new BookingHttpError("invalid-event", "Webhook event is invalid.", 400);
    }
    if (event.attributes.type !== "checkout_session.payment.paid") return bookingResponse({ received: true, ignored: true });
    const checkout = event.attributes.data;
    if (checkout?.type !== "checkout_session" || !/^cs_[A-Za-z0-9_-]{4,128}$/.test(checkout.id || "")) {
      throw new BookingHttpError("invalid-event", "Webhook checkout is invalid.", 400);
    }
    const booking = await getBookingByPaymentReference(checkout.attributes?.reference_number);
    if (!booking) return bookingResponse({ received: true, ignored: true });
    client = await getBookingStore();
    await client.execute("CREATE TABLE IF NOT EXISTS booking_webhook_events (event_id TEXT PRIMARY KEY, processed_at INTEGER, lease_until INTEGER NOT NULL)");
    eventKey = `${config.livemode ? "live" : "test"}:${event.id}`;
    const now = Date.now();
    const claim = await client.execute({ sql: "INSERT INTO booking_webhook_events (event_id,processed_at,lease_until) VALUES (?,NULL,?) ON CONFLICT(event_id) DO UPDATE SET lease_until=excluded.lease_until WHERE booking_webhook_events.processed_at IS NULL AND booking_webhook_events.lease_until<=? RETURNING event_id",
      args: [eventKey, now + 60000, now] });
    if (!claim.rows.length) {
      const record = (await client.execute({ sql: "SELECT processed_at FROM booking_webhook_events WHERE event_id=?", args: [eventKey] })).rows[0];
      if (record?.processed_at) return bookingResponse({ received: true, duplicate: true });
      eventKey = null;
      throw new Error("Event is processing.");
    }
    await refreshBookingPayment(booking.id, { client, config });
    await client.execute({ sql: "UPDATE booking_webhook_events SET processed_at=?,lease_until=0 WHERE event_id=?", args: [Date.now(), eventKey] });
    await runBookingNotifications({ client, bookingId: booking.id, siteUrl: config.siteUrl }).catch(() => {});
    return bookingResponse({ received: true });
  } catch (error) {
    if (client && eventKey) await client.execute({ sql: "UPDATE booking_webhook_events SET lease_until=0 WHERE event_id=? AND processed_at IS NULL", args: [eventKey] }).catch(() => {});
    return bookingFailure(error);
  }
}
