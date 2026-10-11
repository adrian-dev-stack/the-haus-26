import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/booking-auth";
import BookingAdmin from "@/components/BookingAdmin";

export default async function AdminPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  return <BookingAdmin />;
}
