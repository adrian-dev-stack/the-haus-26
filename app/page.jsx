import { property as p } from "@/lib/property";
import Navbar from "@/components/Navbar";
import HeroPhoto from "@/components/HeroPhoto";
import PhotoGallery from "@/components/PhotoGallery";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import InquiryForm from "@/components/InquiryForm";
import TierSelectButton from "@/components/TierSelectButton";

const rateTiers = [
  { guests: "Up to 4 guests", count: 4, price: "₱5,000", note: "Minimum rate, including stays for 2 guests." },
  { guests: "6 guests", count: 6, price: "₱7,000", note: "Your group has the whole property to itself." },
  { guests: "8 to 10 guests", count: 8, price: "₱8,000", note: "The same rate for groups of 8, 9, or 10." },
  { guests: "11 guests or more", count: 11, price: "Ask for a quote", note: "An additional fee per guest applies." },
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
              <TierSelectButton guests={tier.count} label={tier.count < 11 ? "Choose this group" : "Ask the host"} />
            </div>
          ))}</div>
          <p className="rate-note">For 5 or 7 guests, ask the host to confirm the rate. Rates are subject to change without prior notice.</p>
        </section>
        <section id="calendar" className="calendar-section" aria-labelledby="calendar-heading">
          <div className="section-intro">
            <p className="section-label">Find a day to get away</p>
            <h2 id="calendar-heading">When would you<br />like to stay?</h2>
            <p>Choose a preferred date to add to your inquiry. The host will confirm availability before your stay is booked.</p>
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
            <p className="section-label">Start with a hello</p>
            <h2 id="reservation-heading">Let’s plan<br />your stay.</h2>
            <p>Add your dates and group size, then send your inquiry via SMS, Messenger, Instagram, or email.</p>
            <p>The host confirms your date, rate, and arrival details directly. Sending an inquiry does not make a reservation.</p>
            <div className="contact-links">
              {p.contact.phone && <a className="text-link" href={`tel:${p.contact.phone}`}>Call {p.contact.phone}</a>}
              {p.contact.email && <a className="text-link" href={`mailto:${p.contact.email}`}>Email {p.contact.email}</a>}
              {p.contact.instagramUrl && (
                <a className="text-link" href={p.contact.instagramUrl} target="_blank" rel="noopener noreferrer">
                  Instagram @{p.contact.instagram || "thehaus.26"}
                </a>
              )}
            </div>
          </div>
          <div id="inquire">
            <InquiryForm
              name={p.name}
              phone={p.contact.phone}
              messengerUrl={p.contact.messengerUrl}
              email={p.contact.email}
              instagramUrl={p.contact.instagramUrl}
              instagram={p.contact.instagram}
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
          </div>
          <a href="#main" className="text-link">Back to top</a>
          <p className="footer-copyright">© {new Date().getFullYear()} {p.name}</p>
        </footer>
      </main>
    </>
  );
}
