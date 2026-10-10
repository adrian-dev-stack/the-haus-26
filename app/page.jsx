import { property as p } from "@/lib/property";
import Navbar from "@/components/Navbar";
import InquiryForm from "@/components/InquiryForm";
import PhotoGallery from "@/components/PhotoGallery";
import PageAnimations from "@/components/PageAnimations";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import {
  PoolIcon,
  BilliardsIcon,
  GrillIcon,
  BedIcon,
  KitchenIcon,
  WifiIcon,
  CarIcon,
  PawIcon,
} from "@/components/AmenityIcons";

const specs = [
  {
    label: "Stay duration",
    value: "22 Hours",
    sub: "Exclusive full property access",
  },
  {
    label: "Check-in window",
    value: p.checkIn || "11:00 AM to 1:00 PM",
    sub: "Host greeting & walkthrough",
  },
  {
    label: "Check-out time",
    value: p.checkOut || "Next day (22 hrs)",
    sub: "Standard departure time",
  },
  {
    label: "Base rate",
    value: p.rate || "From ₱5,000",
    sub: "For up to 4 guests",
  },
];

const amenityCategories = [
  {
    title: "Water & Outdoor Leisure",
    description: "Designed for day-long outdoor living and evening relaxation.",
    items: [
      {
        name: "Private Swimming Pool",
        detail: "Deep blue-tiled pool with inflatable lounger and evening perimeter illumination",
        Icon: PoolIcon,
      },
      {
        name: "Billiards Lounge",
        detail: "Indoor billiard table with curved warm overhead lighting and spectator seating",
        Icon: BilliardsIcon,
      },
      {
        name: "Outdoor BBQ Grill",
        detail: "Dedicated patio grill station under shade umbrella beside the pool deck",
        Icon: GrillIcon,
      },
    ],
  },
  {
    title: "Suites & Interior Living",
    description: "Air-conditioned interior spaces to rest and recharge.",
    items: [
      {
        name: "2 Air-Conditioned Rooms",
        detail: "Equipped with cooling air conditioning for peaceful overnight sleep",
        Icon: BedIcon,
      },
      {
        name: "Bunk Bed Suite",
        detail: "Sturdy black-framed multi-level bunk beds with customizable ambient mood lighting",
        Icon: BedIcon,
      },
      {
        name: "Fully Equipped Kitchen",
        detail: "Kitchen space featuring a full refrigerator, cooking stove, and prep area",
        Icon: KitchenIcon,
      },
    ],
  },
  {
    title: "Convenience & Sanctuary Rules",
    description: "Essential comforts and community guidelines for a pleasant stay.",
    items: [
      {
        name: "High-Speed Wi-Fi",
        detail: "Wireless internet coverage for streaming music, work, and messaging",
        Icon: WifiIcon,
      },
      {
        name: "Free Gated Parking",
        detail: "Dedicated private parking space on property that comfortably fits two sedans",
        Icon: CarIcon,
      },
      {
        name: "Pets Welcome",
        detail: "Pet-friendly property so you do not have to leave furry family members behind",
        Icon: PawIcon,
      },
    ],
  },
];

const rateTiers = [
  {
    tier: "Intimate Stay",
    guests: "Up to 4 Guests",
    price: "₱5,000",
    note: "Minimum stay rate. 2 to 4 guests welcome at the same base price.",
    popular: false,
  },
  {
    tier: "Barkada / Group",
    guests: "6 Guests",
    price: "₱7,000",
    note: "Ideal tier for close friends, colleagues, or small family getaways.",
    popular: true,
  },
  {
    tier: "Full Family Gathering",
    guests: "8 to 10 Guests",
    price: "₱8,000",
    note: "Perfect for family reunions, celebrations, and larger gatherings.",
    popular: false,
  },
  {
    tier: "Extended Group",
    guests: "11+ Guests",
    price: "Inquire for quote",
    note: "For groups of 11 or more, an additional fee per guest applies.",
    popular: false,
  },
];

