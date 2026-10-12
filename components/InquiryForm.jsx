"use client";

import { useEffect, useId, useState } from "react";

function getRateEstimate(guestCount, days = 1) {
  const count = Number(guestCount);
  const stayDays = Math.max(1, Number(days) || 1);
  if (!Number.isInteger(count) || count < 1) return "Choose guest count";
  let daily;
  if (count <= 4) daily = 5000;
  else if (count <= 6) daily = 6000;
  else if (count <= 10) daily = 8000;
  else daily = 8000 + (count - 10) * 500;
  const total = daily * stayDays;
  return `₱${total.toLocaleString()}${stayDays > 1 ? ` (${stayDays} days)` : ""}`;
}

function nextDate(value, daysToAdd = 1) {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + Math.max(1, Number(daysToAdd) || 1));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function calcStayDays(start, end) {
  if (!start || !end || end <= start) return 1;
  const d1 = new Date(`${start}T12:00:00Z`);
  const d2 = new Date(`${end}T12:00:00Z`);
  return Math.max(1, Math.round((d2 - d1) / (24 * 60 * 60 * 1000)));
}

function getToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const OCCASIONS = [
  "Family staycation",
  "Barkada / friends outing",
  "Birthday / celebration",
  "General inquiry & custom arrangements",
];

