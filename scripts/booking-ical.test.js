import test from "node:test";
import assert from "node:assert/strict";
import { generateIcalFeed } from "../lib/booking-ical.js";

test("generateIcalFeed generates valid RFC 5545 calendar with CRLF", () => {
  const feed = generateIcalFeed({ bookings: [], blockedDates: [] });
  assert.match(feed, /^BEGIN:VCALENDAR\r\n/);
  assert.match(feed, /\r\nEND:VCALENDAR\r\n$/);
  assert.match(feed, /VERSION:2\.0\r\n/);
  assert.match(feed, /X-WR-TIMEZONE:Asia\/Manila\r\n/);
});

test("generateIcalFeed redacts guest information for public channel feeds", () => {
  const sampleBookings = [
    {
      id: "test-uuid-1",
      reference: "HAUS-2026-001",
      name: "Juan Dela Cruz",
      phone: "+639171234567",
      email: "juan@example.com",
      stayDate: "2026-11-20",
      days: 1,
      guests: 6,
      totalAmount: 600000,
      depositAmount: 300000,
      status: "confirmed",
    },
  ];

  const feed = generateIcalFeed({ bookings: sampleBookings, isHost: false });
  assert.match(feed, /SUMMARY:The HauS 26 - Reserved/);
  assert.doesNotMatch(feed, /Juan Dela Cruz/);
  assert.doesNotMatch(feed, /\+639171234567/);
  assert.match(feed, /DTSTART:20261120T030000Z/);
  assert.match(feed, /DTEND:20261121T010000Z/);
});

test("generateIcalFeed includes full details and financial breakdown for host feed", () => {
  const sampleBookings = [
    {
      id: "test-uuid-2",
      reference: "HAUS-2026-002",
      name: "Maria Clara",
      phone: "+639189876543",
      email: "maria@example.com",
      stayDate: "2026-12-24",
      days: 2,
      guests: 8,
      totalAmount: 1600000,
      depositAmount: 800000,
      balancePaidAt: null,
      occasion: "Family Christmas Reunion",
      notes: "Bringing 2 small dogs",
      status: "confirmed",
    },
  ];

  const feed = generateIcalFeed({ bookings: sampleBookings, isHost: true });
  assert.match(feed, /The HauS 26 \(Host Bookings\)/);
  assert.match(feed, /SUMMARY:The HauS 26: Maria Clara \(8 pax\)/);
  assert.match(feed, /Guest: Maria Clara/);
  assert.match(feed, /\+639189876543/);
  assert.match(feed, /Duration: 2 day\(s\) \/ 22 hours/);
  assert.match(feed, /Family Christmas Reunion/);
  assert.match(feed, /Bringing 2 small dogs/);
  assert.match(feed, /DTSTART:20261224T030000Z/);
  assert.match(feed, /DTEND:20261226T010000Z/);
});

test("generateIcalFeed includes blocked dates", () => {
  const blockedDates = [
    { date: "2026-12-31", reason: "Host New Year Private Party" },
  ];

  const publicFeed = generateIcalFeed({ blockedDates, isHost: false });
  assert.match(publicFeed, /SUMMARY:The HauS 26 - Unavailable/);

  const hostFeed = generateIcalFeed({ blockedDates, isHost: true });
  assert.match(hostFeed, /SUMMARY:The HauS 26 - Blocked \(Host New Year Private Party\)/);
  assert.match(hostFeed, /DTSTART:20261231T030000Z/);
  assert.match(hostFeed, /DTEND:20270101T010000Z/);
});
