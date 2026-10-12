import { property } from "./property.js";

function escapeIcalText(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function toManilaUtc(dateStr, manilaHour) {
  // Manila is UTC+8.
  // 11:00 Manila = 03:00 UTC
  // 09:00 Manila = 01:00 UTC
  const utcHour = manilaHour - 8;
  const hourStr = String(utcHour).padStart(2, "0");
  const cleanDate = dateStr.replace(/-/g, "");
  return `${cleanDate}T${hourStr}0000Z`;
}

function addDaysToDate(dateStr, days = 1) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.max(1, Number(days) || 1));
  return d.toISOString().slice(0, 10);
}

export function generateIcalFeed({ bookings = [], blockedDates = [], isHost = false } = {}) {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The HauS 26//Staycation Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${isHost ? "The HauS 26 (Host Bookings)" : "The HauS 26 (Availability)"}`,
    "X-WR-TIMEZONE:Asia/Manila",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Manila",
    "X-LIC-LOCATION:Asia/Manila",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:PST",
    "DTSTART:19700101T000000",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  // 1. Confirmed Bookings
  for (const b of bookings) {
    const stayDays = Math.max(1, Number(b.days) || 1);
    const checkOutDate = addDaysToDate(b.stayDate, stayDays);

    // Check-in: 11:00 AM Manila (03:00 UTC) | Check-out: 9:00 AM Manila (01:00 UTC)
    const dtstart = toManilaUtc(b.stayDate, 11);
    const dtend = toManilaUtc(checkOutDate, 9);

    const uid = `haus26-booking-${b.id}@thehaus26.com`;

    let summary;
    let description;

    if (isHost) {
      summary = `The HauS 26: ${b.name} (${b.guests} pax)`;
      const totalPesos = (b.totalAmount / 100).toLocaleString();
      const depositPesos = (b.depositAmount / 100).toLocaleString();
      const balanceDue = ((b.totalAmount - b.depositAmount) / 100).toLocaleString();
      const balanceStatus = b.balancePaidAt ? `Paid on arrival (${b.balanceMethod || "Cash"})` : `Due on arrival (₱${balanceDue})`;

      description = [
        `Reference: ${b.reference}`,
        `Guest: ${b.name}`,
        `Phone: ${b.phone || "N/A"}`,
        `Email: ${b.email || "N/A"}`,
        `Group Size: ${b.guests} guests`,
        `Duration: ${stayDays} day(s) / 22 hours`,
        `Occasion: ${b.occasion || "Staycation"}`,
        `Total Rate: ₱${totalPesos}`,
        `Deposit: ₱${depositPesos} (Confirmed)`,
        `Balance: ${balanceStatus}`,
        `Notes: ${b.notes || "None"}`,
      ].join("\n");
    } else {
      summary = "The HauS 26 - Reserved";
      description = "Exclusive 22-hour private villa staycation in Limay, Bataan.";
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${escapeIcalText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcalText(description)}`);
    lines.push(`LOCATION:${escapeIcalText(property.address || "Hulo, Alangan, Limay, Bataan")}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  // 2. Blocked Dates (Maintenance / Private)
  for (const bl of blockedDates) {
    const nextDay = addDaysToDate(bl.date, 1);
    const dtstart = toManilaUtc(bl.date, 11);
    const dtend = toManilaUtc(nextDay, 9);
    const uid = `haus26-blocked-${bl.date}@thehaus26.com`;

    let summary;
    let description;

    if (isHost) {
      summary = `The HauS 26 - Blocked${bl.reason ? ` (${bl.reason})` : ""}`;
      description = bl.reason ? `Blocked by host: ${bl.reason}` : "Host reserved / maintenance date.";
    } else {
      summary = "The HauS 26 - Unavailable";
      description = "This date is unavailable for reservations.";
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`DTEND:${dtend}`);
    lines.push(`SUMMARY:${escapeIcalText(summary)}`);
    lines.push(`DESCRIPTION:${escapeIcalText(description)}`);
    lines.push(`LOCATION:${escapeIcalText(property.address || "Hulo, Alangan, Limay, Bataan")}`);
    lines.push("STATUS:CONFIRMED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
