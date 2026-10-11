import PaymentLayout from "@/components/PaymentLayout";

export default function LoadingPayment() {
  return <PaymentLayout><div className="payment-message" aria-busy="true" role="status"><p className="section-label">Booking deposit</p><h1>Checking your payment request…</h1><p>We’re retrieving the latest details from PayMongo.</p></div></PaymentLayout>;
}
