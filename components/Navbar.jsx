"use client";

import { useEffect, useRef, useState } from "react";

const NAV_LINKS = [
  { href: "#gallery", label: "Gallery" },
  { href: "#calendar", label: "Availability" },
  { href: "#amenities", label: "Amenities" },
  { href: "#rates", label: "Rates" },
  { href: "#location", label: "Location" },
];

export default function Navbar({ name, rate }) {
  const [scrolled, setScrolled] = useState(false);
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      setScrolled(currentY > 30);

      // On mobile: if scrolled down beyond the header and moving downward, hide completely!
      if (currentY > 40 && currentY > lastScrollY.current) {
        setHiddenOnMobile(true);
        setMobileMenuOpen(false); // dismiss menu if open when scrolling down
      } else {
        // Scrolling up or back at the top: smoothly reveal
        setHiddenOnMobile(false);
      }

      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header
      className={`sticky top-3.5 z-40 mx-auto w-full max-w-5xl px-3.5 transition-all duration-300 sm:px-6 ${
        hiddenOnMobile
          ? "-translate-y-24 opacity-0 pointer-events-none sm:translate-y-0 sm:opacity-100 sm:pointer-events-auto"
          : "translate-y-0 opacity-100"
      }`}
    >
      <nav
        aria-label="Main Navigation"
        className={`flex w-full items-center justify-between rounded-full border border-line bg-surface/90 px-3.5 py-2 backdrop-blur-md transition-all duration-300 sm:px-6 sm:py-2.5 ${
          scrolled ? "shadow-lg shadow-black/50 ring-1 ring-white/10" : "shadow-xs"
        }`}
      >
        {/* Brand Monogram */}
        <a href="#main" className="group flex items-center gap-2.5 text-left">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white shadow-[0_0_12px_rgba(2,132,199,0.35)] transition-transform group-hover:scale-105">
            26
          </span>
          <div className="flex flex-col">
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              {name}
            </span>
            <span className="hidden text-[10px] uppercase tracking-wider text-muted sm:inline">
              Limay, Bataan
            </span>
          </div>
        </a>

        {/* Desktop Quick Nav Links */}
        <div className="hidden items-center gap-6 text-xs font-medium tracking-wide text-muted sm:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Action Button & Mobile Menu Trigger */}
        <div className="flex items-center gap-2 sm:gap-3">
          {rate && (
            <span className="hidden font-display text-xs text-muted md:inline">
              {rate}
            </span>
          )}

          <a
            href="#inquire"
            className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-accent-hover active:scale-95"
          >
            Reserve stay
          </a>

          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink transition-colors hover:border-white/20 sm:hidden active:scale-95"
          >
            {mobileMenuOpen ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mt-2 flex flex-col gap-1 rounded-2xl border border-line bg-surface/95 p-3 shadow-xl backdrop-blur-md sm:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-ink transition-colors hover:bg-white/5 active:bg-accent/20 active:text-accent-glow"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
