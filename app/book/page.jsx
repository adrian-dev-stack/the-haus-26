import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PaymentLayout from "@/components/PaymentLayout";
import { property } from "@/lib/property";

export const metadata = {
  title: "Book your stay",
  description: "Choose your date and book a private 22-hour stay. Instant confirmation with a 50% deposit.",
};

export default function BookPage() {
  return (
    <PaymentLayout>
      <div className="booking-page-intro">
        <p className="section-label">Exclusive Staycation</p>
        <h1>Plan Your Private Stay.</h1>
        <p>
          Select your preferred stay dates and group size. Your reservation is held automatically for 30 minutes while you complete your 50% deposit via GCash or Card.
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
          />
        </div>
      </div>
    </PaymentLayout>
  );
}
