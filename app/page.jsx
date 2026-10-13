import Link from "next/link";
import Image from "next/image";
import { property as p } from "@/lib/property";
import Navbar from "@/components/Navbar";
import HeroPhoto from "@/components/HeroPhoto";
import PhotoGallery from "@/components/PhotoGallery";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingForm from "@/components/BookingForm";
import TierSelectButton from "@/components/TierSelectButton";
import FadeContent from "@/components/react-bits/FadeContent";
import SpotlightCard from "@/components/react-bits/SpotlightCard";
import { getAmenityIcon } from "@/components/AmenityIcons";

const rateTiers = [
  {
    guests: "Up to 4 guests",
    count: 4,
    price: "₱5,000",
    note: "Perfect for couples or small families. Full exclusive access.",
    popular: false,
  },
  {
    guests: "5 to 6 guests",
    count: 6,
    price: "₱6,000",
    note: "Great for growing families or a tight-knit circle of friends.",
    popular: false,
  },
  {
    guests: "7 to 10 guests",
    count: 8,
    price: "₱8,000",
    note: "Same flat rate for groups of 7, 8, 9, or 10 guests.",
    popular: false,
  },
  {
    guests: "11 guests or more",
    count: 11,
    price: "From ₱8,500",
    note: "₱8,000 base plus ₱500 per additional guest for larger gatherings.",
    popular: false,
  },
];

const amenityDescriptions = {
  "Private swimming pool": "A swimming pool for your group's private use during your stay.",
  "Billiard table": "A billiard table included with your private rental.",
  "Outdoor grill": "An outdoor grill for preparing meals with your group.",
  "2 air-conditioned bedrooms": "Two bedrooms with air conditioning. Ask the host to confirm sleeping arrangements for your group.",
  "Kitchen with refrigerator and stove": "A kitchen with a refrigerator and stove for your stay.",
  "Wi-Fi": "Wi-Fi is included with your rental.",
  "Free parking for guests (fits two sedans)": "Guest parking with space for two sedans.",
};

const faqs = [
  {
    q: "Can we bring outside food and drinks?",
    a: "The property includes a kitchen with a refrigerator and stove, plus an outdoor grill. Ask the host about outside food and drinks before you book.",
  },
  {
    q: "Are pets allowed at the villa?",
    a: "Yes, The HauS 26 is pet-friendly! You are welcome to bring your well-behaved fur babies along.",
  },
  {
    q: "What are the check-in and check-out times?",
    a: "Standard check-in is at 11:00 AM, and check-out is at 9:00 AM the following morning for a full 22-hour private stay. Multiple days can also be selected.",
  },
  {
    q: "How does the deposit and payment work?",
    a: "Review your approved quote and the host's payment, cancellation, rescheduling, and refund terms before paying. Your date is reserved once the 50% deposit via GCash or Card is verified. The remaining balance is payable upon arrival.",
  },
  {
    q: "Where is The HauS 26 located?",
    a: "We are located in Hulo, Alangan, Limay, Bataan. Accessible via Roman Superhighway, with on-site parking for two vehicles.",
  },
];

