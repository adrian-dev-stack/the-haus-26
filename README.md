# The HauS 26

Use Node.js 20.9 or newer.

1. `npm install` then `npm run dev` (open http://localhost:3000)
2. Fill in `lib/property.js` (empty fields hide their section). To add photos, drop files in `public/photos/` and add their `/photos/filename.jpg` paths to `photos`, with an accurate `alt` and a short `title`. The current six photos use their existing paths directly under `public/`.
   - The first photo leads the opening, followed by all six photos in a portrait gallery. Every gallery photo opens in a full-size viewer with Previous/Next buttons and arrow-key navigation. Escape closes it.
   - Set `position` (for example, `"center 60%"`) to adjust a preview crop. The full-size viewer always shows the entire image.
3. Deploy: configure the remote booking database and private environment variables in [BOOKINGS.md](BOOKINGS.md), then import the project into Vercel.

Booking deposits: see [PAYMENTS.md](./PAYMENTS.md) for the PayMongo setup and host commands. Guests pay a 50% deposit only after the host confirms their date and final quote. Online checkout remains unavailable until server-side payment configuration is supplied.

## Booking module

Guest requests and the private host dashboard are documented in [BOOKINGS.md](BOOKINGS.md). Run `npm run booking:setup` for local host access; Vercel requires a remote libSQL database.
