import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PaymentLayout from "@/components/PaymentLayout";
import { property } from "@/lib/property";

export const metadata = {
  title: "Book your stay",
  description: "Choose your stay dates and group size. Review your approved quote and host's terms before paying a 50% booking deposit.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/book" },
  openGraph: {
    title: "Book your stay | The HauS 26",
    description: "Choose your stay dates and group size. Review your approved quote and host's terms before paying a 50% booking deposit.",
    url: "/book",
  },
  twitter: {
    card: "summary",
    title: "Book your stay | The HauS 26",
    description: "Choose your stay dates and group size. Review your approved quote and host's terms before paying a 50% booking deposit.",
  },
};

export default function BookPage() {
  return (
    <PaymentLayout>
      <div className="booking-page-intro">
        <p className="section-label">Exclusive Staycation</p>
        <h1>Plan Your Private Stay.</h1>
        <p>
          Select your stay dates and group size, then send your request. Dates are held for 30 minutes only after your booking is approved for a deposit. Review your quote and the host's terms before paying.
        </p>
        <Link href="/" className="text-link">
          ← Back to villa overview & rates
        </Link>
      </div>
      <div className="booking-page-grid">
        <div id="calendar">
          <AvailabilityCalendar
            headingLevel={2}
            bookedDates={property.bookedDates}
            phone={property.contact.phone}
            messengerUrl={property.contact.messengerUrl}
            email={property.contact.email}
          />
        </div>
        <div id="inquire">
          <BookingForm
            headingLevel={2}
            checkIn={property.checkIn}
            checkOut={property.checkOut}
            maxGuests={property.maxGuests}
            bookingTerms={property.bookingTerms}
          />
        </div>
      </div>
    </PaymentLayout>
  );
}
