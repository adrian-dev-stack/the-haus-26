import env from "@next/env";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { getBookingStore } from "../lib/booking-store.js";
import { renderBookingNotification } from "../lib/booking-notifications.js";
import { getNotificationConfig, sendEmail, sendSms } from "../lib/notification-providers.js";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { channel: { type: "string" }, reference: { type: "string" }, help: { type: "boolean", short: "h" } } });
const command = positionals[0] || "preview";
if (values.help) {
  console.log("Preview (no network): npm run notifications -- preview\nQueue status: npm run notifications -- status [--reference H26-...]\nSend one test to your configured recipient: npm run notifications -- test --channel email|sms");
  process.exit(0);
}

try {
  if (positionals.length > 1) throw new Error("Use one notification command.");
  if (command === "preview") {
    const config = { testEnabled: true, testEmail: "tester@example.test", testPhone: "+639123456789", emailReplyTo: "" };
    const booking = { reference: "H26-PREVIEW-ONLY", livemode: 0, status: "test_paid", days: 2, stay_date: "2030-02-01", guests: 4,
      total_amount: 1000000, deposit_amount: 500000, terms: "Fixture details for preview only." };
    console.log("FICTIONAL PREVIEW ONLY. No booking is created and no messages are sent.\n");
    for (const kind of ["guest_email", "guest_sms", "host_email"]) {
      const message = renderBookingNotification(booking, kind, { config, siteUrl: "", tokenSecret: "" });
      console.log(`${kind}\n${message.subject ? `${message.subject}\n` : ""}${message.text}\n`);
    }
  } else if (command === "status") {
    env.loadEnvConfig(process.cwd());
    if (values.reference && !/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(values.reference)) throw new Error("Use a valid booking reference.");
    const client = await getBookingStore();
    try {
      const rows = (await client.execute({ sql: `SELECT b.reference,n.kind,n.status,n.attempts,n.error_code,n.provider_id FROM booking_notifications n
        JOIN bookings b ON b.id=n.booking_id ${values.reference ? "WHERE b.reference=?" : ""} ORDER BY n.created_at DESC,n.kind LIMIT 100`,
        args: values.reference ? [values.reference] : [] })).rows;
      console.log(rows.length ? JSON.stringify(rows, null, 2) : "No queued notifications. Enable notifications before verifying a new deposit.");
      console.log("accepted means provider acceptance, not verified inbox or phone delivery. review requires reconciliation in the provider dashboard.");
    } finally { client.close(); }
  } else if (command === "test") {
    env.loadEnvConfig(process.cwd());
    const config = getNotificationConfig();
    if (!config.enabled || !config.testEnabled) throw new Error("Enable BOOKING_NOTIFICATIONS_ENABLED and BOOKING_NOTIFICATIONS_TEST_ENABLED before a test send.");
    if (!["email", "sms"].includes(values.channel)) throw new Error("Choose --channel email or --channel sms.");
    const text = "The HauS 26: Booking notification check. System operational.";
    if (values.channel === "email") {
      if (!config.testEmail) throw new Error("Set BOOKING_NOTIFICATION_TEST_EMAIL to your own Resend account email.");
      const sent = await sendEmail({ to: config.testEmail, subject: "[TEST] The HauS 26 notifications", text }, { config, idempotencyKey: `haus26-manual-test/${randomUUID()}` });
      console.log(`Test email accepted by Resend. Provider ID: ${sent.id}`);
    } else {
      if (!config.testPhone) throw new Error("Set BOOKING_NOTIFICATION_TEST_PHONE to your own Philippine mobile number.");
      const sent = await sendSms({ to: config.testPhone, text }, { config });
      console.log(`Test SMS accepted by UniSMS. Provider ID: ${sent.id}`);
    }
  } else throw new Error("Use preview, status or test.");
} catch (error) {
  console.error(error?.message || "Notification command failed.");
  if (error?.code === "provider-rejected") {
    if (values?.channel === "sms") {
      console.error("Tip: Check your UniSMS dashboard (unismsapi.com/dashboard) to verify SMS credits and Sender ID approval.");
    } else if (values?.channel === "email") {
      console.error("Tip: Check your Resend dashboard (resend.com) to verify your API key and sender domain restrictions.");
    }
  }
  if (error?.ambiguous) console.error("The provider may have accepted this message. Check its dashboard before another send.");
  process.exitCode = 1;
}
