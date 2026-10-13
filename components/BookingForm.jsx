"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

function calculateCheckoutDate(value, days = 1) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(1, Number(days) || 1));
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function generateSafeUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try { return crypto.randomUUID(); } catch {}
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error("Secure booking is unavailable in this browser. Please use the HTTPS website in a current browser or contact the host.");
}

function estimateRate(guests, days = 1) {
  const count = Number(guests);
  const stayDays = Math.max(1, Number(days) || 1);
  if (!Number.isInteger(count) || count < 1) return { total: "Choose guest count", deposit: "", daily: "" };
  let dailyPesos;
  if (count <= 4) dailyPesos = 5000;
  else if (count <= 6) dailyPesos = 6000;
  else if (count <= 10) dailyPesos = 8000;
  else dailyPesos = 8000 + (count - 10) * 500;
  const totalPesos = dailyPesos * stayDays;
  return {
    daily: `₱${dailyPesos.toLocaleString()}/day`,
    total: `₱${totalPesos.toLocaleString()}`,
    deposit: `₱${(totalPesos / 2).toLocaleString()}`,
    days: stayDays,
  };
}

export default function BookingForm({ checkIn, checkOut, maxGuests, bookingTerms, headingLevel = 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const prefix = useId();
  const requestId = useRef(null);
  const submittedPayload = useRef(null);
  const requestLocked = useRef(false);
  const successHeading = useRef(null);
  const [date, setDate] = useState("");
  const [days, setDays] = useState("1");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [guests, setGuests] = useState("4");
  const [today, setToday] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [livemode, setLivemode] = useState(null);
  const rate = estimateRate(guests, days);
  const instantBookingReady = Number.isSafeInteger(maxGuests) && maxGuests > 0 && Boolean(bookingTerms?.trim());

  useEffect(() => {
    setToday(calculateCheckoutDate(todayInManila(), 1));
    function selectDate(event) {
      if (requestLocked.current) return;
      if (typeof event.detail?.date === "string") setDate(event.detail.date);
      if (typeof event.detail?.checkoutDate === "string") {
        setCheckoutDate(event.detail.checkoutDate);
      } else if (!event.detail?.date) {
        setCheckoutDate("");
      }
      if (typeof event.detail?.pendingCheckout === "boolean") {
        setPendingCheckout(event.detail.pendingCheckout);
      } else {
        setPendingCheckout(false);
      }
      if (event.detail?.days && Number(event.detail.days) >= 1) {
        setDays(String(event.detail.days));
      }
    }
    function selectGuests(event) { if (!requestLocked.current && event.detail?.guests) setGuests(String(event.detail.guests)); }
    window.addEventListener("haus26:select-date", selectDate);
    window.addEventListener("haus26:select-dates", selectDate);
    window.addEventListener("haus26:select-guests", selectGuests);
    return () => {
      window.removeEventListener("haus26:select-date", selectDate);
      window.removeEventListener("haus26:select-dates", selectDate);
      window.removeEventListener("haus26:select-guests", selectGuests);
    };
  }, []);

  useEffect(() => { if (submitted) successHeading.current?.focus(); }, [submitted]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/bookings/availability", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (typeof result?.data?.livemode === "boolean") setLivemode(result.data.livemode); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    if (!date) {
      setError("Please select your stay dates on the availability calendar above first.");
      const calendarEl = document.getElementById("calendar") || document.getElementById("availability");
      if (calendarEl) calendarEl.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (date <= todayInManila()) {
      setError("Same-day bookings cannot be accommodated. Please choose tomorrow or a future date to give our housekeeper time to ready the property.");
      return;
    }
    if (maxGuests && Number(guests) > maxGuests) {
      setError(`Maximum capacity for this villa is ${maxGuests} guests. Please contact the host for larger groups.`);
      return;
    }
    const form = new FormData(event.currentTarget);
    setPending(true);
    requestLocked.current = true;
    setError("");
    try {
      requestId.current ||= generateSafeUUID();
      submittedPayload.current ||= {
        requestId: requestId.current,
        name: form.get("name"),
        email: form.get("email"),
        phone: form.get("phone"),
        date,
        days: Math.max(1, Number(days) || 1),
        guests: Number(guests),
        occasion: form.get("occasion"),
        notes: form.get("notes"),
        consent: form.get("consent") === "on",
      };
      const response = await fetch("/api/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submittedPayload.current),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && result.error?.code !== "request-conflict") {
          requestId.current = null; submittedPayload.current = null; requestLocked.current = false; setUncertain(false);
        }
        throw new Error(result.error?.code === "request-conflict" ? "A request already exists with this reference. Contact the host to recover your private link before sending another request." : result.error?.message || "Your request could not be saved. Please try again.");
      }
      const guestUrl = result.data?.guestUrl;
      const path = new URL(guestUrl, window.location.origin);
      if (path.origin !== window.location.origin || !path.pathname.startsWith("/book/")) throw new Error("Your request was saved, but its private link could not be opened. Please contact the host.");
      setSubmitted({ booking: result.data.booking, guestUrl: path.pathname });
    } catch (failure) {
      if (submittedPayload.current) { setUncertain(true); requestLocked.current = true; }
      else { requestLocked.current = false; }
      setError(failure instanceof TypeError ? "We could not reach the booking service. Keep this page open and try again; your request will not be sent twice." : failure.message);
    } finally { setPending(false); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(new URL(submitted.guestUrl, window.location.origin).href);
      setCopyMessage("Private booking link copied.");
    } catch { setCopyMessage("Open your booking below, then save its address from your browser."); }
  }

  if (submitted) {
    const isApproved = submitted.booking?.status === "awaiting_payment" && submitted.booking?.paymentToken;
    const stayDays = submitted.booking?.days || 1;
    return (
      <div className="booking-panel booking-success" role="status">
        <p className="section-label">{submitted.booking.status === "awaiting_payment" ? "Date Held" : "Request Received"} · {submitted.booking.reference}</p>
        <Heading ref={successHeading} tabIndex={-1}>{submitted.booking.status === "awaiting_payment" ? "Your dates are held." : "Your booking request is saved."}</Heading>
        <p>
          {submitted.booking.status === "awaiting_payment"
            ? `Your ${stayDays}-day stay (${submitted.booking.date} to ${submitted.booking.endDate || calculateCheckoutDate(submitted.booking.date, stayDays)}) is held for 30 minutes. Complete your 50% deposit to lock in your reservation.`
            : `Open your private booking link to check the latest status for your ${stayDays}-day stay (${submitted.booking.date} to ${submitted.booking.endDate || calculateCheckoutDate(submitted.booking.date, stayDays)}).`}
        </p>
        {submitted.booking.status === "awaiting_payment" && !isApproved && <p className="booking-notice">Your quote is saved, but checkout is not ready. Open your booking details and contact the host before starting another request.</p>}
        {submitted.booking.livemode === false && <p className="booking-notice">Test booking mode. No real reservation or payment is made.</p>}
        <div className="booking-actions">
          {isApproved && <Link href={`/pay/${encodeURIComponent(submitted.booking.paymentToken)}`} className="button-primary">Pay 50% Deposit (GCash / Card)</Link>}
          <Link href={submitted.guestUrl} className={isApproved ? "booking-secondary" : "button-primary"}>View booking details</Link>
          <button type="button" className="booking-secondary" onClick={copyLink}>Copy private link</button>
        </div>
        {copyMessage && <p aria-live="polite">{copyMessage}</p>}
      </div>
    );
  }

  return (
    <div className="booking-panel">
      <div className="booking-form-heading">
        <div>
          <Heading>Reserve your stay</Heading>
          <p>{instantBookingReady ? "Instant booking with 30-minute hold for deposit." : "Submit your request for host review and quote confirmation."}</p>
        </div>
        <div className="booking-estimate">
          <span>Total (50% Deposit)</span>
          <strong aria-live="polite">
            {rate.total} {rate.deposit ? `· Deposit: ${rate.deposit}` : ""}
            {Number(days) > 1 ? ` (${rate.daily} × ${days} days)` : ""}
          </strong>
        </div>
      </div>
      {livemode === false && <p className="booking-notice">Test booking mode. No real reservation or payment is made.</p>}
      <form onSubmit={submit} className="booking-form" aria-busy={pending}>
        <fieldset disabled={pending || uncertain} className="booking-fieldset">
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="days" value={days} />
          <input type="hidden" name="checkout" value={checkoutDate || calculateCheckoutDate(date, days)} />

          <div className="booking-field booking-wide">
            <label>Selected stay dates</label>
            {date ? (
              <div className="mt-2 rounded-lg border border-line bg-surface-elevated p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    {pendingCheckout
                      ? "Check-in selected · Choose check-out on calendar"
                      : Number(days) === 1
                      ? "1 day (22-hour stay)"
                      : `${days} days (${Number(days) * 24 - 2}-hour stay)`}
                  </span>
                  <a href="#calendar" className="text-xs text-accent hover:underline font-medium">
                    Change dates on calendar
                  </a>
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-sm">
                  <div className="rounded-md border border-line bg-surface p-2.5">
                    <span className="text-xs text-muted block uppercase tracking-wider font-medium">Check-in</span>
                    <strong className="text-ink font-semibold text-base block mt-0.5">{formatDisplayDate(date)}</strong>
                    <span className="text-xs text-muted block mt-0.5">{checkIn || "11:00 AM"}</span>
                  </div>
                  <div className="rounded-md border border-line bg-surface p-2.5">
                    <span className="text-xs text-muted block uppercase tracking-wider font-medium">Check-out</span>
                    <strong className="text-ink font-semibold text-base block mt-0.5">
                      {formatDisplayDate(checkoutDate || calculateCheckoutDate(date, days))}
                    </strong>
                    <span className="text-xs text-muted block mt-0.5">
                      {pendingCheckout
                        ? "Select check-out date on calendar (or default 9:00 AM next day)"
                        : Number(days) === 1
                        ? "9:00 AM next day (22-hour stay)"
                        : `9:00 AM on departure day (${Number(days) * 24 - 2}-hour stay)`}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-line bg-surface-elevated/60 p-4 text-center">
                <p className="text-sm font-semibold text-ink">Choose your stay dates on the calendar</p>
                <p className="mt-1 text-xs text-muted">Click your check-in date and your check-out date on the availability calendar above.</p>
                <a href="#calendar" className="inline-flex items-center gap-1 mt-3 rounded-md border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface transition-colors">
                  Select dates on calendar ↑
                </a>
              </div>
            )}
          </div>

          <div className="booking-field booking-wide">
            <label htmlFor={`${prefix}-guests`}>Number of guests</label>
            <div className="booking-guest-count">
              <input
                id={`${prefix}-guests`}
                type="number"
                name="guests"
                min="1"
                max={maxGuests || undefined}
                step="1"
                required
                value={guests}
                onChange={(event) => setGuests(event.target.value)}
              />
              <div role="group" aria-label="Quick guest counts">
                {[4, 6, 8, 10].filter((count) => !maxGuests || count <= maxGuests).map((count) => (
                  <button
                    key={count}
                    type="button"
                    className="booking-secondary"
                    aria-pressed={Number(guests) === count}
                    onClick={() => setGuests(String(count))}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
            <p>
              {maxGuests ? `Property capacity: up to ${maxGuests} guests.` : "Covers private stay for your group."}{" "}
              {instantBookingReady
                ? "Submitting starts a 30-minute hold for deposit payment."
                : "Dates are held only after approval by host."}
            </p>
          </div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-name`}>Your full name</label><input id={`${prefix}-name`} name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" /></div>
          <div className="booking-field"><label htmlFor={`${prefix}-email`}>Email address</label><input id={`${prefix}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></div>
          <div className="booking-field"><label htmlFor={`${prefix}-phone`}>Mobile number</label><input id={`${prefix}-phone`} name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="09… or +63…" /></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-occasion`}>Occasion <span>(optional)</span></label><select id={`${prefix}-occasion`} name="occasion" defaultValue=""><option value="">Choose an occasion</option>{["Family staycation", "Barkada / friends outing", "Birthday / celebration", "Other"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-notes`}>Questions or requests <span>(optional)</span></label><textarea id={`${prefix}-notes`} name="notes" maxLength={1000} rows={3} placeholder="Arrival questions, parking needs, or anything the host should know" /></div>
          <label className="booking-consent booking-wide" htmlFor={`${prefix}-consent`}><input id={`${prefix}-consent`} name="consent" type="checkbox" required /><span>I agree that the host may use these contact details to handle this booking request and send booking confirmations by email and SMS.</span></label>
        </fieldset>
        {error && <p className="booking-error" role="alert">{error}</p>}
        {uncertain && <p className="booking-form-note">Your original details are kept on this page for a safe retry. Please keep the page open until your request is checked.</p>}
        <button className="button-primary booking-submit" type="submit" disabled={pending}>{pending ? "Sending your request…" : uncertain ? "Retry my original request" : "Request to book"}</button>
        <p className="booking-form-note">
          {instantBookingReady
            ? "Submitting your request starts a 30-minute hold. Complete the 50% deposit via PayMongo (GCash / Card) to lock in your reservation."
            : "Selecting dates or submitting does not reserve them. Your host confirms group capacity and quote before holding the date."}
        </p>
      </form>
    </div>
  );
}
