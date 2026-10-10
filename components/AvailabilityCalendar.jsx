"use client";

import { useState } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AvailabilityCalendar({
  bookedDates = [],
  onSelectDate,
  selectedDate,
  phone = "+639524566669",
  messengerUrl,
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Navigation
  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function prevMonth() {
    const isPast =
      currentYear === today.getFullYear() && currentMonth <= today.getMonth();
    if (isPast) return;

    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  // Days calculation
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push(d);
  }

  function formatDateString(year, month, day) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    return `${year}-${mm}-${dd}`;
  }

  function isDatePast(year, month, day) {
    const check = new Date(year, month, day, 23, 59, 59);
    return check < today;
  }

  function isDateBooked(dateStr) {
    return bookedDates.includes(dateStr);
  }

  const isPrevDisabled =
    currentYear === today.getFullYear() && currentMonth <= today.getMonth();

  return (
    <div className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8">
      {/* Month Header */}
      <div className="flex items-center justify-between border-b border-line pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            Live Schedule
          </span>
          <h3 className="font-display text-2xl font-medium text-ink">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isPrevDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-paper text-ink transition-colors hover:border-ink"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      {/* Day of Week Headers */}
      <div className="mt-6 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wider text-muted">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="mt-1 grid grid-cols-7 gap-1.5 sm:gap-2">
        {calendarDays.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="h-11 sm:h-12" />;
          }

          const dateStr = formatDateString(currentYear, currentMonth, day);
          const isPast = isDatePast(currentYear, currentMonth, day);
          const isBooked = isDateBooked(dateStr);
          const isSelected = selectedDate === dateStr;

          let btnClass =
            "relative flex h-11 sm:h-12 flex-col items-center justify-center rounded-xl text-sm font-medium transition-all ";

          if (isSelected) {
            btnClass += "bg-accent text-white shadow-sm ring-2 ring-accent/30 font-semibold scale-[1.02]";
          } else if (isBooked) {
            btnClass +=
              "bg-black/[0.04] text-muted/40 cursor-not-allowed line-through";
          } else if (isPast) {
            btnClass += "text-muted/30 cursor-not-allowed";
          } else {
            btnClass +=
              "bg-paper hover:bg-accent/10 hover:text-accent text-ink border border-line/60 active:scale-95";
          }

          return (
            <button
              key={dateStr}
              type="button"
              disabled={isPast || isBooked}
              onClick={() => onSelectDate && onSelectDate(dateStr)}
              className={btnClass}
              title={
                isBooked
                  ? "Already reserved"
                  : isPast
                  ? "Past date"
                  : "Available for 22-hour stay"
              }
            >
              <span>{day}</span>
              {!isPast && !isBooked && !isSelected && (
                <span className="mt-0.5 h-1 w-1 rounded-full bg-accent/60" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend & Selected Date Summary */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-xs text-muted">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-black/20" />
            <span>Reserved / Booked</span>
          </div>
        </div>
        <span className="text-[11px]">All stays are 22 hours exclusive</span>
      </div>

      {/* Interactive Selection Action Bar */}
      {selectedDate && (
        <div className="mt-5 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                Selected Check-in Date
              </span>
              <p className="font-display text-lg font-semibold text-ink">
                {selectedDate} (11:00 AM check-in)
              </p>
              <p className="text-xs text-muted">
                Check-out: Next day at 1:00 PM · 22-hour exclusive access
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`sms:${(phone || "").replace(/[^0-9+]/g, "")}?body=${encodeURIComponent(
                  `Hi! I would like to book The HauS 26 for check-in on ${selectedDate} (22-hour stay). Is this date still open?`
                )}`}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-accent px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#104846]"
              >
                Book via SMS
              </a>
              {messengerUrl && (
                <a
                  href={messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-line bg-white px-4 text-xs font-medium text-ink transition-colors hover:border-ink"
                >
                  Message on Facebook
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
