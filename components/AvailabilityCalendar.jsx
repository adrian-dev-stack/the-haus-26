"use client";

import { useEffect, useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatSelectedDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export default function AvailabilityCalendar({
  bookedDates = [], onSelectDate, selectedDate: controlledSelectedDate, phone, messengerUrl, email, headingLevel = 3,
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const [today, setToday] = useState("");
  const [currentMonth, setCurrentMonth] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
  const [todayYear, todayMonth] = today ? today.split("-").map(Number) : [null, null];
  const [internalSelectedDate, setInternalSelectedDate] = useState("");
  const [savedDates, setSavedDates] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const activeSelectedDate = controlledSelectedDate ?? internalSelectedDate;
  const unavailableDates = new Set([...bookedDates, ...savedDates]);
  const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
  const hasPhone = /\d/.test(cleanPhone);

  useEffect(() => {
    const currentDate = getToday();
    const [year, month] = currentDate.split("-").map(Number);
    setToday(currentDate);
    setCurrentYear(year);
    setCurrentMonth(month - 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAvailability() {
      try {
        const response = await fetch("/api/bookings/availability", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.data?.bookedDates)) throw new Error("Availability unavailable");
        setSavedDates(result.data.bookedDates.filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)));
        setAvailabilityStatus("ready");
      } catch (failure) {
        if (failure.name !== "AbortError") setAvailabilityStatus("error");
      }
    }
    loadAvailability();
    window.addEventListener("focus", loadAvailability);
    return () => { controller.abort(); window.removeEventListener("focus", loadAvailability); };
  }, []);

  useEffect(() => {
    function synchronizeDate(event) {
      const date = event.detail?.date;
      if (!date) {
        setInternalSelectedDate("");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const [year, month] = date.split("-").map(Number);
      setInternalSelectedDate(date);
      setCurrentYear(year);
      setCurrentMonth(month - 1);
    }
    window.addEventListener("haus26:select-date", synchronizeDate);
    return () => window.removeEventListener("haus26:select-date", synchronizeDate);
  }, []);

  function changeMonth(direction) {
    const next = new Date(currentYear, currentMonth + direction, 1);
    setCurrentMonth(next.getMonth());
    setCurrentYear(next.getFullYear());
  }

  function handleSelectDate(date) {
    setInternalSelectedDate(date);
    onSelectDate?.(date);
    window.dispatchEvent(new CustomEvent("haus26:select-date", { detail: { date } }));
  }

  if (!today || currentMonth === null || currentYear === null) {
    return (
      <div className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <Heading className="availability-heading">Choose your check-in</Heading>
        <p className="mt-2 text-sm leading-relaxed text-muted">Your host confirms availability before a booking is made.</p>
        <p className="mt-6 min-h-64 text-sm text-muted" role="status">Loading the date calendar…</p>
      </div>
    );
  }

  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarDays = [
    ...Array(firstDayIndex).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
  const isPrevDisabled = currentYear < todayYear ||
    (currentYear === todayYear && currentMonth <= todayMonth - 1);
  const navigationStyle = "flex h-11 w-11 items-center justify-center rounded-md border border-line text-ink transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const linkStyle = "inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6">
      <Heading className="availability-heading">Choose your check-in</Heading>
      <p className="mt-2 text-sm leading-relaxed text-muted">Your host confirms the date and quote before you pay.</p>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-lg font-semibold text-ink" aria-live="polite">{MONTH_NAMES[currentMonth]} {currentYear}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => changeMonth(-1)} disabled={isPrevDisabled} className={navigationStyle} aria-label="Previous month">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => changeMonth(1)} className={navigationStyle} aria-label="Next month">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted min-[400px]:hidden">Swipe the calendar sideways if needed.</p>
      <div className="mt-5 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" tabIndex={0} role="region" aria-label="Date calendar, scroll sideways on narrow screens">
        <div className="min-w-[308px]">
          <div className="grid grid-cols-7 text-center text-sm text-muted" aria-hidden="true">
            {DAYS_OF_WEEK.map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1" role="group" aria-label={`${MONTH_NAMES[currentMonth]} ${currentYear} booking dates`}>
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12" aria-hidden="true" />;
              const date = formatDateString(currentYear, currentMonth, day);
              const isPast = date <= today;
              const isBooked = unavailableDates.has(date);
              const isSelected = activeSelectedDate === date;
              const status = isBooked ? "Unavailable" : isPast ? (date === today ? "Same-day booking unavailable" : "Past date") : isSelected ? "Selected" : "Select to request a stay";
              const style = isSelected ? "bg-accent font-semibold text-white" : isPast || isBooked
                ? `cursor-not-allowed text-muted ${isBooked ? "line-through" : ""}` : "text-ink hover:bg-surface-elevated";
              return (
                <button key={date} type="button" disabled={isPast || isBooked} aria-pressed={isSelected} aria-label={`${MONTH_NAMES[currentMonth]} ${day}, ${currentYear}, ${status}`} onClick={() => handleSelectDate(date)} className={`flex h-12 min-w-11 items-center justify-center rounded-md text-base transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${style}`}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
        <p>22-hour exclusive stays (11:00 AM check-in to 9:00 AM check-out next day). Same-day bookings are unavailable to allow our housekeeper to prepare the villa.</p>
        {unavailableDates.size > 0 && <p className="mt-1">Crossed-out dates are reserved or awaiting a deposit.</p>}
        <p className="mt-1" role="status">{availabilityStatus === "loading" ? "Checking the latest dates…" : availabilityStatus === "error" ? "Latest availability could not be loaded. Your host will check your requested date." : "Dates checked. The host confirms each request."}</p>
      </div>
      {activeSelectedDate ? (
        <div className="mt-5 border-t border-line pt-5">
          <p className="text-sm text-muted">Your preferred check-in (11:00 AM)</p>
          <p className="mt-1 text-lg font-semibold text-ink" aria-live="polite">{formatSelectedDate(activeSelectedDate)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#inquire" className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Request this stay</a>
            {hasPhone && <a href={`sms:${cleanPhone}?body=${encodeURIComponent(`Hi! I would like to inquire about The HauS 26 for check-in on ${activeSelectedDate} (11:00 AM check-in, 9:00 AM checkout next day). Could you confirm availability?`)}`} className={linkStyle}>Ask by SMS</a>}
            {messengerUrl && <a href={messengerUrl} target="_blank" rel="noopener noreferrer" className={linkStyle}>Open Messenger</a>}
            {email && <a href={`mailto:${email}?subject=${encodeURIComponent(`Inquiry for check-in on ${activeSelectedDate}`)}&body=${encodeURIComponent(`Hi! I would like to inquire about The HauS 26 for check-in on ${activeSelectedDate} (11:00 AM check-in, 9:00 AM checkout next day). Could you confirm availability?`)}`} className={linkStyle}>Ask by Email</a>}
          </div>
        </div>
      ) : <p className="mt-5 text-sm text-muted">Choose a date above to fill in your booking request.</p>}
    </div>
  );
}
