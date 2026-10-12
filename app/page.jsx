import Link from "next/link";
import { property as p } from "@/lib/property";
import Navbar from "@/components/Navbar";
import HeroPhoto from "@/components/HeroPhoto";
import PhotoGallery from "@/components/PhotoGallery";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import BookingForm from "@/components/BookingForm";
import TierSelectButton from "@/components/TierSelectButton";

const rateTiers = [
  { guests: "Up to 4 guests", count: 4, price: "₱5,000", note: "Minimum rate, including stays for 2 to 4 guests." },
  { guests: "5 to 6 guests", count: 6, price: "₱6,000", note: "Your group has the whole property to itself." },
  { guests: "7 to 10 guests", count: 8, price: "₱8,000", note: "The same rate for groups of 7, 8, 9, or 10." },
  { guests: "11 guests or more", count: 11, price: "From ₱8,500", note: "₱8,000 base plus ₱500 per additional guest." },
];

export default function Page() {
  const { lat, lng } = p.coords;
  return (
    <>
      <Navbar name={p.name} rate={p.rate} />
      <main id="main" className="site-shell">
        <section id="overview" className="stay-hero" aria-labelledby="hero-title">
          <div className="hero-title-block">
            <p className="hero-location">Limay, Bataan · Private pool stay</p>
            <h1 id="hero-title">{p.name}</h1>
          </div>
          <HeroPhoto photo={p.photos[0]} />
          <div className="hero-copy">
            <p className="hero-intro">A house to yourselves.<br />A little time by the pool.</p>
            <p className="hero-description">{p.tagline}. Stay for 22 hours with your own pool, a game of billiards, and room to spend time together.</p>
            <div className="hero-actions">
              <a href="#calendar" className="button-primary">Choose your dates</a>
              <a href="#gallery" className="text-link">View all {p.photos.length} photos</a>
            </div>
            <dl className="hero-facts">
              <div><dt>Private stay</dt><dd>22 hours</dd></div>
              <div><dt>Starting rate</dt><dd>{p.rate?.replace(/^From\s+/i, "") || "Ask the host"}</dd></div>
            </dl>
          </div>
        </section>
        <div className="gallery-spread"><PhotoGallery photos={p.photos} /></div>
        <section id="amenities" className="amenities-section" aria-labelledby="amenities-heading">
          <div className="section-intro">
            <p className="section-label">Make yourself at home</p>
            <h2 id="amenities-heading">Your own space,<br />inside and out.</h2>
            <p>The property and its amenities are exclusive to your group throughout your 22-hour stay.</p>
          </div>
          <div className="amenities-details">
            <ul className="amenities-list">{p.amenities.map((amenity) => <li key={amenity}>{amenity}</li>)}</ul>
            <div className="house-rules"><h3>A few house rules</h3><ul>{p.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul></div>
          </div>
        </section>
        <section id="rates" className="rates-section" aria-labelledby="rates-heading">
          <div className="section-heading">
            <div><p className="section-label">Bring your people</p><h2 id="rates-heading">A stay for your group.</h2></div>
            <p>Rates cover a 22-hour stay with private use of the property.</p>
          </div>
          <div className="rates-list">{rateTiers.map((tier) => (
            <div className="rate-row" key={tier.guests}>
              <div><h3>{tier.guests}</h3><p>{tier.note}</p></div>
              <div className="rate-price"><span>{tier.price}</span>{tier.count < 11 && <span className="rate-duration">/ 22 hours</span>}</div>
              <TierSelectButton guests={tier.count} label="Choose this group" />
            </div>
          ))}</div>
          <p className="rate-note">Instant booking: dates are held for 30 minutes upon reservation for your 50% deposit. Multiple days available: select your stay duration in the booking form and prices multiply per day.</p>
        </section>
        <section id="calendar" className="calendar-section" aria-labelledby="calendar-heading">
          <div className="section-intro">
            <p className="section-label">Find a day to get away</p>
            <h2 id="calendar-heading">When would you<br />like to stay?</h2>
            <p>Choose your check-in date. The calendar checks availability and holds your dates for 30 minutes while you complete your deposit.</p>
          </div>
          <AvailabilityCalendar bookedDates={p.bookedDates || []} phone={p.contact.phone} messengerUrl={p.contact.messengerUrl} email={p.contact.email} />
        </section>
        <section id="location" className="location-section" aria-labelledby="location-heading">
          <div className="location-copy">
            <p className="section-label">Meet us in Bataan</p>
            <h2 id="location-heading">A place in Limay.</h2>
            <p className="location-address">{p.address}</p>
            <dl className="arrival-details">
              <div><dt>Check-in</dt><dd>{p.checkIn}</dd></div>
              <div><dt>Check-out</dt><dd>{p.checkOut}</dd></div>
              <div><dt>Parking</dt><dd>Space for two sedans</dd></div>
            </dl>
            <a href={p.mapsLink} target="_blank" rel="noopener noreferrer" className="text-link">Get directions on Google Maps</a>
          </div>
          <div className="location-map"><iframe title={`Map showing ${p.name}`} loading="lazy" src={`https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`} /></div>
        </section>
        <section id="reservation-section" className="reservation-section" aria-labelledby="reservation-heading">
          <div className="section-intro">
            <p className="section-label">Request a private stay</p>
            <h2 id="reservation-heading">Let’s plan<br />your stay.</h2>
            <p>Send your preferred date, group size, and contact details here. You’ll receive a private link to track your request.</p>
            <p>Your date is held automatically for 30 minutes while you complete your 50% deposit through PayMongo to confirm your stay.</p>
            <p>Have a question first? Contact the host directly.</p>
            <a href="/payment" className="text-link">How the booking deposit works</a>
            <div className="contact-links">
              {p.contact.phone && <a className="text-link" href={`tel:${p.contact.phone}`}>Call {p.contact.phone}</a>}
              {p.contact.messengerUrl && <a className="text-link" href={p.contact.messengerUrl} target="_blank" rel="noopener noreferrer">Message on Facebook</a>}
              {p.contact.email && <a className="text-link" href={`mailto:${p.contact.email}`}>Email {p.contact.email}</a>}
              {p.contact.instagramUrl && (
                <a className="text-link" href={p.contact.instagramUrl} target="_blank" rel="noopener noreferrer">
                  Instagram @{p.contact.instagram || "thehaus.26"}
                </a>
              )}
            </div>
          </div>
          <div id="inquire">
            <BookingForm
              checkIn={p.checkIn}
              checkOut={p.checkOut}
            />
          </div>
        </section>
        <footer className="site-footer">
          <div><a href="#main" className="footer-brand">{p.name}</a><p>{p.address}</p></div>
          <div className="footer-contact">
            {p.contact.phone && <a className="text-link" href={`tel:${p.contact.phone}`}>Call {p.contact.phone}</a>}
            {p.contact.email && <a className="text-link" href={`mailto:${p.contact.email}`}>{p.contact.email}</a>}
            {p.contact.instagramUrl && (
              <a className="text-link" href={p.contact.instagramUrl} target="_blank" rel="noopener noreferrer">
                Instagram @{p.contact.instagram || "thehaus.26"}
              </a>
            )}
            <Link className="text-link" href="/privacy">
              Privacy & Cookie Policy
            </Link>
          </div>
          <a href="#main" className="text-link">Back to top</a>
          <p className="footer-copyright">© {new Date().getFullYear()} {p.name}</p>
        </footer>
      </main>
    </>
  );
}