export default function Page() {
  const { lat, lng } = p.coords;
  const instantBookingReady = true;

  return (
    <>
      <Navbar name={p.name} rate={p.rate} />
      <main id="main" className="site-shell">
        {/* Hero Section */}
        <section id="overview" className="stay-hero" aria-labelledby="hero-title">
          <div className="hero-title-block">
            <div className="hero-pill-badge">
              <span>🌴</span>
              <span>Limay, Bataan · Private Pool Staycation</span>
            </div>
            <h1 id="hero-title">Your Private Villa & Pool Escape in Bataan.</h1>
          </div>
          <HeroPhoto photo={p.photos[0]} />
          <div className="hero-copy">
            <p className="hero-intro">
              A house to yourselves. A private pool to dive into.
            </p>
            <p className="hero-description">
              Unwind in complete privacy. Stay for 22 exclusive hours with your own pool, billiard table, and outdoor grill for time with family and friends.
            </p>

            <div className="hero-feature-chips">
              <span className="hero-chip">🏊 Private Pool</span>
              <span className="hero-chip">🎱 Billiards Table</span>
              <span className="hero-chip">🥩 BBQ Grill</span>
              <span className="hero-chip">🐾 Pet-Friendly</span>
              <span className="hero-chip">🚗 Free Parking</span>
            </div>

            <div className="hero-actions">
              <a href="#calendar" className="button-primary">
                Check Dates & Book
              </a>
              <a href="#rates" className="button-secondary">
                View Rates (From ₱5,000)
              </a>
              <a href="#gallery" className="text-link">
                View all {p.photos.length} photos
              </a>
            </div>

            <dl className="hero-facts">
              <div>
                <dt>Stay Duration</dt>
                <dd>22 Hours</dd>
              </div>
              <div>
                <dt>Starting Rate</dt>
                <dd>{p.rate?.replace(/^From\s+/i, "") || "₱5,000"}</dd>
              </div>
              <div>
                <dt>Privacy</dt>
                <dd>100% Exclusive</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Photo Gallery */}
        <div className="gallery-spread">
          <PhotoGallery photos={p.photos} />
        </div>

        {/* Amenities Section */}
        <section id="amenities" className="amenities-section" aria-labelledby="amenities-heading">
          <FadeContent className="section-intro">
            <p className="section-label">Your Exclusive Space</p>
            <h2 id="amenities-heading">
              Everything you need<br />for a memorable stay.
            </h2>
            <p>
              The entire property, private pool, and amenities belong exclusively to your group throughout your 22-hour stay.
            </p>
          </FadeContent>

          <div className="amenities-details">
            <div className="amenities-cards-grid">
              {p.amenities.map((amenity) => {
                const IconComponent = getAmenityIcon(amenity);
                const description =
                  amenityDescriptions[amenity] ||
                  "Exclusive amenity included with your 22-hour private rental.";
                return (
                  <div key={amenity} className="amenity-card">
                    <div className="amenity-icon-wrapper">
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <h3>{amenity}</h3>
                    <p>{description}</p>
                  </div>
                );
              })}
            </div>

            <div className="stay-guidelines-box mt-6">
              <h3>
                <span>📋</span>
                <span>Stay Guidelines & House Rules</span>
              </h3>
              <ul>
                {p.rules.map((rule) => (
                  <li key={rule}>
                    <span>✓</span>
                    <span>{rule}</span>
                  </li>
                ))}
                <li>
                  <span>✓</span>
                  <span>Check-in: {p.checkIn} | Check-out: {p.checkOut}</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Rates Section */}
        <section id="rates" className="rates-section" aria-labelledby="rates-heading">
          <FadeContent className="section-heading">
            <div>
              <p className="section-label">Transparent Rates</p>
              <h2 id="rates-heading">Simple pricing for every group.</h2>
            </div>
            <p>
              All rates include exclusive 22-hour private use of the entire villa, pool, and amenities.
            </p>
          </FadeContent>

          <SpotlightCard
            className="rates-spotlight"
            theme="haus"
            intensity={0.2}
            spotlightSize={320}
            borderGlow={0}
            proximity={0}
            ambient={false}
            flare={false}
            grain={0}
          >
            <div className="rates-cards-grid">
              {rateTiers.map((tier) => (
                <div
                  className={`rate-tier-card ${tier.popular ? "is-popular" : ""}`}
                  key={tier.guests}
                >
                  {tier.badge && <span className="popular-badge">{tier.badge}</span>}
                  <div className="rate-card-header">
                    <h3>{tier.guests}</h3>
                    <p>{tier.note}</p>
                    <div className="rate-card-price">
                      <span className="rate-card-amount">{tier.price}</span>
                      <span className="rate-card-unit">/ 22 hrs</span>
                    </div>
                  </div>
                  <TierSelectButton
                    guests={tier.count}
                    label="Select Group Size"
                    className="rate-action"
                  />
                </div>
              ))}
            </div>
          </SpotlightCard>

          <div className="rate-note-box">
            <span className="text-xl">🔒</span>
            <div>
              <strong>Instant Booking:</strong> Submit your details to automatically hold your dates for 30 minutes and complete your 50% deposit via GCash or Card. Remaining balance is settled upon arrival.
            </div>
          </div>
        </section>

        {/* Calendar Section */}
        <section id="calendar" className="calendar-section" aria-labelledby="calendar-heading">
          <div className="section-intro">
            <p className="section-label">Availability</p>
            <h2 id="calendar-heading">
              Pick your preferred<br />stay dates.
            </h2>
            <p>
              Select your check-in and check-out dates. If the dates are available, submit your details to hold them and proceed directly to payment.
            </p>
          </div>
          <AvailabilityCalendar
            bookedDates={p.bookedDates || []}
            phone={p.contact.phone}
            messengerUrl={p.contact.messengerUrl}
            email={p.contact.email}
          />
        </section>

        {/* Location Section */}
        <section id="location" className="location-section" aria-labelledby="location-heading">
          <div className="location-copy">
            <FadeContent>
              <p className="section-label">Location & Directions</p>
              <h2 id="location-heading">Easy to reach in Limay.</h2>
              <p className="location-address">{p.address}</p>
              <dl className="arrival-details">
                <div>
                  <dt>Check-in</dt>
                  <dd>{p.checkIn}</dd>
                </div>
                <div>
                  <dt>Check-out</dt>
                  <dd>{p.checkOut}</dd>
                </div>
                <div>
                  <dt>Parking</dt>
                  <dd>Guest parking for two sedans</dd>
                </div>
              </dl>
            </FadeContent>
            <a
              href={p.mapsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Open directions in Google Maps →
            </a>
          </div>
          <div className="location-map">
            <iframe
              title={`Map showing ${p.name}`}
              loading="lazy"
              src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`}
            />
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="faq-section" aria-labelledby="faq-heading">
          <div className="section-intro">
            <p className="section-label">Common Questions</p>
            <h2 id="faq-heading">Good to know before you book.</h2>
            <p>
              Everything you need to know about planning your staycation at The HauS 26.
            </p>
          </div>
          <div className="faq-grid">
            {faqs.map((faq, idx) => (
              <div key={idx} className="faq-card">
                <h3>{faq.q}</h3>
                <p>{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Reservation Section */}
        <section id="reservation-section" className="reservation-section" aria-labelledby="reservation-heading">
          <div className="section-intro">
            <p className="section-label">Reserve Your Stay</p>
            <h2 id="reservation-heading">
              Ready to escape?<br />Reserve your date.
            </h2>
            <p>
              Send your stay dates, group count, and details below. Save your private booking link to review the quote, host's terms, and latest status before paying a deposit.
            </p>
            <p>
              Have a custom request or question first? Reach the host directly anytime:
            </p>
            <div className="contact-links">
              {p.contact.phone && (
                <a className="text-link" href={`tel:${p.contact.phone}`}>
                  📞 Call {p.contact.phone}
                </a>
              )}
              {p.contact.messengerUrl && (
                <a
                  className="text-link"
                  href={p.contact.messengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  💬 Message on Facebook
                </a>
              )}
              {p.contact.email && (
                <a className="text-link" href={`mailto:${p.contact.email}`}>
                  ✉️ Email {p.contact.email}
                </a>
              )}
              {p.contact.instagramUrl && (
                <a
                  className="text-link"
                  href={p.contact.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  📸 Instagram @{p.contact.instagram || "thehaus.26"}
                </a>
              )}
            </div>
          </div>
          <div id="inquire">
            <BookingForm
              checkIn={p.checkIn}
              checkOut={p.checkOut}
            maxGuests={p.maxGuests}
            bookingTerms={p.bookingTerms}
            />
          </div>
        </section>

        {/* Site Footer */}
        <footer className="site-footer">
          <div className="footer-main-grid">
            {/* Column 1: Brand & Identity */}
            <div className="footer-col footer-col-brand">
              <a href="#main" className="footer-brand" aria-label="The HauS 26 home">
                <div className="footer-brand-logo-frame">
                  <Image
                    src="/logo.png"
                    alt="The HauS 26 Logo"
                    width={48}
                    height={48}
                    className="footer-brand-logo-img"
                  />
                </div>
                <div className="footer-brand-title-wrap">
                  <span className="footer-brand-title">{p.name}</span>
                  <span className="footer-brand-subtitle">Private Pool Staycation · Bataan</span>
                </div>
              </a>
              <p className="footer-brand-desc">
                Exclusive 22-hour private pool staycation in Limay, Bataan. A relaxing retreat for family getaways, barkada gatherings, and intimate celebrations.
              </p>
              <div className="footer-social-chips">
                {p.contact.messengerUrl && (
                  <a
                    href={p.contact.messengerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-chip"
                  >
                    <span>💬</span>
                    <span>Facebook Messenger</span>
                  </a>
                )}
                {p.contact.instagramUrl && (
                  <a
                    href={p.contact.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-social-chip"
                  >
                    <span>📸</span>
                    <span>Instagram</span>
                  </a>
                )}
              </div>
            </div>

            {/* Column 2: Explore Villa */}
            <div className="footer-col">
              <h4>Explore Villa</h4>
              <nav className="footer-col-links" aria-label="Footer quick links">
                <a href="#gallery">The House & Pool Photos</a>
                <a href="#amenities">Amenities & Billiards</a>
                <a href="#rates">Group Rates (From ₱5,000)</a>
                <a href="#calendar">Availability Calendar</a>
                <a href="#location">Location & Directions</a>
                <a href="#faq">Staycation FAQ</a>
              </nav>
            </div>

            {/* Column 3: Stay Details */}
            <div className="footer-col">
              <h4>Stay Guidelines</h4>
              <ul className="footer-details-list">
                <li>
                  <span>Check-in</span>
                  <span>{p.checkIn}</span>
                </li>
                <li>
                  <span>Check-out</span>
                  <span>{p.checkOut}</span>
                </li>
                <li>
                  <span>Stay Duration</span>
                  <span>22 Hours</span>
                </li>
                <li>
                  <span>Corkage Fee</span>
                  <span>Free (Bring Food)</span>
                </li>
                <li>
                  <span>Pet Policy</span>
                  <span>Pets Welcome</span>
                </li>
                <li>
                  <span>Parking</span>
                  <span>Fits 2 Sedans</span>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact & Directions */}
            <div className="footer-col">
              <h4>Get in Touch</h4>
              <div className="footer-contact-info">
                {p.contact.phone && (
                  <a href={`tel:${p.contact.phone}`}>
                    <span>📞</span>
                    <span>{p.contact.phone}</span>
                  </a>
                )}
                {p.contact.email && (
                  <a href={`mailto:${p.contact.email}`}>
                    <span>✉️</span>
                    <span>{p.contact.email}</span>
                  </a>
                )}
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  📍 {p.address}
                </p>
                <a
                  href={p.mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link mt-1 text-xs"
                >
                  Open in Google Maps →
                </a>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="footer-bottom-bar">
            <p>
              © {new Date().getFullYear()} {p.name}. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link className="text-muted hover:text-accent transition-colors" href="/privacy">
                Privacy & Cookie Policy
              </Link>
              <span>·</span>
              <Link className="text-muted hover:text-accent transition-colors" href="/payment">
                Deposit & Booking Guide
              </Link>
            </div>
            <a href="#main" className="back-to-top-btn">
              Back to top ↑
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
