"use client";

// Adapted from React Bits by David Haz; license in THIRD_PARTY_NOTICES.md.
import { useEffect, useRef } from "react";

export default function FadeContent({ children, className = "", duration = 600, threshold = 0.12 }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!element || preference.matches) return;
    let disposed = false;
    let context;
    let trigger;

    function revealImmediately() {
      trigger?.kill();
      context?.revert();
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
    }
    const onPreference = (event) => { if (event.matches) revealImmediately(); };
    preference.addEventListener("change", onPreference);

    async function prepare() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (disposed || preference.matches) return;
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.set(element, { opacity: 0.15, y: 28 });
        const timeline = gsap.timeline({ paused: true }).to(element, {
          opacity: 1, y: 0, duration: duration / 1000, ease: "power2.out", clearProps: "opacity,transform",
        });
        trigger = ScrollTrigger.create({ trigger: element, start: `top ${(1 - threshold) * 100}%`, once: true,
          onEnter: () => timeline.play() });
        element.addEventListener("focusin", revealImmediately, { once: true });
      }, element);
    }
    prepare().catch(revealImmediately);
    return () => {
      disposed = true;
      preference.removeEventListener("change", onPreference);
      element.removeEventListener("focusin", revealImmediately);
      trigger?.kill();
      context?.revert();
    };
  }, [duration, threshold]);

  return <div ref={ref} className={`bits-fade ${className}`}>{children}</div>;
}
