import BookingStatus from "@/components/BookingStatus";
import PaymentLayout from "@/components/PaymentLayout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your booking", robots: { index: false, follow: false, noarchive: true } };

export default async function BookingPage({ params }) {
  const { token } = await params;
  return <PaymentLayout><BookingStatus token={token} /></PaymentLayout>;
}
