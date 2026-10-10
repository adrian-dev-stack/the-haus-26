"use client";

import { useEffect, useId, useState } from "react";

function getRateEstimate(guestCount) {
  const count = Number(guestCount) || 4;
  if (count <= 4) return "₱5,000";
  if (count <= 6) return "₱7,000";
  if (count <= 10) return "₱8,000";
  return "₱8,000 + per head";
}

const OCCASIONS = [
  "Family Staycation",
  "Barkada / Friends Outing",
  "Birthday / Celebration",
  "General Inquiry",
];

export default function InquiryForm({ name, phone, messengerUrl }) {
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullName, setFullName] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("4");
  const [occasion, setOccasion] = useState("Family Staycation");
  const [note, setNote] = useState("");

  const nameId = useId();
  const checkinId = useId();
  const checkoutId = useId();
  const guestsId = useId();
  const noteId = useId();

  const estimatedRate = getRateEstimate(guests);

  // Auto-set checkout to next day when checkin changes
  function handleCheckinChange(val) {
    setCheckin(val);
    if (val) {
      try {
        const nextDay = new Date(val);
        nextDay.setDate(nextDay.getDate() + 1);
        const yyyy = nextDay.getFullYear();
        const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
        const dd = String(nextDay.getDate()).padStart(2, "0");
        setCheckout(`${yyyy}-${mm}-${dd}`);
      } catch {
        // Fallback
      }
    }
  }

  // Listen for date & guest selections from other components
  useEffect(() => {
    function handleSelectDateEvent(event) {
      if (event.detail && event.detail.date) {
        handleCheckinChange(event.detail.date);
      }
    }

    function handleSelectGuestsEvent(event) {
      if (event.detail && event.detail.guests) {
        setGuests(String(event.detail.guests));
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("haus26:select-date", handleSelectDateEvent);
      window.addEventListener("haus26:select-guests", handleSelectGuestsEvent);
      return () => {
        window.removeEventListener("haus26:select-date", handleSelectDateEvent);
        window.removeEventListener("haus26:select-guests", handleSelectGuestsEvent);
      };
    }
  }, []);

  // Sanitized values for message generation
  const cleanName = fullName.trim();
  const cleanNote = note.trim();

  // Live generated message
  const generatedMessage = `Hi! I would like to inquire about booking ${name}.
Guest name: ${cleanName || "[Your Name]"}
Purpose: ${occasion}
Check-in: ${checkin || "[Select Date]"} (11:00 AM)
Check-out: ${checkout || "[Select Date]"} (Next day 1:00 PM)
Duration: 22-hour exclusive stay
Guests: ${guests} (Estimated rate: ${estimatedRate})
${cleanNote ? `Notes: ${cleanNote}\n` : ""}Is this date open for booking? Thank you!`;

  function copyMessageToClipboard() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(generatedMessage).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(generatedMessage)}`;
    setSent(true);
  }

  function handleMessengerClick() {
    copyMessageToClipboard();
  }

  const fieldStyle =
    "mt-1.5 w-full rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:bg-white focus:outline-none";

  return (
    <div className="rounded-3xl border border-line bg-white p-6 shadow-xs sm:p-8">
      {/* Header with Live Estimate */}
      <div className="flex flex-col gap-2 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
            Reservation Inquiry
          </span>
          <h3 className="mt-0.5 font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
            Plan your stay
          </h3>
          <p className="mt-1 text-xs text-muted">
            Exclusive 22-hour private rental · Live inquiry generator
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-paper px-4 py-2.5 text-left sm:text-right">
          <span className="block text-[10px] uppercase tracking-wider text-muted">
            Estimated Rate
          </span>
          <span className="font-display text-xl font-semibold text-accent">
            {estimatedRate}
          </span>
        </div>
      </div>

      {/* Form Fields */}
      <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
        {/* Full Name */}
        <div className="sm:col-span-2">
          <label htmlFor={nameId} className="text-xs font-medium tracking-wide text-ink">
            Your full name
          </label>
          <input
            id={nameId}
            name="name"
            required
            autoComplete="name"
            placeholder="e.g. Maria Santos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={fieldStyle}
          />
        </div>

        {/* Occasion / Trip Purpose */}
        <div className="sm:col-span-2">
          <span className="text-xs font-medium tracking-wide text-ink">
            Type of booking / occasion
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {OCCASIONS.map((occ) => (
              <button
                key={occ}
                type="button"
                onClick={() => setOccasion(occ)}
                className={`rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
                  occasion === occ
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-paper text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {occ}
              </button>
            ))}
          </div>
        </div>

        {/* Check-in Date */}
        <div>
          <label htmlFor={checkinId} className="text-xs font-medium tracking-wide text-ink">
            Check-in date
          </label>
          <input
            id={checkinId}
            name="checkin"
            type="date"
            required
            value={checkin}
            onChange={(e) => handleCheckinChange(e.target.value)}
            className={fieldStyle}
          />
          <span className="mt-1 block text-[11px] text-muted">Check-in: 11:00 AM to 1:00 PM</span>
        </div>

        {/* Check-out Date */}
        <div>
          <label htmlFor={checkoutId} className="text-xs font-medium tracking-wide text-ink">
            Check-out date
          </label>
          <input
            id={checkoutId}
            name="checkout"
            type="date"
            required
            min={checkin || undefined}
            value={checkout}
            onChange={(e) => setCheckout(e.target.value)}
            className={fieldStyle}
          />
          <span className="mt-1 block text-[11px] text-muted">Check-out: Next day at 1:00 PM</span>
        </div>

        {/* Number of Guests */}
        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <label htmlFor={guestsId} className="text-xs font-medium tracking-wide text-ink">
              Number of guests
            </label>
            <span className="text-[11px] text-muted">
              {Number(guests) <= 4
                ? "Base rate tier (2 to 4 guests)"
                : Number(guests) <= 6
                ? "6 guests tier"
                : Number(guests) <= 10
                ? "8 to 10 guests tier"
                : "11+ guests (additional per-head fee)"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <input
              id={guestsId}
              name="guests"
              type="number"
              min="1"
              max="30"
              required
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className={`${fieldStyle} mt-0`}
            />
            <div className="flex shrink-0 gap-1.5">
              {[4, 6, 8, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setGuests(String(count))}
                  className={`h-10 min-w-10 rounded-xl border px-3 text-xs font-medium transition-colors ${
                    Number(guests) === count
                      ? "border-accent bg-accent text-white"
                      : "border-line bg-paper text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Special Requests / Notes */}
        <div className="sm:col-span-2">
          <label htmlFor={noteId} className="text-xs font-medium tracking-wide text-ink">
            Special requests or notes (optional)
          </label>
          <textarea
            id={noteId}
            name="note"
            rows={2}
            placeholder="e.g. Bringing 2 cars, pet dog, or arrival questions..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={fieldStyle}
          />
        </div>

        {/* LIVE GENERATED MESSAGE PREVIEW */}
        <div className="sm:col-span-2 rounded-2xl border border-accent/20 bg-paper/80 p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
                Live Generated Message Preview
              </span>
            </div>
            <button
              type="button"
              onClick={copyMessageToClipboard}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-paper active:scale-95"
            >
              {copied ? "✓ Copied!" : "Copy text"}
            </button>
          </div>

          <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/90 selection:bg-accent/20">
            {generatedMessage}
          </pre>

          {copied && (
            <p className="mt-2 text-[11px] font-medium text-accent">
              ✓ Message copied to your clipboard. You can paste it directly into Messenger or SMS.
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="sm:col-span-2 pt-1">
          <button
            type="submit"
            disabled={!phone}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#104846] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>Send prefilled inquiry by SMS</span>
            <span aria-hidden="true">→</span>
          </button>

          {messengerUrl && (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleMessengerClick}
              className="mt-3 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-line bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-white active:scale-[0.98]"
            >
              <span>Copy message & chat on Facebook / Messenger</span>
              <span aria-hidden="true">↗</span>
            </a>
          )}

          <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
            {!phone
              ? "Online inquiries are not available yet. Please check back soon."
              : sent
              ? "Your messaging app should have opened with the details prefilled. Nothing is booked until confirmed by the host."
              : "Clicking opens your app with this exact generated message filled in. Nothing is charged or booked until confirmed by the host."}
          </p>
        </div>
      </form>
    </div>
  );
}
