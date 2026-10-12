import Link from "next/link";
import Image from "next/image";
import { property } from "@/lib/property";

export const dynamic = "force-dynamic";
export const metadata = { title: "Host Dashboard | The HauS 26", robots: { index: false, follow: false, noarchive: true } };

export default function AdminLayout({ children }) {
  return (
    <div className="admin-app-root">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div className="admin-topbar-left">
            <Link href="/" className="admin-brand">
              <div className="nav-brand-logo-frame" style={{ width: 32, height: 32, borderRadius: 8 }}>
                <Image
                  src="/logo.png"
                  alt="The HauS 26 Logo"
                  width={32}
                  height={32}
                  className="nav-brand-logo-img"
                  priority
                />
              </div>
              <span className="admin-brand-name">{property.name}</span>
              <span className="admin-brand-badge">Host Workspace</span>
            </Link>
          </div>
          <div className="admin-topbar-actions">
            <Link href="/" className="admin-nav-link" target="_blank" rel="noopener noreferrer">
              View Public Site ↗
            </Link>
            <Link href="/book" className="admin-nav-link" target="_blank" rel="noopener noreferrer">
              Public Booking Form ↗
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="admin-main-container">
        {children}
      </main>
    </div>
  );
}
