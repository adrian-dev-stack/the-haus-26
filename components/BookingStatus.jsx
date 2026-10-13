"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STATES = {
  requested: ["Your request is with the host.", "The host is reviewing your date and group size. Your date is not reserved yet. Save this private link and check it for updates."],
  awaiting_payment: ["Your dates are held.", "Your dates are held for 30 minutes. Complete your 50% deposit below to lock in your reservation."],
  confirmed: ["Your stay is booked.", "Your 50% deposit has been verified. Contact the host to arrange arrival details and your remaining balance."],
  test_paid: ["Test payment received.", "This was a PayMongo test checkout. No real money was collected and no live reservation was made."],
  cancelled: ["This booking is cancelled.", "Contact the host if you would like to request a different date."],
  declined: ["The host cannot confirm this request.", "Contact the host to discuss another date or submit a new request."],
  payment_issue: ["Your payment needs a review.", "Please contact the host before making another payment."],
  refunded: ["A refund needs host review.", "A refund was recorded for this payment. Contact the host to confirm the amount and the next steps for your stay."],
};
const money = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);
const dateLabel = (date) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" }).format(new Date(`${date}T12:00:00Z`));

export default function BookingStatus({ token }) {
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [updated, setUpdated] = useState(false);

  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/bookings/${encodeURIComponent(token)}`, { cache: "no-store", signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "This booking could not be opened. Please check your private link.");
      setBooking(result.data.booking); setUpdated(true);
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure instanceof TypeError ? "We could not reach the booking service. Please try again." : failure.message);
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [token]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function copyLink() {
    try { await navigator.clipboard.writeText(window.location.href); setCopyMessage("Private link copied. Share it only with people involved in your booking."); }
    catch { setCopyMessage("Save this page’s address from your browser."); }
  }

  if (!booking) return <div className="booking-message"><p className="section-label">Your booking</p><h1>{loading ? "Opening your request…" : "Booking unavailable"}</h1>{error && <p role="alert">{error}</p>}<button type="button" onClick={() => load()} disabled={loading} className="booking-secondary">{loading ? "Loading…" : "Try again"}</button><Link href="/#inquire" className="text-link">Contact the host</Link></div>;
  const [title, description] = STATES[booking.status] || ["Your booking needs a review.", "Please contact the host for an update."];
  const hasQuote = Number.isSafeInteger(booking.totalAmount) && Number.isSafeInteger(booking.depositAmount) && booking.totalAmount > 0;
  const canPay = booking.status === "awaiting_payment" && booking.paymentToken && !booking.paymentCheckFailed && !["paid", "refunded", "expired"].includes(booking.paymentStatus);

  return (
    <div className="booking-status-layout" aria-busy={loading}>
      <div className="booking-message"><p className="section-label">Booking {booking.reference}</p><h1>{title}</h1><p>{description}</p>{booking.livemode === false && <p className="booking-notice">Test mode · Payments here do not collect real money or confirm a live stay.</p>}{booking.paymentCheckFailed && <p className="booking-notice">Showing saved status. Payment verification is unavailable; contact the host before paying again.</p>}<div className="booking-actions"><button type="button" className="booking-secondary" onClick={() => load()} disabled={loading}>{loading ? "Checking…" : "Refresh status"}</button><button type="button" className="booking-secondary" onClick={copyLink}>Copy private link</button></div>{error && <p className="booking-error" role="alert">{error}</p>}{copyMessage && <p aria-live="polite">{copyMessage}</p>}<p className="booking-small" role="status">{loading ? "Checking the latest booking status…" : booking.paymentCheckFailed ? "Showing saved booking status. Keep this link private." : updated ? "Latest status checked. Keep this link private." : "Keep this link private."}</p><Link href="/#inquire" className="text-link">Contact the host</Link></div>
      <section className="booking-panel" aria-labelledby="booking-details-heading"><h2 id="booking-details-heading">Your stay</h2><dl className="booking-details"><div><dt>Check-in</dt><dd>{dateLabel(booking.date)} (11:00 AM)</dd></div>{booking.endDate && <div><dt>Check-out</dt><dd>{dateLabel(booking.endDate)} (9:00 AM)</dd></div>}<div><dt>Stay duration</dt><dd>{booking.days > 1 ? `${booking.days} days (${booking.days * 24 - 2} hours total)` : "22 hours (1 day)"}</dd></div><div><dt>Guests</dt><dd>{booking.guests}</dd></div>{hasQuote && <><div><dt>Confirmed total</dt><dd>{money(booking.totalAmount)}</dd></div><div className="booking-amount"><dt>50% deposit</dt><dd>{money(booking.depositAmount)}</dd></div><div><dt>Remaining balance</dt><dd>{money(booking.totalAmount - booking.depositAmount)}</dd></div></>}</dl>{booking.terms && <div className="booking-terms"><h3>Terms from your host</h3><p>{booking.terms}</p></div>}{canPay && <div className="booking-payment-action"><Link href={`/pay/${encodeURIComponent(booking.paymentToken)}`} className="button-primary">Review & pay the deposit</Link><p>Pay only after agreeing to the quote and the terms above.</p></div>}{booking.status === "awaiting_payment" && !booking.paymentToken && !booking.paymentCheckFailed && <p className="booking-notice">The host is preparing your payment link. Check this page again shortly.</p>}</section>
    </div>
  );
}
