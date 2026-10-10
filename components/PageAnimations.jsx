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
        const headerTitle = document.querySelector(".stay-header h1");
        const headerMeta = document.querySelectorAll(".stay-category, .stay-tagline");
        const ctaBtn = document.querySelector(".availability-link");

        if (headerTitle) {
          animate(headerTitle, {
            opacity: [0, 1],
            translateY: [28, 0],
            duration: 950,
            ease: "outCubic",
          });
        }

        if (headerMeta.length > 0) {
          animate(headerMeta, {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 850,
            delay: stagger(120, { start: 150 }),
            ease: "outQuad",
          });
        }

        if (ctaBtn) {
          animate(ctaBtn, {
            opacity: [0, 1],
            scale: [0.94, 1],
            duration: 750,
            delay: 350,
            ease: "outQuad",
          });

          // Interactive hover feedback
          const handleEnter = () => animate(ctaBtn, { scale: 1.03, duration: 200, ease: "outQuad" });
          const handleLeave = () => animate(ctaBtn, { scale: 1, duration: 200, ease: "outQuad" });
          ctaBtn.addEventListener("mouseenter", handleEnter);
          ctaBtn.addEventListener("mouseleave", handleLeave);
        }

        // 2. Featured photo spread reveal
        const featuredPhotos = document.querySelectorAll(".photo-featured .photo-button");
        if (featuredPhotos.length > 0) {
          animate(featuredPhotos, {
            opacity: [0, 1],
            translateY: [32, 0],
            duration: 1000,
            delay: stagger(180, { start: 200 }),
            ease: "outCubic",
          });
        }

        // 3. Scroll reveal observer with staggered children
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const target = entry.target;

              // Animate container
              animate(target, {
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 750,
                ease: "outQuad",
              });

              // Stagger nested children
              if (target.matches("dl")) {
                const items = target.querySelectorAll("div");
                animate(items, {
                  opacity: [0, 1],
                  translateY: [14, 0],
                  duration: 650,
                  delay: stagger(90, { start: 100 }),
                  ease: "outQuad",
                });
              } else if (target.classList.contains("photo-more")) {
                const gridCards = target.querySelectorAll(".photo-details .photo-button");
                animate(gridCards, {
                  opacity: [0, 1],
                  translateY: [24, 0],
                  duration: 800,
                  delay: stagger(120, { start: 150 }),
                  ease: "outCubic",
                });
              } else if (target.querySelector("ul")) {
                const listItems = target.querySelectorAll("li");
                animate(listItems, {
                  opacity: [0, 1],
                  translateX: [-10, 0],
                  duration: 500,
                  delay: stagger(50, { start: 100 }),
                  ease: "outQuad",
                });
              }

              observer.unobserve(target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -30px 0px" }
        );

        const targets = document.querySelectorAll(
          ".photo-more, dl, section[aria-labelledby='rates-guide'], section.grid, section[aria-labelledby='loc'], section[aria-labelledby='inq']"
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
