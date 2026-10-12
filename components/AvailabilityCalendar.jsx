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
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

function addDays(dateStr, numDays = 1) {
  if (!dateStr) return "";
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(1, Number(numDays) || 1));
  return Number.isNaN(date.valueOf()) ? "" : date.toISOString().slice(0, 10);
}

export default function AvailabilityCalendar({
  bookedDates = [],
  onSelectDate,
  onSelectDates,
  selectedDate: controlledSelectedDate,
  phone,
  messengerUrl,
  email,
  headingLevel = 3,
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const [today, setToday] = useState(getToday);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const parts = getToday().split("-").map(Number);
    return parts[1] - 1;
  });
  const [currentYear, setCurrentYear] = useState(() => {
    const parts = getToday().split("-").map(Number);
    return parts[0];
  });
  const [todayYear, todayMonth] = today ? today.split("-").map(Number) : [null, null];

  const [checkInDate, setCheckInDate] = useState("");
  const [stayDays, setStayDays] = useState(1);
  const [savedDates, setSavedDates] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");

  const unavailableDates = new Set([...bookedDates, ...savedDates]);
  const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
  const hasPhone = /\d/.test(cleanPhone);

  const activeCheckIn = controlledSelectedDate ?? checkInDate;

  useEffect(() => {
    const currentDate = getToday();
    setToday(currentDate);
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
    function synchronizeDates(event) {
      const inDate = event.detail?.date || event.detail?.checkin;
      const daysCount = event.detail?.days;

      if (!inDate) {
        setCheckInDate("");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inDate)) return;

      setCheckInDate(inDate);
      if (daysCount && Number(daysCount) >= 1) {
        setStayDays(Number(daysCount));
      }

      const [year, month] = inDate.split("-").map(Number);
      setCurrentYear(year);
      setCurrentMonth(month - 1);
    }

    window.addEventListener("haus26:select-date", synchronizeDates);
    window.addEventListener("haus26:select-dates", synchronizeDates);
    return () => {
      window.removeEventListener("haus26:select-date", synchronizeDates);
      window.removeEventListener("haus26:select-dates", synchronizeDates);
    };
  }, []);

  function changeMonth(direction) {
    const next = new Date(currentYear, currentMonth + direction, 1);
    setCurrentMonth(next.getMonth());
    setCurrentYear(next.getFullYear());
  }

  function handleSelectDate(date) {
    if (unavailableDates.has(date)) return;
    setCheckInDate(date);
    onSelectDate?.(date);
    const checkoutDate = addDays(date, stayDays);
    onSelectDates?.({ checkIn: date, checkOut: checkoutDate, days: stayDays });
    window.dispatchEvent(new CustomEvent("haus26:select-dates", {
      detail: { date, checkin: date, checkoutDate, checkout: checkoutDate, days: stayDays }
    }));
    window.dispatchEvent(new CustomEvent("haus26:select-date", {
      detail: { date, checkoutDate, days: stayDays }
    }));
  }

  function resetDate() {
    setCheckInDate("");
    window.dispatchEvent(new CustomEvent("haus26:select-dates", {
      detail: { date: "", checkoutDate: "", days: stayDays }
    }));
    window.dispatchEvent(new CustomEvent("haus26:select-date", {
      detail: { date: "", checkoutDate: "", days: stayDays }
    }));
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

  const checkoutDateStr = activeCheckIn ? addDays(activeCheckIn, stayDays) : "";

  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading className="availability-heading">Choose your check-in</Heading>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Select your check-in date (11:00 AM). Stays are 22 hours per day (check-out 9:00 AM next day).
          </p>
        </div>
        {activeCheckIn && (
          <button
            type="button"
            onClick={resetDate}
            className="text-xs font-medium text-muted hover:text-ink underline self-center"
          >
            Clear date
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="text-lg font-semibold text-ink" aria-live="polite">{MONTH_NAMES[currentMonth]} {currentYear}</p>
          <p className="text-xs text-muted">Click an available date to set check-in</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => changeMonth(-1)} disabled={isPrevDisabled} className={navigationStyle} aria-label="Previous month">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => changeMonth(1)} className={navigationStyle} aria-label="Next month">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" tabIndex={0} role="region" aria-label="Date calendar">
        <div className="min-w-[308px]">
          <div className="grid grid-cols-7 text-center text-sm text-muted" aria-hidden="true">
            {DAYS_OF_WEEK.map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div
            className="grid grid-cols-7 gap-y-1"
            role="group"
            aria-label={`${MONTH_NAMES[currentMonth]} ${currentYear} booking dates`}
          >
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12" aria-hidden="true" />;
              const date = formatDateString(currentYear, currentMonth, day);
              const isPast = date <= today;
              const isBooked = unavailableDates.has(date);
              const isCheckIn = activeCheckIn === date;
              const isInStayRange = Boolean(
                activeCheckIn &&
                stayDays > 1 &&
                date >= activeCheckIn &&
                date < checkoutDateStr
              );

              const isDisabled = isPast || isBooked;

              let style = "";
              let rounded = "rounded-md";

              if (isCheckIn && stayDays === 1) {
                style = "bg-accent font-semibold text-white";
                rounded = "rounded-md";
              } else if (isCheckIn) {
                style = "bg-accent font-semibold text-white";
                rounded = "rounded-l-md rounded-r-none";
              } else if (isInStayRange) {
                style = "bg-accent/20 text-accent font-semibold";
                rounded = "rounded-none";
              } else if (isDisabled) {
                style = `cursor-not-allowed text-muted ${isBooked ? "line-through opacity-60" : "opacity-40"}`;
              } else {
                style = "text-ink hover:bg-surface-elevated";
              }

              const statusDesc = isCheckIn
                ? "Selected Check-in (11:00 AM)"
                : isInStayRange
                ? "Stay day"
                : isBooked
                ? "Unavailable"
                : isPast
                ? (date === today ? "Same-day booking unavailable" : "Past date")
                : "Available";

              return (
                <button
                  key={date}
                  type="button"
                  disabled={isDisabled}
                  aria-pressed={isCheckIn || isInStayRange}
                  aria-label={`${MONTH_NAMES[currentMonth]} ${day}, ${currentYear}, ${statusDesc}`}
                  onClick={() => handleSelectDate(date)}
                  className={`flex h-12 min-w-11 items-center justify-center text-base transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${rounded} ${style}`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-muted">
        <p>Private exclusive stays (11:00 AM check-in to 9:00 AM check-out). Choose your check-in date above, then select your stay duration in the booking form below to calculate rates automatically.</p>
        {unavailableDates.size > 0 && <p className="mt-1">Crossed-out dates are reserved or awaiting a deposit.</p>}
        <p className="mt-1" role="status">
          {availabilityStatus === "loading"
            ? "Checking the latest dates…"
            : availabilityStatus === "error"
            ? "Latest availability could not be loaded. Your host will confirm your requested dates."
            : "Dates checked. The host confirms each request."}
        </p>
      </div>

      {activeCheckIn ? (
        <div className="mt-5 border-t border-line pt-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface-elevated p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Check-in (11:00 AM)</p>
              <p className="mt-1 text-base font-semibold text-ink sm:text-lg" aria-live="polite">
                {formatSelectedDate(activeCheckIn)}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-elevated p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Check-out (9:00 AM)</p>
              <p className="mt-1 text-base font-semibold text-ink sm:text-lg" aria-live="polite">
                {formatSelectedDate(checkoutDateStr)}
              </p>
            </div>
          </div>

          <p className="mt-3 text-sm text-muted">
            Stay duration: <strong className="text-ink">{stayDays} {stayDays === 1 ? "day (22-hour stay)" : `days (${stayDays * 24 - 2}-hour stay)`}</strong>
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#inquire" className="inline-flex min-h-12 items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              Request this stay
            </a>
            {hasPhone && (
              <a
                href={`sms:${cleanPhone}?body=${encodeURIComponent(
                  `Hi! I would like to inquire about The HauS 26 for check-in on ${formatSelectedDate(activeCheckIn)} (11:00 AM) to check-out on ${formatSelectedDate(checkoutDateStr)} (9:00 AM) - ${stayDays} day${stayDays > 1 ? "s" : ""} stay. Could you confirm availability?`
                )}`}
                className={linkStyle}
              >
                Ask by SMS
              </a>
            )}
            {messengerUrl && <a href={messengerUrl} target="_blank" rel="noopener noreferrer" className={linkStyle}>Open Messenger</a>}
            {email && (
              <a
                href={`mailto:${email}?subject=${encodeURIComponent(
                  `Inquiry for stay: ${formatSelectedDate(activeCheckIn)} to ${formatSelectedDate(checkoutDateStr)}`
                )}&body=${encodeURIComponent(
                  `Hi! I would like to inquire about The HauS 26 for check-in on ${formatSelectedDate(activeCheckIn)} (11:00 AM) to check-out on ${formatSelectedDate(checkoutDateStr)} (9:00 AM) - ${stayDays} day${stayDays > 1 ? "s" : ""} stay. Could you confirm availability?`
                )}`}
                className={linkStyle}
              >
                Ask by Email
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Choose an available check-in date above to request your stay.</p>
      )}
    </div>
  );
}