export default function InquiryForm({
  name = "The HauS 26",
  phone,
  messengerUrl,
  email,
  instagramUrl,
  instagram,
  checkIn = "11:00 AM",
  checkOut = "9:00 AM next day",
}) {
  const [copyStatus, setCopyStatus] = useState("idle");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [guests, setGuests] = useState("4");
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [note, setNote] = useState("");
  const [today, setToday] = useState("");
  const prefix = useId();

  const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
  const hasPhone = /\d/.test(cleanPhone);
  const stayDays = calcStayDays(checkin, checkout);
  const estimatedRate = getRateEstimate(guests, stayDays);

  useEffect(() => {
    setToday(nextDate(getToday()));
  }, []);

  function handleCheckinChange(value, synchronize = true) {
    setCheckin(value);
    const updatedCheckout = checkout && checkout > value ? checkout : nextDate(value, 1);
    setCheckout(updatedCheckout);
    const days = calcStayDays(value, updatedCheckout);
    if (synchronize) {
      window.dispatchEvent(
        new CustomEvent("haus26:select-dates", {
          detail: { date: value, checkoutDate: updatedCheckout, days },
        })
      );
      window.dispatchEvent(
        new CustomEvent("haus26:select-date", {
          detail: { date: value, checkoutDate: updatedCheckout, days },
        })
      );
    }
  }

  function handleCheckoutChange(value, synchronize = true) {
    setCheckout(value);
    if (checkin && value > checkin) {
      const days = calcStayDays(checkin, value);
      if (synchronize) {
        window.dispatchEvent(
          new CustomEvent("haus26:select-dates", {
            detail: { date: checkin, checkoutDate: value, days },
          })
        );
        window.dispatchEvent(
          new CustomEvent("haus26:select-date", {
            detail: { date: checkin, checkoutDate: value, days },
          })
        );
      }
    }
  }

  useEffect(() => {
    function handleSelectDate(event) {
      const inDate = event.detail?.date || event.detail?.checkin;
      const outDate = event.detail?.checkoutDate || event.detail?.checkout;
      if (typeof inDate === "string") {
        setCheckin(inDate);
        if (typeof outDate === "string" && outDate > inDate) {
          setCheckout(outDate);
        } else if (event.detail?.days && Number(event.detail.days) >= 1) {
          setCheckout(nextDate(inDate, Number(event.detail.days)));
        } else {
          setCheckout(nextDate(inDate, 1));
        }
      }
    }

    function handleSelectGuests(event) {
      const count = event.detail?.guests;
      if (count) setGuests(String(count));
    }

    window.addEventListener("haus26:select-date", handleSelectDate);
    window.addEventListener("haus26:select-dates", handleSelectDate);
    window.addEventListener("haus26:select-guests", handleSelectGuests);

    return () => {
      window.removeEventListener("haus26:select-date", handleSelectDate);
      window.removeEventListener("haus26:select-dates", handleSelectDate);
      window.removeEventListener("haus26:select-guests", handleSelectGuests);
    };
  }, []);

  const generatedMessage = `Hi! I would like to inquire about booking ${name}.
- Guest name: ${fullName.trim() || "[Guest name]"}
- Group size: ${guests || "4"} guests
- Purpose: ${occasion}
- Check-in: ${checkin || "[Choose date]"} (${checkIn})
- Check-out: ${checkout || "[Choose date]"} (${checkOut})
- Stay: ${stayDays > 1 ? `${stayDays} days` : "22-hour private rental"}
- Estimated rate: ${estimatedRate}${note.trim() ? `\n- Notes / Questions: ${note.trim()}` : ""}

Could you confirm availability and help us arrange our stay? Thank you!`;

  async function copyMessageToClipboard() {
    setCopyStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(generatedMessage);
      setCopyStatus("success");
      setTimeout(() => setCopyStatus("idle"), 4000);
      return true;
    } catch {
      setCopyStatus("error");
      setPreviewOpen(true);
      return false;
    }
  }

  async function handleMessengerClick() {
    await copyMessageToClipboard();
    if (messengerUrl) {
      window.open(messengerUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function handleInstagramClick() {
    await copyMessageToClipboard();
    if (instagramUrl) {
      window.open(instagramUrl, "_blank", "noopener,noreferrer");
    }
  }

  function handleSmsClick() {
    if (!hasPhone) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(generatedMessage)}`;
  }

  return (
    <div className="min-w-0 rounded-2xl border border-divider bg-surface p-6 shadow-md sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-divider pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-accent">
            Direct Host Inquiry
          </span>
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
            Ask the Host a Question
          </h3>
          <p className="mt-1 text-sm text-muted">
            Have questions before booking? Send your details directly to the host on Messenger.
          </p>
        </div>
        <div className="rounded-xl border border-divider bg-paper px-4 py-2.5 text-right">
          <p className="text-xs font-medium text-muted">
            {stayDays > 1 ? `${stayDays} Days Stay` : "22-Hour Private Stay"}
          </p>
          <p className="mt-0.5 text-lg font-bold text-accent" aria-live="polite">
            {estimatedRate}
          </p>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleMessengerClick(); }} className="mt-6 grid min-w-0 gap-x-5 gap-y-5 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${prefix}-name`} className="block text-sm font-semibold text-ink">
            Your Full Name
          </label>
          <input
            id={`${prefix}-name`}
            name="name"
            required
            pattern=".*\\S.*"
            title="Enter your full name"
            autoComplete="name"
            placeholder="e.g. Maria Santos"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="min-w-0">
          <label htmlFor={`${prefix}-occasion`} className="block text-sm font-semibold text-ink">
            Occasion / Purpose
          </label>
          <select
            id={`${prefix}-occasion`}
            name="occasion"
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {OCCASIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label htmlFor={`${prefix}-checkin`} className="block text-sm font-semibold text-ink">
            Check-in Date
          </label>
          <input
            id={`${prefix}-checkin`}
            name="checkin"
            type="date"
            required
            min={today}
            value={checkin}
            onChange={(e) => handleCheckinChange(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {checkIn && <p className="mt-1.5 text-xs text-muted">Arrival from {checkIn}</p>}
        </div>

        <div className="min-w-0">
          <label htmlFor={`${prefix}-checkout`} className="block text-sm font-semibold text-ink">
            Check-out Date
          </label>
          <input
            id={`${prefix}-checkout`}
            name="checkout"
            type="date"
            required
            min={checkin ? nextDate(checkin, 1) : today}
            value={checkout}
            onChange={(e) => handleCheckoutChange(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base text-ink transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          <p className="mt-1.5 text-xs text-muted">
            {Number(stayDays) > 1
              ? `Check-out at 9:00 AM (${stayDays * 24 - 2}-hour stay)`
              : `Check-out at ${checkOut || "9:00 AM next day"}`}
          </p>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${prefix}-guests`} className="block text-sm font-semibold text-ink">
            Number of Guests
          </label>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <input
              id={`${prefix}-guests`}
              name="guests"
              type="number"
              min="1"
              step="1"
              required
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              className="min-h-12 w-28 rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick guest counts">
              {[4, 6, 8, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={Number(guests) === count}
                  aria-label={`${count} guests`}
                  onClick={() => setGuests(String(count))}
                  className={`flex h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all ${
                    Number(guests) === count
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-divider bg-surface text-ink hover:bg-surface-elevated"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Rates: ₱5,000 (up to 4 guests), ₱6,000 (5-6), ₱8,000 (7-10), ₱8,000 + ₱500/extra guest (11+).
          </p>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${prefix}-note`} className="block text-sm font-semibold text-ink">
            Special Requests or Questions <span className="font-normal text-muted">(Optional)</span>
          </label>
          <textarea
            id={`${prefix}-note`}
            name="note"
            rows={2}
            placeholder="Early check-in inquiry, parking for extra vehicle, pet details, or custom requests"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-divider bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Message Preview Box */}
        <div className="min-w-0 sm:col-span-2">
          <div className="rounded-xl border border-divider bg-paper/60 p-4">
            <div className="flex items-center justify-between gap-2 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                Inquiry Message Preview
              </span>
              <button
                type="button"
                onClick={copyMessageToClipboard}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                {copyStatus === "success" ? "✓ Copied to clipboard!" : "Copy message"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink/80">
              {generatedMessage}
            </pre>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="min-w-0 sm:col-span-2 space-y-2.5">
          {messengerUrl && (
            <button
              type="button"
              onClick={handleMessengerClick}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-accent-hover hover:-translate-y-0.5"
            >
              <span>💬</span>
              <span>Copy Inquiry & Open Facebook Messenger</span>
            </button>
          )}

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {instagramUrl && (
              <button
                type="button"
                onClick={handleInstagramClick}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-elevated"
              >
                <span>📸</span>
                <span>Open Instagram (@{instagram || "thehaus.26"})</span>
              </button>
            )}

            {hasPhone && (
              <button
                type="button"
                onClick={handleSmsClick}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:bg-surface-elevated"
              >
                <span>📱</span>
                <span>Send via SMS / Text</span>
              </button>
            )}
          </div>

          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`Inquiry for ${name}`)}&body=${encodeURIComponent(generatedMessage)}`}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-divider bg-surface px-4 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-elevated hover:text-ink"
            >
              <span>✉️</span>
              <span>Or email inquiry to {email}</span>
            </a>
          )}

          <div className="pt-2 text-center text-xs text-muted">
            {copyStatus === "success" && (
              <p className="font-semibold text-accent">
                ✓ Message copied! Paste it into your chat with the host.
              </p>
            )}
            <p className="mt-1">
              Your host confirms final availability and quote. 50% deposit required via GCash or Card to lock in dates.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