export default function Page() {
  const { lat, lng } = p.coords;

  return (
    <>
      <Navbar name={p.name} rate={p.rate} />
      <PageAnimations />

      <main id="main" className="site-shell">
        {/* Modern Editorial Masthead */}
        <section id="overview" className="stay-header pt-4 sm:pt-8" aria-labelledby="hero-title">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Private Pool Villa · Limay, Bataan
              </span>
            </div>

            <h1 id="hero-title" className="mt-3 font-display text-4xl font-normal tracking-tight text-ink sm:text-6xl md:text-7xl">
              {p.name}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {p.tagline || "Private staycation rental with pool in Limay, Bataan."}
            </p>

            {/* Quick Hero Feature Badges */}
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line bg-white/80 px-3.5 py-1 font-medium">
                22-Hour Exclusive Stay
              </span>
              <span className="rounded-full border border-line bg-white/80 px-3.5 py-1 font-medium">
                Starting from ₱5,000
              </span>
              <span className="rounded-full border border-line bg-white/80 px-3.5 py-1 font-medium">
                Private Pool & Billiards
              </span>
              <span className="rounded-full border border-line bg-white/80 px-3.5 py-1 font-medium">
                Gated 2-Car Parking
              </span>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#calendar"
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-accent px-6 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#104846] active:scale-95"
              >
                Check live availability calendar
              </a>
              <a
                href="#gallery"
                className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-line bg-paper px-5 py-2.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-white"
              >
                View photos of the house
              </a>
            </div>
          </div>
        </section>

        {/* Curated Photo Gallery */}
        <div className="mt-8 sm:mt-12">
          <PhotoGallery photos={p.photos} />
        </div>

        {/* Live Availability Calendar Section */}
        <section id="calendar" className="mt-20 scroll-mt-24" aria-labelledby="cal-heading">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              01 / Real-Time Availability
            </span>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h2 id="cal-heading" className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                  Check available dates
                </h2>
                <p className="mt-1 max-w-xl text-xs text-muted">
                  Browse open dates on the live calendar. Tap any available day to inspect stay hours and reserve directly with the host.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Available
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="h-2 w-2 rounded-full bg-black/20" /> Reserved
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <AvailabilityCalendar
              bookedDates={p.bookedDates || []}
              phone={p.contact.phone}
              messengerUrl={p.contact.messengerUrl}
            />
          </div>
        </section>

        {/* Architectural Specifications Ribbon */}
        <section id="specs" className="mt-20 scroll-mt-24" aria-labelledby="specs-heading">
          <h2 id="specs-heading" className="sr-only">
            Property Specifications
          </h2>
          <div className="rounded-3xl border border-line bg-white/70 p-6 shadow-xs backdrop-blur-xs sm:p-8">
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-8">
              {specs.map((item, idx) => (
                <div key={item.label} className={idx > 0 ? "border-l-0 md:border-l md:border-line md:pl-6" : ""}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-1 font-display text-2xl font-medium tracking-tight text-ink sm:text-3xl">
                    {item.value}
                  </dd>
                  <p className="mt-1 text-xs text-muted">
                    {item.sub}
                  </p>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Curated Amenities Grid with Modern Icons */}
        <section id="amenities" className="mt-20 scroll-mt-24" aria-labelledby="amenities-heading">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              02 / Architecture & Comfort
            </span>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <h2 id="amenities-heading" className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                What this retreat includes
              </h2>
              <p className="max-w-md text-xs text-muted sm:text-right">
                All amenities are exclusive to your group during the 22-hour reservation.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {amenityCategories.map((cat) => (
              <div
                key={cat.title}
                className="flex flex-col justify-between rounded-3xl border border-line bg-white/70 p-6 shadow-xs backdrop-blur-xs transition-shadow hover:shadow-sm"
              >
                <div>
                  <h3 className="font-display text-xl font-medium tracking-tight text-ink">
                    {cat.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {cat.description}
                  </p>
                  <ul className="mt-5 space-y-4">
                    {cat.items.map((it) => {
                      const IconComponent = it.Icon;
                      return (
                        <li key={it.name} className="flex items-start gap-3 border-t border-line/60 pt-3.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                            <IconComponent className="h-4 w-4" />
                          </span>
                          <div>
                            <span className="block text-sm font-medium text-ink">
                              {it.name}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                              {it.detail}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {/* House Guidelines Capsule */}
          <div className="mt-8 rounded-3xl border border-line bg-paper/80 p-6 sm:p-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  House Guidelines
                </span>
                <h3 className="mt-0.5 font-display text-lg font-medium text-ink">
                  Good things to know before you arrive
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-line bg-white px-3.5 py-1 text-xs font-medium text-muted">
                  Quiet hours after 10:00 PM
                </span>
                <span className="rounded-full border border-line bg-white px-3.5 py-1 text-xs font-medium text-muted">
                  Non-smoking interior
                </span>
                <span className="rounded-full border border-line bg-white px-3.5 py-1 text-xs font-medium text-muted">
                  Pets welcome
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Transparent Rates & Packages Suite */}
        <section id="rates" className="mt-20 scroll-mt-24" aria-labelledby="rates-heading">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              03 / Transparent Pricing
            </span>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <h2 id="rates-heading" className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                Rates & group packages
              </h2>
              <p className="max-w-md text-xs text-muted sm:text-right">
                All bookings include full 22-hour private use of the entire property and pool.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {rateTiers.map((tier) => (
              <div
                key={tier.tier}
                className={`relative flex flex-col justify-between rounded-3xl border p-6 transition-all ${
                  tier.popular
                    ? "border-accent bg-white shadow-sm ring-1 ring-accent/30"
                    : "border-line bg-white/70 shadow-xs backdrop-blur-xs"
                }`}
              >
                {tier.popular && (
                  <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-0.5 text-[10px] font-semibold tracking-wider text-white uppercase">
                    Most Popular
                  </span>
                )}
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {tier.tier}
                  </span>
                  <div className="mt-2">
                    <span className="font-display text-3xl font-medium tracking-tight text-ink">
                      {tier.price}
                    </span>
                    <span className="ml-1 text-xs text-muted">/ 22 hrs</span>
                  </div>
                  <span className="mt-1 block text-xs font-medium text-accent">
                    {tier.guests}
                  </span>
                  <p className="mt-4 border-t border-line/70 pt-3 text-xs leading-relaxed text-muted">
                    {tier.note}
                  </p>
                </div>

                <div className="mt-6 pt-2">
                  <a
                    href="#inquire"
                    className={`flex h-10 w-full items-center justify-center rounded-xl text-xs font-semibold transition-colors ${
                      tier.popular
                        ? "bg-accent text-white hover:bg-[#104846]"
                        : "border border-line bg-paper text-ink hover:border-ink hover:bg-white"
                    }`}
                  >
                    Select this tier
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-line bg-paper/50 px-4 py-3 text-center text-xs text-muted">
            Rates are subject to seasonal schedule and host confirmation. Prices may adjust without prior notice.
          </div>
        </section>

        {/* Location & Directions Suite */}
        <section id="location" className="mt-20 scroll-mt-24" aria-labelledby="loc-heading">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
              04 / The Destination
            </span>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <h2 id="loc-heading" className="font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                Location & getting here
              </h2>
              <p className="max-w-md text-xs text-muted sm:text-right">
                Located in Limay, Bataan. Easy access from Manila via Bataan provincial roads.
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Arrival Information Card */}
            <div className="flex flex-col justify-between rounded-3xl border border-line bg-white/80 p-6 shadow-xs backdrop-blur-xs sm:p-8">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Exact Address
                </span>
                <p className="mt-2 font-display text-xl font-medium text-ink">
                  {p.address || "Hulo, Alangan, Limay, Bataan"}
                </p>

                <div className="mt-6 space-y-4 border-t border-line/70 pt-5 text-xs text-muted">
                  <div>
                    <span className="block font-medium text-ink">Parking on premises:</span>
                    <span>Private gated garage with ample space for two sedans or SUVs.</span>
                  </div>
                  <div>
                    <span className="block font-medium text-ink">Check-in process:</span>
                    <span>The host or caretaker will welcome your party upon arrival at the gate.</span>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4">
                <a
                  href={p.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-accent px-5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#104846]"
                >
                  Open in Google Maps for directions
                </a>
              </div>
            </div>

            {/* Embedded Google Maps Plate */}
            <div className="overflow-hidden rounded-3xl border border-line bg-white/70 p-2 shadow-xs lg:col-span-2">
              <iframe
                title={`Map showing ${p.name}`}
                loading="lazy"
                className="h-80 w-full rounded-2xl border-0 sm:h-96"
                src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
              />
            </div>
          </div>
        </section>

        {/* Reservation Suite */}
        <section id="inquire" className="mt-20 scroll-mt-24" aria-labelledby="inq-heading">
          <div className="grid gap-10 lg:grid-cols-12">
            {/* Left Column: Direct Host Booking Assurance */}
            <div className="flex flex-col justify-between lg:col-span-5">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-accent">
                  05 / Direct Reservation
                </span>
                <h2 id="inq-heading" className="mt-2 font-display text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                  Reserve directly with the host
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                  Book directly with zero third-party platform markups. Select your preferred dates and guest count to create a prefilled text inquiry or start a conversation on Facebook Messenger.
                </p>

                <div className="mt-8 space-y-4 rounded-3xl border border-line bg-white/70 p-6 backdrop-blur-xs">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      ✓
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-ink">Zero hidden cleaning fees</span>
                      <p className="text-[11px] text-muted">Transparent rate packages with full property access.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      ✓
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-ink">Direct host communication</span>
                      <p className="text-[11px] text-muted">Confirm specific timing, pool requests, and arrival logistics directly.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                      ✓
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-ink">Flexible guest capacity</span>
                      <p className="text-[11px] text-muted">From intimate 2-guest stays to larger groups of 10+.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t border-line/70 pt-6 text-xs text-muted">
                <span>Direct inquiries: </span>
                <a href={`tel:${p.contact.phone}`} className="font-medium text-ink underline underline-offset-4">
                  {p.contact.phone || "09524566669"}
                </a>
              </div>
            </div>

            {/* Right Column: Interactive Booking Card */}
            <div className="lg:col-span-7">
              <InquiryForm
                name={p.name}
                phone={p.contact.phone}
                messengerUrl={p.contact.messengerUrl}
              />
            </div>
          </div>
        </section>

        {/* Modern Minimalist Footer */}
        <footer className="mt-24 border-t border-line pt-10 pb-8 text-xs text-muted">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <span className="font-display text-base font-semibold text-ink">{p.name}</span>
              <p className="mt-0.5 text-[11px]">Hulo, Alangan, Limay, Bataan, Philippines</p>
            </div>
            <div className="flex items-center gap-6">
              <span className="font-mono text-[11px] text-muted">
                14.5340° N, 120.5875° E
              </span>
              <a href="#main" className="text-ink transition-colors hover:text-accent">
                Back to top ↑
              </a>
            </div>
          </div>
          <div className="mt-8 border-t border-line/50 pt-6 text-[11px] text-muted/80">
            © {new Date().getFullYear()} {p.name}. All rights reserved. Exclusive 22-hour staycation rental.
          </div>
        </footer>
      </main>
    </>
  );
}
