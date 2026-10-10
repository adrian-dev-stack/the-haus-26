# The HauS 26
1. `npm install` then `npm run dev` (open http://localhost:3000)
2. Fill in `lib/property.js` (empty fields hide their section). To add photos, drop files in `public/photos/` and add their `/photos/filename.jpg` paths to `photos`, with an accurate `alt` and a short `title`. The current six photos use their existing paths directly under `public/`.
   - The first two photos form the main spread; the rest appear below. Every photo opens in a full-size viewer with Previous/Next buttons and arrow-key navigation. Escape closes it.
   - Set `position` (for example, `"center 60%"`) to adjust a preview crop. The full-size viewer always shows the entire image.
3. Deploy: push to GitHub, import into Vercel.
