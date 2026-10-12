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
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const OCCASIONS = ["Family staycation", "Barkada / friends outing", "Birthday / celebration", "General inquiry"];

export default function InquiryForm({ name, phone, messengerUrl, email, instagramUrl, instagram, checkIn, checkOut }) {
  const [smsOpened, setSmsOpened] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle");
  const [copiedMessage, setCopiedMessage] = useState("");
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
      window.dispatchEvent(new CustomEvent("haus26:select-dates", { detail: { date: value, checkoutDate: updatedCheckout, days } }));
      window.dispatchEvent(new CustomEvent("haus26:select-date", { detail: { date: value, checkoutDate: updatedCheckout, days } }));
    }
  }

  function handleCheckoutChange(value, synchronize = true) {
    setCheckout(value);
    if (checkin && value > checkin) {
      const days = calcStayDays(checkin, value);
      if (synchronize) {
        window.dispatchEvent(new CustomEvent("haus26:select-dates", { detail: { date: checkin, checkoutDate: value, days } }));
        window.dispatchEvent(new CustomEvent("haus26:select-date", { detail: { date: checkin, checkoutDate: value, days } }));
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
Guest name: ${fullName.trim() || "[Your name]"}
Purpose: ${occasion}
Check-in: ${checkin || "[Choose a date]"}${checkIn ? ` (${checkIn})` : ""}
Check-out: ${checkout || "[Choose a date]"}${checkOut ? ` (${checkOut})` : ""}
Stay: ${stayDays > 1 ? `${stayDays} days (${stayDays * 24 - 2}-hour stay)` : "22-hour exclusive rental"}
Guests: ${guests || "[Guest count]"}
Rate: ${estimatedRate}${note.trim() ? `\nNotes: ${note.trim()}` : ""}
Could you confirm availability and the final rate? Thank you!`;
Guests: ${guests || "[Guest count]"}
Rate: ${estimatedRate}${note.trim() ? `\nNotes: ${note.trim()}` : ""}
Could you confirm availability and the final rate? Thank you!`;

  async function copyMessageToClipboard() {
    const messageToCopy = generatedMessage;
    setCopyStatus("copying");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(messageToCopy);
      setCopiedMessage(messageToCopy);
      setCopyStatus("success");
    } catch {
      setCopyStatus("error");
      setPreviewOpen(true);
    }
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!hasPhone) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? "&" : "?";
    window.location.href = `sms:${cleanPhone}${separator}body=${encodeURIComponent(generatedMessage)}`;
    setSmsOpened(true);
  }

  const fieldStyle = "mt-2 min-h-12 w-full min-w-0 rounded-md border border-line bg-paper px-3 py-2.5 text-base text-ink transition-colors placeholder:text-muted focus:border-accent focus:outline-2 focus:outline-offset-2 focus:outline-accent";
  const labelStyle = "text-sm font-medium text-ink";
  const secondaryStyle = "inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">Plan your stay</h3>
          <p className="mt-2 text-sm text-muted">Send your preferred dates directly to the host.</p>
        </div>
        <div>
          <p className="text-sm text-muted">{stayDays > 1 ? `${stayDays} days stay` : "22-hour stay"}</p>
          <p className="mt-1 text-xl font-semibold text-ink" aria-live="polite">{estimatedRate}</p>
        </div>
      </div>
      <form onSubmit={onSubmit} className="mt-5 grid min-w-0 gap-x-4 gap-y-5 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor={`${prefix}-name`} className={labelStyle}>Your full name</label>
          <input id={`${prefix}-name`} name="name" required pattern=".*\S.*" title="Enter your full name" autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} className={fieldStyle} />
        </div>
        <div className="min-w-0">
          <label htmlFor={`${prefix}-occasion`} className={labelStyle}>Occasion</label>
          <select id={`${prefix}-occasion`} name="occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} className={fieldStyle}>
            {OCCASIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="min-w-0">
          <label htmlFor={`${prefix}-checkin`} className={labelStyle}>Check-in date</label>
          <input id={`${prefix}-checkin`} name="checkin" type="date" required min={today} value={checkin} onChange={(event) => handleCheckinChange(event.target.value)} className={fieldStyle} />
          {checkIn && <p className="mt-2 text-sm text-muted">{checkIn}</p>}
        </div>
        <div className="min-w-0">
          <label htmlFor={`${prefix}-checkout`} className={labelStyle}>Check-out date</label>
          <input
            id={`${prefix}-checkout`}
            name="checkout"
            type="date"
            readOnly
            value={checkout}
            className={fieldStyle}
          />
          <p className="mt-2 text-sm text-muted">{Number(stayDays) > 1 ? `9:00 AM check-out (${stayDays * 24 - 2}-hour stay)` : (checkOut || "Following day, after your 22-hour stay")}</p>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${prefix}-guests`} className={labelStyle}>Number of guests</label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <input id={`${prefix}-guests`} name="guests" type="number" min="1" step="1" required value={guests} onChange={(event) => setGuests(event.target.value)} className={`${fieldStyle} mt-0 max-w-28`} />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick guest counts">
              {[4, 6, 8, 10].map((count) => <button key={count} type="button" aria-pressed={Number(guests) === count} aria-label={`${count} guests`} onClick={() => setGuests(String(count))} className={`flex h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${Number(guests) === count ? "border-accent bg-accent text-white" : "border-line text-ink hover:bg-surface-elevated"}`}>{count}</button>)}
            </div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted">{estimatedRate === "Ask for a quote" ? "Ask the host for the rate for your group size." : "Rates are subject to change. Your host confirms the final quote."}</p>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <label htmlFor={`${prefix}-note`} className={labelStyle}>Special requests <span className="font-normal text-muted">(optional)</span></label>
          <textarea id={`${prefix}-note`} name="note" rows={2} placeholder="Arrival questions, parking needs, or other requests" value={note} onChange={(event) => setNote(event.target.value)} className={fieldStyle} />
        </div>
        <details className="min-w-0 border-y border-line sm:col-span-2" open={previewOpen} onToggle={(event) => setPreviewOpen(event.currentTarget.open)}>
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Review your inquiry message</summary>
          <div className="pb-4">
            <textarea id={`${prefix}-message`} name="inquiry-message" aria-label="Inquiry message" autoComplete="off" readOnly rows={9} value={generatedMessage} className={`${fieldStyle} resize-y text-sm leading-relaxed`} />
            <button type="button" onClick={copyMessageToClipboard} disabled={copyStatus === "copying"} className={`${secondaryStyle} mt-3 disabled:cursor-wait disabled:opacity-60`}>{copyStatus === "copying" ? "Copying inquiry…" : "Copy inquiry"}</button>
          </div>
        </details>
        <div className="min-w-0 sm:col-span-2">
          <button type="submit" disabled={!hasPhone} className="flex min-h-12 w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Open inquiry in SMS</button>
          {messengerUrl && <a href={messengerUrl} target="_blank" rel="noopener noreferrer" onClick={copyMessageToClipboard} className={`${secondaryStyle} mt-3 w-full`}>Copy inquiry & open Messenger</a>}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={copyMessageToClipboard}
              className={`${secondaryStyle} mt-3 w-full`}
            >
              Copy inquiry & open Instagram (@{instagram || "thehaus.26"})
            </a>
          )}
          {email && (
            <a
              href={`mailto:${email}?subject=${encodeURIComponent(`Inquiry for ${name}`)}&body=${encodeURIComponent(generatedMessage)}`}
              className={`${secondaryStyle} mt-3 w-full`}
            >
              Email inquiry to {email}
            </a>
          )}
          <div className="mt-3 text-sm leading-relaxed text-muted" aria-live="polite" role="status">
            {copyStatus === "success" && copiedMessage === generatedMessage && <p className="mb-2">Inquiry copied. Paste it into your conversation with the host.</p>}
            {copyStatus === "error" && <p className="mb-2 text-ink">Copying was unavailable. Select the inquiry text above and copy it manually.</p>}
            {!hasPhone && <p className="mb-2">SMS inquiries are unavailable. {messengerUrl || instagramUrl ? "Use Messenger or Instagram to contact the host." : "Copy your inquiry to share with the host."}</p>}
            <p>{smsOpened ? "Your messaging app should open with the inquiry filled in. Your host still needs to confirm the booking." : "Your host confirms availability and the final rate. A 50% deposit follows confirmation; no payment is taken through this inquiry."}</p>
          </div>
        </div>
      </form>
    </div>
  );
}
