"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("haus26_cookie_consent");
      if (!consent) {
        const timer = setTimeout(() => setVisible(true), 700);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  function handleAccept() {
    try {
      localStorage.setItem("haus26_cookie_consent", "accepted");
    } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <aside
      className="cookie-banner"
      role="region"
      aria-label="Cookie and Privacy Notice"
    >
      <div className="cookie-banner-text">
        <p style={{ margin: 0 }}>
          We use essential cookies and local storage to manage reservations and secure PayMongo checkouts. We do not use third-party advertising trackers. Learn more in our{" "}
          <Link href="/privacy" style={{ color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "3px" }}>
            Privacy & Cookie Policy
          </Link>.
        </p>
      </div>
      <div className="cookie-banner-actions">
        <button
          type="button"
          onClick={handleAccept}
          className="button-primary"
          style={{ minHeight: "38px", padding: "0.4rem 1.1rem", fontSize: "0.8125rem" }}
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
