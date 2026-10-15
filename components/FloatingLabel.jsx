"use client";

import React from "react";

/**
 * FloatingLabel component
 * Adapted from UI floating label pattern for The HauS 26
 */
export default function FloatingLabel({
  label,
  children,
  className = "",
  isTextarea = false,
  hasValue = false,
  htmlFor,
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`floating-field ${isTextarea ? "floating-textarea" : ""} ${hasValue ? "has-value" : ""} ${className}`.trim()}
    >
      {children}
      <span>{label}</span>
    </label>
  );
}
