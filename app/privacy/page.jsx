import Link from "next/link";
import { property } from "@/lib/property";
import Navbar from "@/components/Navbar";
import CookiePreferenceButton from "@/components/CookiePreferenceButton";

export const metadata = {
  title: "Privacy & Cookie Policy",
  description:
    "How The HauS 26 uses booking contact details, essential browser storage, and third-party payment and notification services.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy & Cookie Policy | The HauS 26",
    description: "How we use booking contact details and essential browser storage.",
    url: "/privacy",
  },
  twitter: {
    card: "summary",
    title: "Privacy & Cookie Policy | The HauS 26",
    description: "How we use booking contact details and essential browser storage.",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar name={property.name} rate={property.rate} />

      <main id="main" className="policy-shell">
        <div className="policy-header">
          <span className="section-label">Legal & Data Protection</span>
          <h1>Privacy & Cookie Policy</h1>
          <p className="policy-meta">
            Effective Date: October 2026 · Compliant with Republic Act No. 10173 (Philippine Data Privacy Act of 2012)
          </p>
        </div>

        <div className="policy-body">
          <section className="policy-section">
            <h2>1. Introduction & Commitment</h2>
            <p>
              At <strong>{property.name}</strong>, we respect your privacy and are committed to protecting your personal data. This Privacy & Cookie Policy explains how we collect, process, and safeguard information provided by visitors and guests when interacting with our website (<strong>thehaus26.com</strong>), submitting reservation requests, and completing booking deposits.
            </p>
            <p>
              Our data processing practices adhere strictly to the provisions of Republic Act No. 10173, also known as the <strong>Data Privacy Act of 2012 (DPA)</strong>, and the regulations issued by the National Privacy Commission (NPC) of the Philippines.
            </p>
          </section>

          <section className="policy-section">
            <h2>2. Information We Collect</h2>
            <p>
              When you submit a reservation inquiry or interact with our booking platform, we collect only the minimum necessary personal data required to arrange your stay:
            </p>
            <ul>
              <li><strong>Contact Information:</strong> Your full name, email address, and mobile phone number.</li>
              <li><strong>Stay Details:</strong> Requested check-in date, number of guests, occasion (e.g. family staycation, birthday), and special arrival requests or questions.</li>
              <li><strong>Transaction Reference:</strong> Unique booking reference code (e.g., H26-XXXXXX), payment status, and agreed rental terms.</li>
            </ul>
            <div className="policy-box">
              <h3>What We Never Collect or Store</h3>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-muted)" }}>
                We <strong>never</strong> collect, process, or store your credit or debit card numbers, CVVs, bank account login credentials, or GCash MPINs. All payment transactions are handled exclusively through certified third-party payment providers.
              </p>
            </div>
          </section>

          <section className="policy-section">
            <h2>3. How We Use Your Information</h2>
            <p>We process your personal information strictly for legitimate hospitality purposes:</p>
            <ul>
              <li>To evaluate date availability and confirm reservation requests.</li>
              <li>To provide agreed quotes and terms for your 22-hour private rental (11:00 AM check-in to 9:00 AM next day check-out).</li>
              <li>To send private links allowing you to track booking status and complete your 50% deposit.</li>
              <li>To facilitate check-in coordination, arrival directions, and on-site hospitality in Limay, Bataan.</li>
              <li>To record the remaining 50% balance settled upon arrival.</li>
            </ul>
            <p>
              We <strong>never sell, lease, or trade</strong> your personal information to marketing firms, advertising networks, or unauthorized third parties.
            </p>
            <p>
              When booking notifications are enabled, we use <strong>Resend</strong> to send confirmation emails and <strong>UniSMS</strong> to send confirmation text messages. These providers receive the recipient email address or mobile number and the booking details included in the message. The host also receives an email alert for a verified booking deposit. We use these notifications to service your booking. During testing, messages go only to the host's configured test inbox and phone.
            </p>
          </section>

          <section className="policy-section">
            <h2>4. Secure Payment Processing via PayMongo</h2>
            <p>
              To confirm reservations, guests settle a 50% booking deposit. Online deposit processing is conducted through <strong>PayMongo</strong> (PayMongo Payments, Inc.), an authorized payment gateway licensed and regulated by the Bangko Sentral ng Pilipinas (BSP) and certified under the Payment Card Industry Data Security Standard (PCI-DSS Level 1).
            </p>
            <p>
              When you proceed to payment, you are redirected to PayMongo's encrypted checkout environment. Your financial information is handled in accordance with PayMongo's strict security protocols and privacy standards.
            </p>
          </section>

          <section className="policy-section">
            <h2>5. Cookie & Storage Policy</h2>
            <p>
              We believe in transparent, minimal data practices. Our website uses only <strong>essential cookies and local browser storage</strong> necessary for core functions:
            </p>
            <ul>
              <li>
                <strong>Security & Session Cookies:</strong> Signed, HTTP-only session cookies used for authorized host administration.
              </li>
              <li>
                <strong>Notice Acknowledgement:</strong> Local browser storage retains your acknowledgement of the storage notice (<code>haus26_cookie_consent</code>) so it is not repeatedly displayed. Booking form details and the original request reference stay in the current page's memory for retries; they are not persisted in browser storage and are lost when you reload or close the page.
              </li>
              <li>
                <strong>No Optional Site Tracking:</strong> We do not add advertising pixels or optional analytics cookies. Embedded Google Maps and PayMongo checkout are third-party services with their own privacy and storage practices.
              </li>
            </ul>
            <p>
              The site uses essential storage only, so this notice does not offer an optional cookie setting. You can view the notice again below and manage stored site data through your browser settings:
            </p>
            <CookiePreferenceButton />
          </section>

          <section className="policy-section">
            <h2>6. Data Retention & Security Measures</h2>
            <p>
              We implement industry-standard physical, organizational, and technological safeguards to protect personal data against loss, unauthorized access, alteration, or disclosure:
            </p>
            <ul>
              <li>All web traffic between your device and our servers is secured via 256-bit Transport Layer Security (TLS/HTTPS).</li>
              <li>Booking databases use parameterized queries and cryptographic hashing to prevent data leaks.</li>
              <li>Reservation data is retained only for as long as required to service your booking and satisfy legal, accounting, or administrative obligations under Philippine law.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>7. Your Rights Under Philippine Law</h2>
            <p>
              Under the Data Privacy Act of 2012, you possess clear rights regarding your personal information:
            </p>
            <ul>
              <li><strong>Right to be Informed:</strong> To understand how your personal data is collected and processed.</li>
              <li><strong>Right to Access:</strong> To request a summary of the personal information we hold regarding your bookings.</li>
              <li><strong>Right to Rectification:</strong> To correct inaccurate or outdated contact information.</li>
              <li><strong>Right to Erasure or Blocking:</strong> To request the deletion of your personal records once your stay is concluded and legal retention periods have elapsed.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>8. Contacting the Host / Privacy Inquiries</h2>
            <p>
              If you have any questions regarding this Privacy & Cookie Policy, wish to exercise your data subject rights, or need assistance regarding your reservation data, please contact our team directly:
            </p>
            <div className="policy-box">
              <p style={{ margin: 0, fontWeight: 600 }}>{property.name}</p>
              <p style={{ margin: "0.25rem 0", color: "var(--color-muted)" }}>{property.address}</p>
              <p style={{ margin: "0.25rem 0" }}>
                Mobile: <a href={`tel:${property.contact.phone}`} className="text-link" style={{ minHeight: "auto" }}>{property.contact.phone}</a>
              </p>
              <p style={{ margin: "0.25rem 0" }}>
                Email: <a href={`mailto:${property.contact.email}`} className="text-link" style={{ minHeight: "auto" }}>{property.contact.email}</a>
              </p>
            </div>
          </section>
        </div>

        <footer style={{ marginTop: "4rem", paddingTop: "2rem", borderTop: "1px solid var(--color-divider)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-muted)" }}>
            © {new Date().getFullYear()} {property.name}. All rights reserved.
          </p>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <Link href="/" className="text-link">
              Home
            </Link>
            <Link href="/book" className="text-link">
              Book a Stay
            </Link>
            <a href="#main" className="text-link">
              Back to top ↑
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
