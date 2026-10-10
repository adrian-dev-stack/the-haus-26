"use client";

import { useEffect } from "react";

export default function PageAnimations() {
  useEffect(() => {
    // Respect reduced motion preferences immediately
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let observer;
    let cancelled = false;

    // Dynamically load animejs on client
    import("animejs")
      .then((animeModule) => {
        if (cancelled) return;

        const animate = animeModule.animate;
        const stagger = animeModule.stagger;

        if (typeof animate !== "function") return;

        // 1. Subtle, crisp hero entrance without hiding content upfront
        const headerTitle = document.querySelector("#hero-title");
        const headerBadges = document.querySelectorAll(".hero-badge");
        const ctaBtns = document.querySelectorAll(".hero-cta-btn");

        if (headerTitle) {
          animate(headerTitle, {
            opacity: [0.3, 1],
            translateY: [16, 0],
            duration: 650,
            ease: "outCubic",
          });
        }

        if (headerBadges.length > 0) {
          animate(headerBadges, {
            opacity: [0, 1],
            translateY: [10, 0],
            duration: 500,
            delay: stagger(60, { start: 150 }),
            ease: "outQuad",
          });
        }

        if (ctaBtns.length > 0) {
          animate(ctaBtns, {
            opacity: [0, 1],
            scale: [0.97, 1],
            duration: 500,
            delay: stagger(80, { start: 250 }),
            ease: "outQuad",
          });
        }

        // 2. Progressive scroll reveal for sections (only for elements below the viewport)
        const targets = document.querySelectorAll(
          "#calendar, #specs, #amenities, #rates, #location, #inquire"
        );

        if ("IntersectionObserver" in window) {
          observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const target = entry.target;

                animate(target, {
                  opacity: [0.4, 1],
                  translateY: [18, 0],
                  duration: 600,
                  ease: "outCubic",
                });

                observer.unobserve(target);
              });
            },
            { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
          );

          targets.forEach((el) => {
            const rect = el.getBoundingClientRect();
            // Only observe if element is substantially below current viewport
            if (rect.top > window.innerHeight * 0.85) {
              el.style.opacity = "0.4";
              observer.observe(el);
            }
          });
        }
      })
      .catch((err) => {
        console.warn("Animation deferred:", err);
      });

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, []);

  return null;
}
