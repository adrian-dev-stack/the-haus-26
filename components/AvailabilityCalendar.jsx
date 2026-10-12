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

function countDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const d1 = new Date(`${startDate}T12:00:00Z`);
  const d2 = new Date(`${endDate}T12:00:00Z`);
  const diff = Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  return Math.max(1, diff);
}

function getStayNights(startDate, endDate) {
  if (!startDate || !endDate || startDate >= endDate) return [];
  const nights = [];
  let curr = startDate;
  while (curr < endDate) {
    nights.push(curr);
    curr = addDays(curr, 1);
  }
  return nights;
}

export default function AvailabilityCalendar({
  bookedDates = [],
  onSelectDate,
  onSelectDates,
  selectedDate: controlledSelectedDate,
  selectedCheckoutDate: controlledSelectedCheckoutDate,
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
  const [checkOutDate, setCheckOutDate] = useState("");
  const [activeTab, setActiveTab] = useState("checkin");
  const [hoverDate, setHoverDate] = useState(null);
  const [rangeError, setRangeError] = useState("");

  const [savedDates, setSavedDates] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");

  const unavailableDates = new Set([...bookedDates, ...savedDates]);
  const cleanPhone = (phone || "").replace(/[^0-9+]/g, "");
  const hasPhone = /\d/.test(cleanPhone);

  const activeCheckIn = controlledSelectedDate ?? checkInDate;
  const activeCheckOut = controlledSelectedCheckoutDate ?? checkOutDate;
  const stayDays = countDays(activeCheckIn, activeCheckOut);

  useEffect(() => {
    const currentDate = getToday();
    const [year, month] = currentDate.split("-").map(Number);
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
      const outDate = event.detail?.checkoutDate || event.detail?.checkout;
      const daysCount = event.detail?.days;

      if (!inDate) {
        setCheckInDate("");
        setCheckOutDate("");
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inDate)) return;

      setCheckInDate(inDate);
      if (outDate && /^\d{4}-\d{2}-\d{2}$/.test(outDate)) {
        setCheckOutDate(outDate);
      } else if (daysCount && Number(daysCount) >= 1) {
        setCheckOutDate(addDays(inDate, Number(daysCount)));
      } else {
        setCheckOutDate(addDays(inDate, 1));
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

  function notifyDateSelection(newCheckIn, newCheckOut) {
    const days = countDays(newCheckIn, newCheckOut);
    onSelectDate?.(newCheckIn);
    onSelectDates?.({ checkIn: newCheckIn, checkOut: newCheckOut, days });
    window.dispatchEvent(new CustomEvent("haus26:select-dates", {
      detail: { date: newCheckIn, checkin: newCheckIn, checkoutDate: newCheckOut, checkout: newCheckOut, days }
    }));
    window.dispatchEvent(new CustomEvent("haus26:select-date", {
      detail: { date: newCheckIn, checkoutDate: newCheckOut, days }
    }));
  }

  function handleSelectDate(date) {
    setRangeError("");

    if (activeTab === "checkin" || !activeCheckIn) {
      if (unavailableDates.has(date)) {
        setRangeError("That date is already reserved. Please choose an available check-in date.");
        return;
      }
      setCheckInDate(date);
      const defaultCheckOut = addDays(date, 1);
      setCheckOutDate(defaultCheckOut);
      setActiveTab("checkout");
      notifyDateSelection(date, defaultCheckOut);
      return;
    }

    if (activeTab === "checkout") {
      if (date <= activeCheckIn) {
        if (unavailableDates.has(date)) {
          setRangeError("That date is already reserved. Please choose an available check-in date.");
          return;
        }
        setCheckInDate(date);
        const defaultCheckOut = addDays(date, 1);
        setCheckOutDate(defaultCheckOut);
        setActiveTab("checkout");
        notifyDateSelection(date, defaultCheckOut);
        return;
      }

      const nights = getStayNights(activeCheckIn, date);
      const conflict = nights.find((night) => unavailableDates.has(night));
      if (conflict) {
        setRangeError(`The night of ${formatSelectedDate(conflict)} is already reserved. Please select dates within continuous available days.`);
        return;
      }

      setCheckOutDate(date);
      setActiveTab("checkin");
      notifyDateSelection(activeCheckIn, date);
    }
  }

  function resetDates() {
    setCheckInDate("");
    setCheckOutDate("");
    setActiveTab("checkin");
    setRangeError("");
    window.dispatchEvent(new CustomEvent("haus26:select-dates", {
      detail: { date: "", checkoutDate: "", days: 1 }
    }));
    window.dispatchEvent(new CustomEvent("haus26:select-date", {
      detail: { date: "", checkoutDate: "", days: 1 }
    }));
  }

  function isCheckoutBlocked(date) {
    if (!activeCheckIn || date <= activeCheckIn) return false;
    const nights = getStayNights(activeCheckIn, date);
    return nights.some((n) => unavailableDates.has(n));
  }

  if (!today || currentMonth === null || currentYear === null) {
    return (
      <div className="min-w-0 rounded-xl border border-line bg-surface p-4 sm:p-6">
        <Heading className="availability-heading">Choose your stay dates</Heading>
        <p className="mt-2 text-sm leading-relaxed text-muted">Select your check-in and check-out dates. Your host confirms availability before a booking is made.</p>
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Heading className="availability-heading">Choose check-in & check-out</Heading>
          <p className="mt-1 text-sm leading-relaxed text-muted">Select your check-in date (11:00 AM) and check-out date (9:00 AM).</p>
        </div>
        {activeCheckIn && (
          <button
            type="button"
            onClick={resetDates}
            className="text-xs font-medium text-muted hover:text-ink underline self-center"
          >
            Reset dates
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface-elevated p-1.5" role="tablist" aria-label="Select date mode">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "checkin"}
          onClick={() => { setActiveTab("checkin"); setRangeError(""); }}
          className={`flex flex-col rounded-md px-3 py-2 text-left transition-all ${
            activeTab === "checkin"
              ? "bg-paper text-ink shadow-sm ring-2 ring-accent"
              : "text-muted hover:bg-paper/50 hover:text-ink"
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">1. Check-in (11:00 AM)</span>
          <span className="mt-0.5 truncate text-sm font-semibold text-ink">
            {activeCheckIn ? formatSelectedDate(activeCheckIn) : "Select check-in"}
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "checkout"}
          onClick={() => { setActiveTab("checkout"); setRangeError(""); }}
          className={`flex flex-col rounded-md px-3 py-2 text-left transition-all ${
            activeTab === "checkout"
              ? "bg-paper text-ink shadow-sm ring-2 ring-accent"
              : "text-muted hover:bg-paper/50 hover:text-ink"
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">2. Check-out (9:00 AM)</span>
          <span className="mt-0.5 truncate text-sm font-semibold text-ink">
            {activeCheckOut ? formatSelectedDate(activeCheckOut) : "Select check-out"}
          </span>
        </button>
      </div>

      {rangeError && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900" role="alert">
          {rangeError}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div>
          <p className="text-lg font-semibold text-ink" aria-live="polite">{MONTH_NAMES[currentMonth]} {currentYear}</p>
          <p className="text-xs text-muted">
            {activeTab === "checkin" ? "Click a date to set check-in" : "Click a later date to set check-out"}
          </p>
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
            onMouseLeave={() => setHoverDate(null)}
          >
            {calendarDays.map((day, index) => {
              if (!day) return <div key={`empty-${index}`} className="h-12" aria-hidden="true" />;
              const date = formatDateString(currentYear, currentMonth, day);
              const isPast = date <= today;
              const isBooked = unavailableDates.has(date);
              const isCheckIn = activeCheckIn === date;
              const isCheckOut = activeCheckOut === date;
              const isInRange = Boolean(activeCheckIn && activeCheckOut && date > activeCheckIn && date < activeCheckOut);
              const isHoverRange = Boolean(activeTab === "checkout" && activeCheckIn && hoverDate && hoverDate > activeCheckIn && date > activeCheckIn && date < hoverDate);
              const isHoverEnd = Boolean(activeTab === "checkout" && activeCheckIn && hoverDate && date === hoverDate && hoverDate > activeCheckIn);
              const checkoutBlocked = activeTab === "checkout" && isCheckoutBlocked(date);

              const isDisabled = isPast || (activeTab === "checkin" && isBooked) || (activeTab === "checkout" && checkoutBlocked);

              let style = "";
              let rounded = "rounded-md";

              if (isCheckIn && isCheckOut) {
                style = "bg-accent font-semibold text-white";
                rounded = "rounded-md";
              } else if (isCheckIn) {
                style = "bg-accent font-semibold text-white";
                rounded = activeCheckOut ? "rounded-l-md rounded-r-none" : "rounded-md";
              } else if (isCheckOut) {
                style = "bg-accent font-semibold text-white";
                rounded = activeCheckIn ? "rounded-r-md rounded-l-none" : "rounded-md";
              } else if (isInRange) {
                style = "bg-accent/20 text-accent font-semibold";
                rounded = "rounded-none";
              } else if (isHoverRange) {
                style = "bg-accent/15 text-ink";
                rounded = "rounded-none";
              } else if (isHoverEnd) {
                style = "bg-accent/30 font-semibold text-ink";
                rounded = "rounded-r-md rounded-l-none";
              } else if (isDisabled) {
                style = `cursor-not-allowed text-muted ${isBooked ? "line-through opacity-60" : "opacity-40"}`;
              } else {
                style = "text-ink hover:bg-surface-elevated";
              }

              const statusDesc = isCheckIn
                ? "Selected Check-in (11:00 AM)"
                : isCheckOut
                ? "Selected Check-out (9:00 AM)"
                : isInRange
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
                  aria-pressed={isCheckIn || isCheckOut}
                  aria-label={`${MONTH_NAMES[currentMonth]} ${day}, ${currentYear}, ${statusDesc}`}
                  onClick={() => handleSelectDate(date)}
                  onMouseEnter={() => {
                    if (activeTab === "checkout" && activeCheckIn && date > activeCheckIn && !checkoutBlocked) {
                      setHoverDate(date);
                    }
                  }}
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
        <p>Private exclusive stays (11:00 AM check-in to 9:00 AM check-out). Choose your check-in date and check-out date above. Single and multiple-day stays calculate rates automatically based on duration.</p>
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
                {activeCheckOut ? formatSelectedDate(activeCheckOut) : "Select check-out above"}
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
                  `Hi! I would like to inquire about The HauS 26 for check-in on ${formatSelectedDate(activeCheckIn)} (11:00 AM) to check-out on ${formatSelectedDate(activeCheckOut || addDays(activeCheckIn, 1))} (9:00 AM) - ${stayDays} day${stayDays > 1 ? "s" : ""} stay. Could you confirm availability?`
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
                  `Inquiry for stay: ${formatSelectedDate(activeCheckIn)} to ${formatSelectedDate(activeCheckOut || addDays(activeCheckIn, 1))}`
                )}&body=${encodeURIComponent(
                  `Hi! I would like to inquire about The HauS 26 for check-in on ${formatSelectedDate(activeCheckIn)} (11:00 AM) to check-out on ${formatSelectedDate(activeCheckOut || addDays(activeCheckIn, 1))} (9:00 AM) - ${stayDays} day${stayDays > 1 ? "s" : ""} stay. Could you confirm availability?`
                )}`}
                className={linkStyle}
              >
                Ask by Email
              </a>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Choose your check-in and check-out dates above to request your stay.</p>
      )}
    </div>
  );
}
