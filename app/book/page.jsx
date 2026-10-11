import Link from "next/link";
import BookingForm from "@/components/BookingForm";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import PaymentLayout from "@/components/PaymentLayout";
import { property } from "@/lib/property";

export const metadata = { title: "Request a stay", description: "Choose your date and request a private 22-hour stay. The host approves your quote before a 50% booking deposit." };

export default function BookPage() {
  return <PaymentLayout><div className="booking-page-intro"><p className="section-label">A private stay in Limay</p><h1>Let’s plan your stay.</h1><p>Choose a check-in date and tell us who’s coming. The host confirms availability and your final quote before you pay a 50% deposit.</p><Link href="/" className="text-link">See the house and rates</Link></div><div className="booking-page-grid"><AvailabilityCalendar headingLevel={2} bookedDates={property.bookedDates} phone={property.contact.phone} messengerUrl={property.contact.messengerUrl} email={property.contact.email} /><div id="inquire"><BookingForm headingLevel={2} checkIn={property.checkIn} checkOut={property.checkOut} /></div></div></PaymentLayout>;
}
