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
  const lastScrollY = useRef(0);

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

  useEffect(() => {
    const motionPref = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPref.matches) return;

    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || window.pageYOffset || 0;
        const dy = y - lastScrollY.current;

        if (open) {
          setHidden(false);
          lastScrollY.current = y;
          ticking = false;
          return;
        }

        if (y < 24) {
          setHidden(false);
        } else if (Math.abs(dy) > 2) {
          const down = dy > 0;
          setHidden(down && y > 60);
        }

        lastScrollY.current = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <>
      <header
        className={`site-nav ${hidden && !open ? "off" : ""}`}
        onFocus={() => setHidden(false)}
      >
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
