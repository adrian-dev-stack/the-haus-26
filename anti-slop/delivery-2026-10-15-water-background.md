# Homepage water background delivery

The owner clarified that only the homepage background should animate. The original large property photograph is restored, and the separate modeled pool panel and ripple controls are removed.

Scope: the new public homepage background, its pause control, and unchanged content interactions. Existing page copy and layouts are outside this change.

Design read: a public pool-villa homepage for prospective guests, using the existing ivory, charcoal, and olive direction. ENERGY 2 / RHYTHM 3 / MOTION 1 for content, with the owner's explicitly requested slow ambient water background as the motion exception.

## Decisions

- Pale water caustics connect the background to the actual private pool while keeping the property photographs dominant.
- The existing Outfit/Figtree typography and spacing remain in place for visual continuity.
- One fixed canvas sits behind the homepage content and ignores pointer input; page controls retain their existing behavior.
- A 44px pause/play control in the footer gives visitors direct control over the ambient movement.
- One quad, capped rendering at 30fps desktop / 24fps phone, and pixel budgets of 650,000 desktop / 280,000 phone pixels keep the decorative work bounded.
- Reduced motion, forced colors, data saving, low reported device memory, unavailable WebGL2, and context loss use the static surface.
- Three.js loads through a separate dynamic import. GPU resources, observers, and listeners are disposed when the background is removed, including canceled startup.

## Verification

- PASS: `npm test`, 106 tests, no failures.
- PASS: `npm run build`, production compilation and static generation. Homepage initial payload is approximately 128kB in the Next.js report; the Three.js renderer is a separate later request.
- PASS: `npm run test:home:browser`, actual WebGL pixels and changing pixel samples, pause/play draw counts, and desktop/mobile interaction checks.
- PASS: `git -c core.whitespace=cr-at-eol diff --check`.
- PASS: root visually inspected `.booking-data/background-only-desktop.png` (1440px) and `.booking-data/background-only-mobile.png` (375px).
- PASS: the browser regression confirms the original full-size hero photograph, no modeled pool panel, and no Three.js download or WebGL draws on the admin page.

## Hard gate

- R-02 PASS: new source and copy contain no em dashes; the property verifier passed.
- R-03 PASS: Chromium at 315px and 375px has no horizontal overflow; the pause control is in the footer and stays clear of the mobile booking bar.
- R-17 PASS: no statistics were added to the product.
- R-18 PASS: no testimonials or identities were added.
- R-23 PASS: the owner explicitly requested a Three.js background and selected the public homepage.
- R-24 PASS: no navigation destinations were added; existing booking, rates, and gallery links were exercised.
- R-25 PASS: the darkest possible shader tint retains 4.72:1 contrast for existing muted text. Forced colors use the system Canvas surface, without WebGL beneath forced text colors.
- R-26 PASS: Pause background stops WebGL draws; Play background resumes them.
- R-27 PASS: a static surface is present before initialization and after unsupported WebGL or actual context loss; content stays usable.
- R-28 PASS: no FAQ content was changed or added.
- R-32 PASS: keyboard booking/rates navigation and gallery open, next, Escape, and focus restoration pass. The pause control is a native button with visible focus.
- R-33 PASS: source changes were made directly through patches, without a rewriting script.
- R-34 PASS: no theme toggle was added; forced-color and reduced-motion preferences were checked initially and after live changes.
- R-35 PASS: production build plus real Chromium rendering and interaction checks completed without first-party console errors.
- R-36 PASS: no security, compliance, or performance claims were added to the page.
- R-37 PASS: DESIGN.md was read and records the owner's homepage-background request.
- R-38 PASS: the background is procedural artwork; no property facts or customer content were invented.

## Purpose gate

- R-01 PASS: the pale ivory/olive tint depicts reflected pool light using the established palette.
- R-04 PASS: no decorative icons were added.
- R-06 PASS: the established fonts remain; no new display typography was introduced.
- R-07 PASS: the water pattern serves the requested pool background; no grid or terminal texture was added.
- R-08 PASS: no arrow decorations were added.
- R-09 PASS: no badges were added.
- R-10 PASS: no glass surfaces were added.
- R-12 PASS: the new background and control add no shadows.
- R-13 PASS: no glow was added.
- R-14 PASS: no feature cards were added.
- R-19 PASS: ambient movement was explicitly requested, stays behind content, and supports pause, visibility suspension, and reduced motion.
- R-22 PASS: no stock illustrations were added.

## Liveliness and quality locks

- Dials PASS: the existing design dials and explicit background exception are recorded above and in DESIGN.md.
- Focal point PASS: the real pool photograph and existing heading remain dominant in desktop and phone screenshots.
- Whitespace PASS: the existing page spacing remains; the canvas does not participate in layout.
- Accent PASS: olive still identifies the existing booking action and focus states.
- Identity PASS: water-light movement connects to the property's private pool.
- Design read PASS: the direction was declared before implementation and retained during review.
- C-1 / R-31 PASS: each new visual and implementation decision has a purpose recorded above.
- C-2 PASS: the new pause/play interaction and existing primary links work.
- C-3 / R-05 PASS: no sections or layout templates were added.
- C-4 PASS: normal, reduced-motion, data-saving, forced-color, unavailable-WebGL, context-loss, and narrow-screen conditions were exercised. Visibility suspension uses controlled document visibility events in the test.
- C-5 PASS: no evidence or property claims were fabricated.
- R-11 PASS: the footer pause control uses the existing text-link styling without an added panel.
- R-15 PASS: Pause background and Play background state their exact actions.
- R-16 PASS: no marketing buzzwords were added.
- R-20 PASS: palette, real photographs, and pool-specific light retain the property's identity.
- R-21 PASS: the existing light theme remains; forced-color visitors receive system colors.
- R-29 PASS: the new effect stays within the ivory and olive family.
- R-30 PASS: the implementation does not reproduce another product's interface.

The tests use isolated local servers and synthetic credentials. No real booking records, provider sends, or deployed pages were changed. Chromium checks do not establish Safari/Firefox or physical-device performance.
