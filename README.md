# The HauS 26

Use Node.js 20.9 or newer.

1. `npm install` then `npm run dev` (open http://localhost:3000)
2. Fill in `lib/property.js` (empty fields hide their section). To add photos, drop files in `public/photos/` and add their `/photos/filename.jpg` paths to `photos`, with an accurate `alt` and a short `title`. The current six photos use their existing paths directly under `public/`.
   - The first photo leads the opening, followed by all six photos in a portrait gallery. Every gallery photo opens in a full-size viewer with Previous/Next buttons and arrow-key navigation. Escape closes it.
   - Set `position` (for example, `"center 60%"`) to adjust a preview crop. The full-size viewer always shows the entire image.
3. Deploy: configure the remote booking database and private environment variables in [BOOKINGS.md](BOOKINGS.md), then import the project into Vercel.

Booking deposits: see [PAYMENTS.md](./PAYMENTS.md) for PayMongo setup and standalone host commands. Website bookings use the listed rates and a 50% deposit. Online checkout remains unavailable until server-side configuration is supplied.

## Booking module

Guest requests and the private host dashboard are documented in [BOOKINGS.md](BOOKINGS.md). Run `npm run booking:setup` for local host access; Vercel requires a remote libSQL database.

Optional guest email/SMS confirmations and host email alerts use Resend and UniSMS. Follow [NOTIFICATIONS.md](NOTIFICATIONS.md) to test with your own inbox and phone before enabling guest delivery. Notifications are disabled by default.

The host dashboard also tracks monthly expenses, including water and electricity bills, and inventory for supplies and reusable items. See [OPERATIONS.md](OPERATIONS.md) for entry, stock adjustments, and history.

The home page uses adapted React Bits FadeContent and SpotlightCard components. Source and license notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
