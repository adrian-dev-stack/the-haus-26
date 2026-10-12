"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const consent = localStorage.getItem("haus26_cookie_consent");
      if (!consent) {
        // Pop up automatically for visitors who have not chosen yet
        const timer = setTimeout(() => setOpen(true), 350);
        return () => clearTimeout(timer);
      }
    } catch {
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    function reopen() {
      setOpen(true);
    }
    window.addEventListener("haus26:open-cookie-preferences", reopen);
    return () => window.removeEventListener("haus26:open-cookie-preferences", reopen);
  }, []);

  function handleChoice(preference) {
    try {
      localStorage.setItem("haus26_cookie_consent", preference);
    } catch {}
    setOpen(false);
  }

  if (!mounted || !open) return null;

  return (
    <div
      className="cookie-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-popup-title"
    >
      <div className="cookie-popup-card">
        <div className="cookie-popup-header">
          <span className="section-label">Privacy & Transparency</span>
          <h2 id="cookie-popup-title" className="cookie-popup-title">
            Cookie & Privacy Preferences
          </h2>
        </div>
        <p className="cookie-popup-desc">
          We use cookies and browser storage to process reservation requests, hold dates, and provide secure PayMongo payments. We do not use third-party advertising or cross-site tracking cookies.
        </p>
        <p className="cookie-popup-desc" style={{ marginTop: "0.35rem", fontSize: "0.8125rem" }}>
          Please choose whether to allow cookies during your visit or restrict storage to strictly essential features.
        </p>
        <div className="cookie-popup-actions">
          <button
            type="button"
            onClick={() => handleChoice("allowed")}
            className="button-primary"
            style={{ flex: "1", minWidth: "140px" }}
          >
            Allow Cookies
          </button>
          <button
            type="button"
            onClick={() => handleChoice("essential_only")}
            className="booking-secondary"
            style={{ flex: "1", minWidth: "140px" }}
          >
            Don't Use Cookies
          </button>
        </div>
        <div className="cookie-popup-footer">
          <Link
            href="/privacy"
            onClick={() => setOpen(false)}
            style={{ color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            Read our full Privacy & Cookie Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}
