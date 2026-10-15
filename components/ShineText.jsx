"use client";

import React from "react";
import "./ShineText.css";

/**
 * ShineText Component
 * Sweeps a fluid light gradient across typography on an infinite loop with organic pause intervals.
 */
export default function ShineText({
  children,
  as: Component = "span",
  className = "",
  variant = "gold", // "gold" | "emerald" | "radiant" | "snippet"
  duration = "3.8s",
  style,
  ...rest
}) {
  return (
    <Component
      className={`shine-sweep shine-sweep--${variant} ${className}`.trim()}
      style={{
        animationDuration: duration,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}
