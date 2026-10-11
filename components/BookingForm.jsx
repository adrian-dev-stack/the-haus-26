"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("-");
}

function followingDay(value) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

function estimateRate(guests) {
  const count = Number(guests);
  if (!Number.isInteger(count) || count < 1) return "Choose guest count";
  if (count <= 4) return "₱5,000";
  if (count === 6) return "₱7,000";
  if (count >= 8 && count <= 10) return "₱8,000";
  return "Ask for a quote";
}

export default function BookingForm({ checkIn, checkOut, headingLevel = 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const prefix = useId();
  const requestId = useRef(null);
  const submittedPayload = useRef(null);
  const requestLocked = useRef(false);
  const successHeading = useRef(null);
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState("4");
  const [today, setToday] = useState("");
  const [pending, setPending] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [livemode, setLivemode] = useState(null);
  const rate = estimateRate(guests);

  useEffect(() => {
    setToday(todayInManila());
    function selectDate(event) { if (!requestLocked.current && typeof event.detail?.date === "string") setDate(event.detail.date); }
    function selectGuests(event) { if (!requestLocked.current && event.detail?.guests) setGuests(String(event.detail.guests)); }
    window.addEventListener("haus26:select-date", selectDate);
    window.addEventListener("haus26:select-guests", selectGuests);
    return () => {
      window.removeEventListener("haus26:select-date", selectDate);
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

  function changeDate(value) {
    setDate(value);
    window.dispatchEvent(new CustomEvent("haus26:select-date", { detail: { date: value } }));
  }

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    requestLocked.current = true;
    setError("");
    try {
      requestId.current ||= crypto.randomUUID();
      submittedPayload.current ||= { requestId: requestId.current, name: form.get("name"), email: form.get("email"), phone: form.get("phone"), date, guests: Number(guests), occasion: form.get("occasion"), notes: form.get("notes"), consent: form.get("consent") === "on" };
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

  if (submitted) return (
    <div className="booking-panel booking-success" role="status">
      <p className="section-label">Request received · {submitted.booking.reference}</p>
      <Heading ref={successHeading} tabIndex={-1}>Your stay is with the host.</Heading>
      <p>Your date and final rate still need approval. No payment has been taken, and the date is not yet reserved.</p>
      {submitted.booking.livemode === false && <p className="booking-notice">Test booking mode. No real reservation or payment is made.</p>}
      <p>Save your private booking link. It shows the host’s quote and your deposit when they are ready.</p>
      <div className="booking-actions">
        <Link href={submitted.guestUrl} className="button-primary">View my booking</Link>
        <button type="button" className="booking-secondary" onClick={copyLink}>Copy private link</button>
      </div>
      {copyMessage && <p aria-live="polite">{copyMessage}</p>}
    </div>
  );

  return (
    <div className="booking-panel">
      <div className="booking-form-heading">
        <div><Heading>Request your stay</Heading><p>The host reviews your date before you pay.</p></div>
        <div className="booking-estimate"><span>Estimated total</span><strong aria-live="polite">{rate}</strong></div>
      </div>
      {livemode === false && <p className="booking-notice">Test booking mode. No real reservation or payment is made.</p>}
      <form onSubmit={submit} className="booking-form" aria-busy={pending}>
        <fieldset disabled={pending || uncertain} className="booking-fieldset">
          <div className="booking-field"><label htmlFor={`${prefix}-date`}>Check-in date</label><input id={`${prefix}-date`} type="date" name="date" required min={today} value={date} onChange={(event) => changeDate(event.target.value)} /><p>{checkIn}</p></div>
          <div className="booking-field"><label htmlFor={`${prefix}-checkout`}>Check-out date</label><input id={`${prefix}-checkout`} type="date" readOnly value={followingDay(date)} /><p>{checkOut || "Following day, after your 22-hour stay"}</p></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-guests`}>Number of guests</label><div className="booking-guest-count"><input id={`${prefix}-guests`} type="number" name="guests" min="1" step="1" required value={guests} onChange={(event) => setGuests(event.target.value)} /><div role="group" aria-label="Quick guest counts">{[4, 6, 8, 10].map((count) => <button key={count} type="button" className="booking-secondary" aria-pressed={Number(guests) === count} onClick={() => setGuests(String(count))}>{count}</button>)}</div></div><p>This estimate covers one 22-hour stay. The host confirms the final rate and whether your group can be accommodated.</p></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-name`}>Your full name</label><input id={`${prefix}-name`} name="name" required minLength={2} maxLength={100} autoComplete="name" placeholder="Your full name" /></div>
          <div className="booking-field"><label htmlFor={`${prefix}-email`}>Email address</label><input id={`${prefix}-email`} name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" /></div>
          <div className="booking-field"><label htmlFor={`${prefix}-phone`}>Mobile number</label><input id={`${prefix}-phone`} name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="09… or +63…" /></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-occasion`}>Occasion <span>(optional)</span></label><select id={`${prefix}-occasion`} name="occasion" defaultValue=""><option value="">Choose an occasion</option>{["Family staycation", "Barkada / friends outing", "Birthday / celebration", "Other"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className="booking-field booking-wide"><label htmlFor={`${prefix}-notes`}>Questions or requests <span>(optional)</span></label><textarea id={`${prefix}-notes`} name="notes" maxLength={1000} rows={3} placeholder="Arrival questions, parking needs, or anything the host should know" /></div>
          <label className="booking-consent booking-wide" htmlFor={`${prefix}-consent`}><input id={`${prefix}-consent`} name="consent" type="checkbox" required /><span>I agree that the host may use these contact details to handle this booking request.</span></label>
        </fieldset>
        {error && <p className="booking-error" role="alert">{error}</p>}
        {uncertain && <p className="booking-form-note">Your original details are kept on this page for a safe retry. Please keep the page open until your request is checked.</p>}
        <button className="button-primary booking-submit" type="submit" disabled={pending}>{pending ? "Sending your request…" : uncertain ? "Retry my original request" : "Request to book"}</button>
        <p className="booking-form-note">A request does not reserve the date. After the host approves your stay and terms, you can pay the 50% deposit through PayMongo.</p>
      </form>
    </div>
  );
}
