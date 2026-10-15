# Haus 26 design direction

The owner selected option 1, modern tropical guesthouse, on October 11, 2026.

- Identity: a private pool stay in Limay, Bataan, for families and groups of friends.
- Personality: warm, relaxed, and welcoming.
- Palette: warm ivory, charcoal, and deep olive. The house's pale walls, patio plants, and evening lighting inform the colors.
- Typography: large, clean sans-serif headings and readable body text. Retain Outfit and Figtree from the project; avoid decorative serif accents and excessive uppercase labels.
- Composition: a tall pool photograph leads the opening, with the house name and short introduction alongside on desktop. On phones, the name precedes the photograph. Supporting photos use plain captions, amenities use open lists, and rates use rows.
- Booking: one clear date-selection action and a compact mobile booking bar. Dates are preferences for an inquiry; the host confirms availability and the final rate.
- Motion: brief hover and press feedback, with one-time 600ms React Bits reveals that fade from 15% opacity and rise 28px as supporting sections enter view. The owner requested a more noticeable reveal and no progress line above the header. Retain the faint olive spotlight on rates, native scrolling, and a visible scrollbar at its normal width. Respect reduced motion; keep booking, payment, and admin controls steady.
- Content: supplied property photographs and owner-configured details. No invented reviews, popularity claims, or live booking status.
- Dials: ENERGY 2 / RHYTHM 3 / MOTION 1.
- Public homepage background: the owner clarified that Three.js should animate the background only, and rejected the separate 3D pool illustration. Retain the original large property photo and hero layout. The approved refinement uses broad, smooth sunlight reflections over pale aqua and warm ivory, with stronger movement near the viewport edges and calmer light beneath the central content. Do not add a modeled pool, illustration panel, or ripple controls. Place the accessible pause/play control in the existing footer. Respect reduced motion, data saving, low reported memory, forced colors, and hidden tabs, with a static surface when rendering is unavailable. This background is the explicit motion exception.
