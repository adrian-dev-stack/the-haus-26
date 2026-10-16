"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const links = [
  { href: "/#gallery", label: "The Villa" },
  { href: "/#amenities", label: "Amenities" },
  { href: "/#rates", label: "Rates" },
  { href: "/#location", label: "Location" },
  { href: "/#faq", label: "FAQ" },
  { href: "/payment", label: "Deposit guide" },
];

export default function Navbar({ name, rate }) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const menuId = useId();
  const menuButton = useRef(null);

  useEffect(() => {
    let last = typeof window !== "undefined" ? window.scrollY : 0;
    function onScroll() {
      if (open) return;
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) > 1.5) {
        const down = dy > 0;
        setHidden(down && y > 36);
        last = y;
      }
      if (y < 20) {
        setHidden(false);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

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
      <header className={`site-nav ${hidden ? "off" : ""}`}>
        <nav aria-label="Main navigation" className="nav-inner">
          <Link href="/" className="nav-brand" onClick={() => setOpen(false)}>
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
            <span>{name}</span>
          </Link>
          <div className="desktop-links">
            {links.map((link) => (
              <Link href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
          <Link href="/book" className="nav-book button-primary">
            Book your stay
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
              Book your stay
            </Link>
          </div>
        )}
      </header>
      <div className={`mobile-booking-bar ${hidden ? "off" : ""}`} aria-label="Booking shortcut">
        <div>
          <span>{rate || "From ₱5,000"}</span>
          <small>22-hour private stay</small>
        </div>
        <Link href="/book" className="button-primary">
          Book your stay
        </Link>
      </div>
    </>
  );
}
