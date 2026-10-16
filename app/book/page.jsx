import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PaymentLayout from "@/components/PaymentLayout";
import { property } from "@/lib/property";

export const metadata = {
  title: "Book your stay",
  description: "Instant booking: Choose your stay dates and group size. Available dates are held immediately for 30 minutes to complete your 50% deposit via PayMongo.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/book" },
  openGraph: {
    title: "Book your stay | The HauS 26",
    description: "Instant booking: Choose your stay dates and group size. Available dates are held immediately for 30 minutes to complete your 50% deposit via PayMongo.",
    url: "/book",
  },
  twitter: {
    card: "summary",
    title: "Book your stay | The HauS 26",
    description: "Instant booking: Choose your stay dates and group size. Available dates are held immediately for 30 minutes to complete your 50% deposit via PayMongo.",
  },
};

export default function BookPage() {
  return (
    <PaymentLayout>
      <div className="booking-page-intro">
        <p className="section-label">Exclusive Staycation</p>
        <h1>Plan Your Private Stay.</h1>
        <p>
          Select your stay dates and group size. If the dates are available, they will be held immediately for 30 minutes so you can proceed directly to pay your 50% deposit.
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
            dayVisitorCapacity={property.dayVisitorCapacity}
            bookingTerms={property.bookingTerms}
          />
        </div>
      </div>
    </PaymentLayout>
  );
}
