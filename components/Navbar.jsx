"use client";
import { useEffect, useId, useRef, useState } from "react";

const links = [
  { href: "#gallery", label: "The house" },
  { href: "#amenities", label: "Amenities" },
  { href: "#rates", label: "Rates" },
  { href: "#location", label: "Getting here" },
];

export default function Navbar({ name, rate }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const menuButton = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event) {
      if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
  return (
    <>
      <header className="site-nav">
        <nav aria-label="Main navigation" className="nav-inner">
          <a href="#main" className="nav-brand" onClick={() => setOpen(false)}>{name}</a>
          <div className="desktop-links">{links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}</div>
          <a href="#calendar" className="nav-book button-primary">Choose your dates</a>
          <button type="button" className="menu-toggle" ref={menuButton} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
        </nav>
        {open && <div id={menuId} className="mobile-menu">{[...links, { href: "#calendar", label: "Choose your dates" }].map((link) => <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>)}</div>}
      </header>
      <div className="mobile-booking-bar" aria-label="Booking shortcut">
        <div><span>{rate || "Ask for a rate"}</span><small>22-hour private stay</small></div>
        <a href="#calendar" className="button-primary">Choose dates</a>
      </div>
    </>
  );
}
