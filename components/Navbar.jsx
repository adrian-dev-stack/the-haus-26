"use client";

import { useEffect, useState } from "react";

export default function Navbar({ name, rate }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-5xl px-4 transition-all duration-300">
      <nav
        aria-label="Main Navigation"
        className={`flex items-center justify-between rounded-full border border-line bg-paper/90 px-4 py-2.5 backdrop-blur-md transition-all duration-300 sm:px-6 ${
          scrolled ? "shadow-md ring-1 ring-black/5" : "shadow-xs"
        }`}
      >
        {/* Brand Monogram */}
        <a href="#main" className="group flex items-center gap-2.5 text-left">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white transition-transform group-hover:scale-105">
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
          <a href="#gallery" className="transition-colors hover:text-ink">
            Gallery
          </a>
          <a href="#calendar" className="transition-colors hover:text-ink">
            Availability
          </a>
          <a href="#amenities" className="transition-colors hover:text-ink">
            Amenities
          </a>
          <a href="#rates" className="transition-colors hover:text-ink">
            Rates
          </a>
          <a href="#location" className="transition-colors hover:text-ink">
            Location
          </a>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          {rate && (
            <span className="hidden font-display text-xs text-muted md:inline">
              {rate}
            </span>
          )}
          <a
            href="#inquire"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#104846] active:scale-95"
          >
            Reserve stay
          </a>
        </div>
      </nav>
    </header>
  );
}
