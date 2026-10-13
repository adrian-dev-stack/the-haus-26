import { cookies } from "next/headers";
import Link from "next/link";
import PaymentLayout from "@/components/PaymentLayout";
import PaymentRequestView, { PaymentUnavailable } from "@/components/PaymentRequestView";
import { getPaymentConfig, retrievePaymentRequest } from "@/lib/payments";
import { limitPaymentRead } from "@/lib/booking-http";
import { syncBookingFromPayment } from "@/lib/bookings";
import { runBookingNotifications } from "@/lib/booking-notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata = {
  title: "Check your deposit payment",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default async function PaymentReturnPage({ searchParams }) {
  const { reference } = await searchParams;
  const safeReference = typeof reference === "string" && /^[A-Za-z0-9_-]{3,64}$/.test(reference) ? reference : null;
  const token = safeReference ? (await cookies()).get(`haus26_payment_${safeReference}`)?.value : null;
  let payment;
  let failure;
  let bookingUrl;
  let booking;
  if (token) {
    try {
      await limitPaymentRead();
      payment = await retrievePaymentRequest(token, getPaymentConfig());
      if (payment.request.reference !== safeReference) { payment = null; failure = "invalid-link"; }
    }
    catch (error) { failure = error.code || "provider-unavailable"; }
  }
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
      {payment ? <PaymentRequestView payment={payment} token={token} booking={booking} returned />
        : token ? <PaymentUnavailable invalid={["invalid-link", "invalid-request", "request-mismatch"].includes(failure)} temporary={failure === "provider-unavailable"} />
          : <div className="payment-message">
            <p className="section-label">Booking deposit</p>
            <h1>Check your payment with the host.</h1>
            <p>Open your original payment link to check its status. If you have already paid, the host can verify the transaction in PayMongo and finalize your reservation.</p>
            <Link href="/#inquire" className="button-primary">Contact the host</Link>
          </div>}
      {bookingUrl && <Link href={bookingUrl} className="text-link">View your booking status</Link>}
    </PaymentLayout>
  );
}
