import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PaymentLayout from "@/components/PaymentLayout";
import { property } from "@/lib/property";

export const metadata = { title: "Book your stay", description: "Choose your date and book a private 22-hour stay. Instant confirmation with a 50% deposit." };

export default function BookPage() {
  return <PaymentLayout><div className="booking-page-intro"><p className="section-label">A private stay in Limay</p><h1>Let’s plan your stay.</h1><p>Choose your check-in date and tell us who’s coming. Your dates are held automatically for 30 minutes while you complete your 50% deposit.</p><Link href="/" className="text-link">See the house and rates</Link></div><div className="booking-page-grid"><AvailabilityCalendar headingLevel={2} bookedDates={property.bookedDates} phone={property.contact.phone} messengerUrl={property.contact.messengerUrl} email={property.contact.email} /><div id="inquire"><BookingForm headingLevel={2} checkIn={property.checkIn} checkOut={property.checkOut} /></div></div></PaymentLayout>;
}
