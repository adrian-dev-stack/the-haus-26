"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";

const links = [
  { href: "/#gallery", label: "The house" },
  { href: "/#amenities", label: "Amenities" },
  { href: "/#rates", label: "Rates" },
  { href: "/#location", label: "Getting here" },
  { href: "/payment", label: "Deposit guide" },
  { href: "/privacy", label: "Privacy & Policy" },
];

export default function Navbar({ name, rate }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header className="site-nav">
        <nav aria-label="Main navigation" className="nav-inner">
          <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
            {name}
          </Link>
          <div className="desktop-links">
            {links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/book" className="nav-book button-primary">
            Request to book
          </Link>
          <button
            type="button"
            className="menu-toggle"
            ref={menuButton}
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </nav>
        {open && (
          <div id={menuId} className="mobile-menu">
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/book" onClick={() => setOpen(false)} style={{ color: "var(--color-accent)", fontWeight: 600 }}>
              Book a stay →
            </Link>
          </div>
        )}
      </header>
      <div className="mobile-booking-bar" aria-label="Booking shortcut">
        <div>
          <span>{rate || "From ₱5,000"}</span>
          <small>22-hour private stay</small>
        </div>
        <Link href="/book" className="button-primary">
          Request to book
        </Link>
      </div>
    </>
  );
}
