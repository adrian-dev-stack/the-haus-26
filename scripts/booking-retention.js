import env from "@next/env";
import { parseArgs } from "node:util";
import { getBookingStore } from "../lib/booking-store.js";

const { values } = parseArgs({ options: { erase: { type: "string" }, help: { type: "boolean", short: "h" } } });
if (values.help) {
  process.stdout.write("Run: npm run booking:retention\nErase contact details from a past completed/cancelled booking: npm run booking:retention -- --erase BOOKING_UUID\nThis preserves the booking reference, payment metadata and calendar hold. Unresolved payment/refund cases are not eligible.\n");
  process.exit(0);
}
if (values.erase && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.erase)) throw new Error("Use the booking UUID, not a guest name or email.");
env.loadEnvConfig(process.cwd());
const days = Number(process.env.BOOKING_CONTACT_RETENTION_DAYS || 180);
if (!Number.isSafeInteger(days) || days < 1 || days > 3650) throw new Error("Set BOOKING_CONTACT_RETENTION_DAYS between 1 and 3650.");
const client = await getBookingStore();
try {
  const cutoff = Date.now() - days * 86400000;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const selection = values.erase
    ? "id=? AND stay_date<? AND status IN ('confirmed','test_paid','declined','cancelled') AND payment_error_code IS NULL"
    : "status IN ('requested','declined','cancelled') AND updated_at<? AND stay_date<? AND NOT EXISTS (SELECT 1 FROM booking_holds WHERE booking_holds.booking_id=bookings.id)";
  const result = await client.execute({ sql: `UPDATE bookings SET name='Contact removed',email='',phone='',notes='',occasion='',terms=NULL,cancellation_reason=NULL,request_hash='erased',updated_at=? WHERE ${selection} AND email!=''`,
    args: [Date.now(), values.erase || cutoff, today] });
  process.stdout.write(values.erase ? `Removed contact details from ${result.rowsAffected} eligible past booking(s). Dates and payment metadata were preserved.\n` : `Removed contact details from ${result.rowsAffected} past inactive booking request(s), after ${days} days.\n`);
} finally { client.close(); }
