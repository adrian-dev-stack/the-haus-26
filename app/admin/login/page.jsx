import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/booking-auth";
import AdminLogin from "@/components/AdminLogin";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return <AdminLogin />;
}
