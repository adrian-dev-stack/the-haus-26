"use client";

import { useId, useState } from "react";

function getRateEstimate(guestCount) {
  const count = Number(guestCount) || 4;
  if (count <= 4) return "₱5,000";
  if (count <= 6) return "₱7,000";
  if (count <= 10) return "₱8,000";
  return "₱8,000 + per head";
}

export default function InquiryForm({ name, phone, messengerUrl }) {
  const [sent, setSent] = useState(false);
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("4");
  const [fullName, setFullName] = useState("");
  const [note, setNote] = useState("");

  const nameId = useId();
  const checkinId = useId();
  const checkoutId = useId();
  const guestsId = useId();
  const noteId = useId();

  const estimatedRate = getRateEstimate(guests);

  function onSubmit(e) {
    e.preventDefault();
    const body = `Hi! I would like to inquire about booking ${name}.\nName: ${fullName}\nCheck-in: ${checkin}\nCheck-out: ${checkout}\nGuests: ${guests} (Estimated: ${estimatedRate})\nDuration: 22-hour stay${
      note ? `\nNote: ${note}` : ""
    }`;
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  const fieldStyle =
    "mt-1.5 w-full rounded-lg border border-line bg-paper/60 px-3.5 py-2.5 text-sm text-ink transition-colors focus:border-accent focus:bg-white focus:outline-none";

  return (
    <div className="rounded-2xl border border-line bg-white p-6 shadow-xs sm:p-8">
      {/* Header with Live Estimate */}
      <div className="flex flex-col gap-2 border-b border-line pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
            Reservation Inquiry
          </span>
          <h3 className="mt-0.5 font-display text-2xl font-medium tracking-tight text-ink">
            Plan your stay
          </h3>
          <p className="mt-1 text-xs text-muted">
            Exclusive 22-hour private rental
          </p>
        </div>
        <div className="rounded-xl border border-line bg-paper px-4 py-2.5 text-left sm:text-right">
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
            onChange={(e) => setCheckin(e.target.value)}
            className={fieldStyle}
          />
          <span className="mt-1 block text-[11px] text-muted">Time: 11:00 AM to 1:00 PM</span>
        </div>

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
          <span className="mt-1 block text-[11px] text-muted">Next day (22-hour duration)</span>
        </div>

        <div className="sm:col-span-2">
          <div className="flex items-center justify-between">
            <label htmlFor={guestsId} className="text-xs font-medium tracking-wide text-ink">
              Number of guests
            </label>
            <span className="text-[11px] text-muted">
              {guests <= 4
                ? "Base rate tier (2 to 4 guests)"
                : guests <= 6
                ? "6 guests tier"
                : guests <= 10
                ? "8 to 10 guests tier"
                : "11+ guests (additional fee)"}
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
                  className={`h-10 min-w-10 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
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

        <div className="sm:col-span-2">
          <label htmlFor={noteId} className="text-xs font-medium tracking-wide text-ink">
            Special requests or notes (optional)
          </label>
          <textarea
            id={noteId}
            name="note"
            rows={2}
            placeholder="Any questions about parking, pets, or arrival timing..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={fieldStyle}
          />
        </div>

        {/* Action Controls */}
        <div className="sm:col-span-2 pt-2">
          <button
            type="submit"
            disabled={!phone}
            className="flex w-full min-h-[48px] items-center justify-center rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-all hover:bg-[#104846] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send inquiry by text message (SMS)
          </button>

          {messengerUrl && (
            <a
              href={messengerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full min-h-[48px] items-center justify-center rounded-xl border border-line bg-paper px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-white"
            >
              Or chat directly on Facebook / Messenger
            </a>
          )}

          <p className="mt-3 text-center text-xs text-muted" aria-live="polite">
            {!phone
              ? "Online inquiries are not available yet. Please check back soon."
              : sent
              ? "Your messaging app should have opened. Nothing is booked until the host confirms."
              : "Opens your SMS app with these details prefilled. Nothing is charged or booked until confirmed by the host."}
          </p>
        </div>
      </form>
    </div>
  );
}
