"use client";

import { useEffect } from "react";

export default function PageAnimations() {
  useEffect(() => {
    // Respect reduced motion preferences
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let observer;
    let cancelled = false;

    // Dynamically import Anime.js only on the client inside useEffect
    import("animejs")
      .then((anime) => {
        if (cancelled) return;

        const animate = anime.animate;
        const stagger = anime.stagger;

        if (typeof animate !== "function") return;

        // 1. Header entrance with staggered typography
        const headerTitle = document.querySelector("#hero-title");
        const headerMeta = document.querySelectorAll(".stay-header span, .stay-header p");
        const ctaBtns = document.querySelectorAll(".stay-header a");

        if (headerTitle) {
          animate(headerTitle, {
            opacity: [0, 1],
            translateY: [24, 0],
            duration: 900,
            ease: "outCubic",
          });
        }

        if (headerMeta.length > 0) {
          animate(headerMeta, {
            opacity: [0, 1],
            translateY: [16, 0],
            duration: 800,
            delay: stagger(100, { start: 100 }),
            ease: "outQuad",
          });
        }

        if (ctaBtns.length > 0) {
          animate(ctaBtns, {
            opacity: [0, 1],
            scale: [0.96, 1],
            duration: 700,
            delay: stagger(120, { start: 250 }),
            ease: "outQuad",
          });
        }

        // 2. Bento gallery tiles reveal
        const bentoPhotos = document.querySelectorAll(".gallery-bento-item");
        if (bentoPhotos.length > 0) {
          animate(bentoPhotos, {
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 850,
            delay: stagger(100, { start: 200 }),
            ease: "outCubic",
          });
        }

        // 3. Scroll reveal observer with staggered children
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target;

              // Animate section container
              animate(target, {
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 700,
                ease: "outQuad",
              });

              // Stagger children depending on section type
              if (target.id === "specs") {
                const specItems = target.querySelectorAll("dl > div");
                animate(specItems, {
                  opacity: [0, 1],
                  translateY: [16, 0],
                  duration: 600,
                  delay: stagger(80, { start: 100 }),
                  ease: "outQuad",
                });
              } else if (target.id === "amenities") {
                const cards = target.querySelectorAll(".grid > div");
                animate(cards, {
                  opacity: [0, 1],
                  translateY: [20, 0],
                  duration: 700,
                  delay: stagger(100, { start: 100 }),
                  ease: "outCubic",
                });
              } else if (target.id === "rates") {
                const tierCards = target.querySelectorAll(".grid > div");
                animate(tierCards, {
                  opacity: [0, 1],
                  translateY: [20, 0],
                  duration: 700,
                  delay: stagger(90, { start: 100 }),
                  ease: "outCubic",
                });
              } else if (target.classList.contains("photo-more")) {
                const gridCards = target.querySelectorAll(".photo-details .photo-button");
                animate(gridCards, {
                  opacity: [0, 1],
                  translateY: [24, 0],
                  duration: 750,
                  delay: stagger(100, { start: 100 }),
                  ease: "outCubic",
                });
              }

              observer.unobserve(target);
            });
          },
          { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
        );

        const targets = document.querySelectorAll(
          ".photo-more, #calendar, #specs, #amenities, #rates, #location, #inquire"
        );

        targets.forEach((el) => {
          el.style.opacity = "0";
          observer.observe(el);
        });
      })
      .catch((err) => {
        console.warn("Anime.js loading deferred:", err);
      });

    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
    };
  }, []);

  return null;
}
