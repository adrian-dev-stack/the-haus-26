"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import "./MagneticButton.css";

/**
 * MagneticButton
 * A tactile, physics-based interactive button that pulls towards the cursor with spring dynamics
 * and inner label parallax depth.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  as: ComponentProp,
  className = "",
  variant = "primary", // "primary" | "gold" | "snippet" | "light" | "secondary"
  pull = 0.38,
  stiffness = 0.14,
  damping = 0.76,
  labelParallax = 0.55,
  showCursor = false,
  autoDemo = false,
  target,
  rel,
  type = "button",
  disabled = false,
  style,
  ...rest
}) {
  const zoneRef = useRef(null);
  const btnRef = useRef(null);
  const lbRef = useRef(null);
  const curRef = useRef(null);

  useEffect(() => {
    const zone = zoneRef.current;
    const btn = btnRef.current;
    const lb = lbRef.current;
    const cur = curRef.current;
    if (!zone || !btn || !lb) return;

    // Respect reduced-motion and touch / coarse pointers
    const motionPref = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerPref = window.matchMedia("(pointer: coarse)");
    if (motionPref.matches || pointerPref.matches) return;

    let real = false;
    let px = 0;
    let py = 0;
    let t = 0;
    const s = { x: 0, y: 0, vx: 0, vy: 0 };
    let rafId = null;
    let running = false;

    const startLoop = () => {
      if (!running) {
        running = true;
        rafId = requestAnimationFrame(frame);
      }
    };

    const onPointerEnter = (e) => {
      real = true;
      zone.classList.add("is-real");
      const r = zone.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      startLoop();
    };

    const onPointerLeave = () => {
      real = false;
      zone.classList.remove("is-real");
      // Loop continues running to spring back to origin, then halts
      startLoop();
    };

    const onPointerMove = (e) => {
      const r = zone.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      startLoop();
    };

    zone.addEventListener("pointerenter", onPointerEnter);
    zone.addEventListener("pointerleave", onPointerLeave);
    zone.addEventListener("pointermove", onPointerMove);

    const frame = () => {
      if (!zone.isConnected) return;

      const w = zone.clientWidth;
      const h = zone.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      if (!real) {
        if (autoDemo) {
          t += 0.016;
          px = cx + w * 0.4 * Math.cos(t);
          py = cy + h * 0.26 * Math.sin(t);
        } else {
          px = cx;
          py = cy;
        }
      }

      const dx = px - cx;
      const dy = py - cy;
      const near = real ? true : (autoDemo ? Math.hypot(dx, dy) < Math.max(80, w * 0.3) : false);
      const tx = near ? dx * pull : 0;
      const ty = near ? dy * pull : 0;

      s.vx += (tx - s.x) * stiffness;
      s.vy += (ty - s.y) * stiffness;
      s.vx *= damping;
      s.vy *= damping;
      s.x += s.vx;
      s.y += s.vy;

      btn.style.transform = "translate(" + s.x.toFixed(2) + "px," + s.y.toFixed(2) + "px)";
      lb.style.transform = "translate(" + (s.x * labelParallax).toFixed(2) + "px," + (s.y * labelParallax).toFixed(2) + "px)";

      if (cur) {
        cur.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
      }

      // If mouse is away and spring is settled, stop RAF loop to preserve CPU
      if (
        !real &&
        !autoDemo &&
        Math.abs(s.x) < 0.05 &&
        Math.abs(s.y) < 0.05 &&
        Math.abs(s.vx) < 0.02 &&
        Math.abs(s.vy) < 0.02
      ) {
        btn.style.transform = "";
        lb.style.transform = "";
        s.x = 0;
        s.y = 0;
        s.vx = 0;
        s.vy = 0;
        running = false;
        return;
      }

      rafId = requestAnimationFrame(frame);
    };

    if (autoDemo) {
      startLoop();
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      zone.removeEventListener("pointerenter", onPointerEnter);
      zone.removeEventListener("pointerleave", onPointerLeave);
      zone.removeEventListener("pointermove", onPointerMove);
    };
  }, [autoDemo, damping, labelParallax, pull, stiffness]);

  const buttonClasses = `magnetic-btn magnetic-btn--${variant} ${className}`.trim();

  const content = (
    <>
      <span ref={lbRef} className="magnetic-btn-label">
        {children}
      </span>
      {showCursor && <i ref={curRef} className="magnetic-cur" aria-hidden="true" />}
    </>
  );

  let element = null;

  if (ComponentProp) {
    const Custom = ComponentProp;
    element = (
      <Custom
        ref={btnRef}
        href={href}
        onClick={onClick}
        className={buttonClasses}
        target={target}
        rel={rel}
        disabled={disabled}
        style={style}
        {...rest}
      >
        {content}
      </Custom>
    );
  } else if (href) {
    if (href.startsWith("/") && !href.startsWith("//")) {
      element = (
        <Link
          ref={btnRef}
          href={href}
          onClick={onClick}
          className={buttonClasses}
          target={target}
          rel={rel}
          style={style}
          {...rest}
        >
          {content}
        </Link>
      );
    } else {
      element = (
        <a
          ref={btnRef}
          href={href}
          onClick={onClick}
          className={buttonClasses}
          target={target}
          rel={rel}
          style={style}
          {...rest}
        >
          {content}
        </a>
      );
    }
  } else {
    element = (
      <button
        ref={btnRef}
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={buttonClasses}
        style={style}
        {...rest}
      >
        {content}
      </button>
    );
  }

  return (
    <div ref={zoneRef} className={`magnetic-zone magnetic-zone--${variant}`}>
      {element}
    </div>
  );
}
