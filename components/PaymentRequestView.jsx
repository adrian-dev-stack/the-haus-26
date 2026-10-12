import Link from "next/link";
import { property } from "@/lib/property";

function pesos(amount) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);
}

function dateLabel(date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long", timeZone: "Asia/Manila",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

export function PaymentUnavailable({ invalid = false, temporary = false }) {
  return (
    <div className="payment-message">
      <p className="section-label">Booking deposit</p>
      <h1>{invalid ? "Ask the host for a new link." : temporary ? "We couldn’t check this payment." : "Arrange your deposit with the host."}</h1>
      <p>{invalid
        ? "This payment link could not be verified. Please use the original link sent by the host, or ask them to send it again."
        : temporary
          ? "Payment details are temporarily unavailable. If you already paid, please check with the host before trying again."
          : "Online checkout is being set up. The host will give you payment instructions after confirming your date and final rate."}</p>
      {temporary && <a href="" className="button-primary">Check again</a>}
      <Link href="/#inquire" className="text-link">Contact the host</Link>
    </div>
  );
}

export default function PaymentRequestView({ payment, token, returned = false, booking = null }) {
  const { request, status } = payment;
  const paid = status === "paid";
  const pending = status === "pending";
  const test = !request.livemode;
  const title = paid
    ? test ? "Test payment completed." : "Your deposit was received."
    : status === "expired" ? "This payment request has closed."
      : status === "refunded" ? "Please check with the host."
        : "Your booking deposit.";

  return (
    <div className="payment-content">
      <div className="payment-intro">
        <p className="section-label">{property.name} · Booking deposit</p>
        <h1>{title}</h1>
        <p>{paid
          ? test ? "PayMongo recorded a successful test payment. No real deposit was collected."
            : booking ? "Your deposit is verified and your booking status has been updated. Contact the host to arrange your arrival and remaining balance."
              : "PayMongo has confirmed your payment. The host will finalize your reservation and confirm arrangements for the remaining balance."
          : status === "expired"
            ? "Please ask the host to confirm the date again and send a new payment request."
            : status === "refunded"
              ? "A refund is recorded for this payment. Ask the host to confirm your booking status and any remaining balance."
              : booking ? "Your dates are held while you complete this deposit. Review your stay and booking terms before continuing to PayMongo."
                : "The host has prepared this request after confirming your date and final rate. Review your stay before paying the 50% deposit."}</p>
        {test && <p className="payment-notice" role="note">Test checkout. No real money is collected.</p>}
        {returned && pending && <p className="payment-notice" role="status">A completed payment has not been verified yet. If you just paid, check again or contact the host before making another payment.</p>}
        <Link href="/#inquire" className="text-link">Contact the host</Link>
      </div>
      <section className="payment-summary" aria-labelledby="payment-summary-heading">
        <h2 id="payment-summary-heading">Your stay</h2>
        <dl className="payment-details">
          <div><dt>Reference</dt><dd>{request.reference}</dd></div>
          <div><dt>Check-in date</dt><dd>{dateLabel(request.date)}</dd></div>
          <div><dt>Guests</dt><dd>{request.guests}</dd></div>
          {booking?.endDate && <div><dt>Check-out date</dt><dd>{dateLabel(booking.endDate)}</dd></div>}
          <div><dt>Private stay</dt><dd>{booking?.days > 1 ? `${booking.days} days (${booking.days * 24 - 2} hours)` : "22 hours"}</dd></div>
          <div><dt>Confirmed total</dt><dd>{pesos(request.totalAmount)}</dd></div>
          <div className="payment-total"><dt>50% deposit{paid ? " paid" : ""}</dt><dd>{pesos(request.depositAmount)}</dd></div>
          <div><dt>Remaining balance{status === "refunded" ? " before adjustments" : ""}</dt><dd>{pesos(request.totalAmount - request.depositAmount)}</dd></div>
        </dl>
        {pending && (
          <form action="/api/payments/continue" method="post" className="payment-action">
            <input type="hidden" name="token" value={token} />
            <button type="submit" className="button-primary">{test ? "Open test checkout" : `Pay ${pesos(request.depositAmount)} deposit`}</button>
            <p>You’ll continue to PayMongo to choose a payment method. Please agree cancellation and rescheduling terms with the host before paying.</p>
          </form>
        )}
        {returned && pending && <a href={`/pay/${token}`} className="text-link">Check payment status again</a>}
        {paid && <p className="payment-notice" role="status">{test ? "Test payment verified" : "Deposit payment verified"}</p>}
      </section>
    </div>
  );
}
