"use client";

import { useEffect, useRef } from "react";

export default function ScrollProgress() {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    const root = document.scrollingElement || document.documentElement;
    if (!element) return;
    let frame = null;

    function update() {
      frame = null;
      const range = root.scrollHeight - root.clientHeight;
      const progress = range > 0 ? Math.min(1, Math.max(0, root.scrollTop / range)) : 0;
      element.style.transform = `scaleX(${progress})`;
    }

    function requestUpdate() {
      if (frame === null) frame = window.requestAnimationFrame(update);
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    window.addEventListener("pageshow", requestUpdate);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(requestUpdate) : null;
    observer?.observe(document.documentElement);
    if (document.body) observer?.observe(document.body);
    update();

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      window.removeEventListener("pageshow", requestUpdate);
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={ref} className="scroll-progress" aria-hidden="true" />;
}
