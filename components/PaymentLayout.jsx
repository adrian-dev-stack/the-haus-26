import Link from "next/link";
import Image from "next/image";
import { property } from "@/lib/property";

export default function PaymentLayout({ children }) {
  return (
    <>
      <header className="payment-header">
        <Link href="/" className="nav-brand">
          <div className="nav-brand-logo-frame">
            <Image
              src="/logo.png"
              alt="The HauS 26 Logo"
              width={38}
              height={38}
              className="nav-brand-logo-img"
              priority
            />
          </div>
          <span>{property.name}</span>
        </Link>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/privacy" className="text-link">Privacy & Policy</Link>
          <Link href="/payment" className="text-link">Deposit guide</Link>
          <Link href="/#inquire" className="text-link">Contact the host</Link>
        </div>
      </header>
      <main id="main" className="payment-shell">{children}</main>
      <footer className="payment-footer">
        <p>{property.name} · Limay, Bataan</p>
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/privacy" className="text-link">Privacy & Cookies</Link>
          <Link href="/" className="text-link">Back to the house</Link>
        </div>
      </footer>
    </>
  );
}
