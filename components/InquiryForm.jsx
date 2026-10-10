"use client";
import { useState } from "react";

const field = "mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5 text-ink";

export default function InquiryForm({ name, phone, maxGuests }) {
  const [sent, setSent] = useState(false);
  function onSubmit(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const body = `Hi! I'd like to book ${name}.\nName: ${d.name}\nCheck-in: ${d.checkin}\nCheck-out: ${d.checkout}\nGuests: ${d.guests}${d.note ? `\nNote: ${d.note}` : ""}`;
    window.location.href = `sms:${phone}?&body=${encodeURIComponent(body)}`;
    setSent(true);
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2 text-sm font-medium">Your name
        <input name="name" required autoComplete="name" className={field} /></label>
      <label className="text-sm font-medium">Check-in
        <input name="checkin" type="date" required className={field} /></label>
      <label className="text-sm font-medium">Check-out
        <input name="checkout" type="date" required className={field} /></label>
      <label className="text-sm font-medium">Guests
        <input name="guests" type="number" min="1" max={maxGuests || undefined} required className={field} /></label>
      <label className="sm:col-span-2 text-sm font-medium">Note (optional)
        <textarea name="note" rows={3} className={field} /></label>
      <div className="sm:col-span-2">
        <button type="submit" disabled={!phone} className="rounded-md bg-accent px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          Send inquiry by text message
        </button>
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {!phone ? "Add a phone number in lib/property.js to enable this form." : sent ? "Your messaging app should have opened. Nothing is booked until the host confirms." : "Opens your messaging app with the details filled in. Nothing is booked until the host confirms."}
        </p>
      </div>
    </form>
  );
}
