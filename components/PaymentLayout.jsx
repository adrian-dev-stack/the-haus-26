import Link from "next/link";
import { property } from "@/lib/property";

export default function PaymentLayout({ children }) {
  return (
    <>
      <header className="payment-header">
        <Link href="/" className="nav-brand">{property.name}</Link>
        <Link href="/#inquire" className="text-link">Contact the host</Link>
      </header>
      <main id="main" className="payment-shell">{children}</main>
      <footer className="payment-footer">
        <p>{property.name} · Limay, Bataan</p>
        <Link href="/" className="text-link">Back to the house</Link>
      </footer>
    </>
  );
}
