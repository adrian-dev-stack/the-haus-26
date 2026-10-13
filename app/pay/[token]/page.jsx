import PaymentLayout from "@/components/PaymentLayout";
import PaymentRequestView, { PaymentUnavailable } from "@/components/PaymentRequestView";
import { getPaymentConfig, retrievePaymentRequest } from "@/lib/payments";
import { limitPaymentRead } from "@/lib/booking-http";
import { syncBookingFromPayment } from "@/lib/bookings";
import { runBookingNotifications } from "@/lib/booking-notifications";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Your booking deposit",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function BookingPaymentPage({ params, searchParams }) {
  const { token } = await params;
  const query = await searchParams;
  let payment;
  let failure;
  let bookingUrl;
  let booking;
  try { await limitPaymentRead(); payment = await retrievePaymentRequest(token, getPaymentConfig()); }
  catch (error) { failure = error.code || "provider-unavailable"; }
  if (payment) {
    try {
      const synced = await syncBookingFromPayment(payment);
      bookingUrl = synced?.guestUrl;
      if (synced) booking = { days: synced.days, endDate: synced.endDate };
      if (payment.status === "paid") {
        await runBookingNotifications({ bookingId: synced?.id, siteUrl: getPaymentConfig().siteUrl }).catch(() => {});
      }
    } catch {}
  }
  return (
    <PaymentLayout>
      {payment
        ? <PaymentRequestView payment={payment} token={token} returned={query.returned === "1"} booking={booking} />
        : <PaymentUnavailable invalid={["invalid-link", "invalid-request", "request-mismatch"].includes(failure)} temporary={failure === "provider-unavailable"} />}
      {bookingUrl && <Link href={bookingUrl} className="text-link">View your booking status</Link>}
    </PaymentLayout>
  );
}
