"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef(null);
  const acknowledgeRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    try {
      const consent = localStorage.getItem("haus26_cookie_consent");
      if (!consent) {
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !open || !dialog) return;
    openerRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    acknowledgeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mounted, open]);

  function closeNotice() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setOpen(false);
    if (openerRef.current?.isConnected) openerRef.current.focus();
  }

  function acknowledgeNotice() {
    try {
      localStorage.setItem("haus26_cookie_consent", "essential_only");
    } catch {}
    window.dispatchEvent(new Event("haus26:cookie-notice-updated"));
    closeNotice();
  }

  if (!mounted || !open) return null;

  return (
    <dialog
      ref={dialogRef}
      className="cookie-popup-card"
      aria-labelledby="cookie-popup-title"
      aria-describedby="cookie-popup-description"
      onClose={closeNotice}
      onCancel={(event) => { event.preventDefault(); closeNotice(); }}
      onClick={(event) => { if (event.target === dialogRef.current) closeNotice(); }}
    >
        <div className="cookie-popup-header">
          <span className="section-label">Privacy & Transparency</span>
          <h2 id="cookie-popup-title" className="cookie-popup-title">
            Essential Cookies & Storage
          </h2>
        </div>
        <p id="cookie-popup-description" className="cookie-popup-desc">
          This site remembers this notice in your browser and uses a session cookie for host administration. We do not add advertising pixels or optional analytics cookies.
        </p>
        <p className="cookie-popup-desc" style={{ marginTop: "0.35rem", fontSize: "0.8125rem" }}>
          Embedded Google Maps and PayMongo checkout are third-party services with their own privacy practices. Booking form details stay on the current page for retries and are not saved in browser storage.
        </p>
        <div className="cookie-popup-actions">
          <button
            type="button"
            ref={acknowledgeRef}
            onClick={acknowledgeNotice}
            className="button-primary"
            style={{ flex: "1", minWidth: "140px" }}
          >
            Got it
          </button>
          <button
            type="button"
            onClick={closeNotice}
            className="booking-secondary"
            style={{ flex: "1", minWidth: "140px" }}
          >
            Close
          </button>
        </div>
        <div className="cookie-popup-footer">
          <Link
            href="/privacy"
            onClick={closeNotice}
            style={{ color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "3px" }}
          >
            Read our full Privacy & Cookie Policy →
          </Link>
        </div>
    </dialog>
  );
}
