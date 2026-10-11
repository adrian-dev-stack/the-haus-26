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
          <p className="section-label">Plan first, then pay</p>
          <h1>A deposit for your stay.</h1>
          <p>Your booking deposit is 50% of the final rate agreed with the host. Start with an inquiry so your date, group size, and price are confirmed first.</p>
          <Link href="/#inquire" className="button-primary">Inquire about a stay</Link>
        </div>
        <section className="payment-summary" aria-labelledby="deposit-heading">
          <h2 id="deposit-heading">How your deposit works</h2>
          <ol className="deposit-steps">
            <li><h3>Confirm your stay</h3><p>Agree your date, guest count, final price, and cancellation or rescheduling terms with the host.</p></li>
            <li><h3>Pay the 50% deposit</h3><p>{enabled ? "Open the individual payment link the host sends you. Review your booking details, then continue to PayMongo checkout." : "Online checkout is being set up. After confirming your stay, the host will provide payment instructions."}</p></li>
            <li><h3>Receive your confirmation</h3><p>The host confirms receipt and finalizes your reservation. Arrange the remaining 50% directly with them.</p></li>
          </ol>
          <p className="payment-notice">Already speaking with the host? Use the payment link they send for your specific stay.</p>
        </section>
      </div>
    </PaymentLayout>
  );
}
