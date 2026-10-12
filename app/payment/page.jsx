import Link from "next/link";
import PaymentLayout from "@/components/PaymentLayout";
import { getPaymentConfig } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Booking deposit",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function PaymentPage() {
  let enabled = false;
  try { getPaymentConfig(); enabled = true; } catch {}
  return (
    <PaymentLayout>
      <div className="payment-content">
        <div className="payment-intro">
          <p className="section-label">Choose dates, then pay</p>
          <h1>A deposit for your stay.</h1>
          <p>Choose your dates and group size to see the listed rate. Your dates are held for 30 minutes while you complete the 50% deposit.</p>
          <Link href="/book" className="button-primary">Choose your stay</Link>
        </div>
        <section className="payment-summary" aria-labelledby="deposit-heading">
          <h2 id="deposit-heading">How your deposit works</h2>
          <ol className="deposit-steps">
            <li><h3>Review your booking</h3><p>Select available dates, enter your group size, and review the total and booking terms.</p></li>
            <li><h3>Pay the 50% deposit</h3><p>{enabled ? "Open the checkout from your private booking page and complete your deposit through PayMongo." : "Online checkout is unavailable. Contact the host for booking help."}</p></li>
            <li><h3>Check your confirmation</h3><p>A verified live payment confirms your reservation. Test payments are labeled and do not create a real reservation. Arrange the remaining balance with the host.</p></li>
          </ol>
          <p className="payment-notice">Already speaking with the host? Use the payment link they send for your specific stay.</p>
        </section>
      </div>
    </PaymentLayout>
  );
}
