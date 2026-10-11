import Link from "next/link";
import { property } from "@/lib/property";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host bookings", robots: { index: false, follow: false, noarchive: true } };

export default function AdminLayout({ children }) {
  return <><header className="payment-header"><Link href="/" className="nav-brand">{property.name}</Link><span className="admin-header-label">Host bookings</span></header><main id="main" className="admin-shell">{children}</main></>;
}
