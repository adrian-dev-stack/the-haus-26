"use client";

export default function TierSelectButton({ guests, label = "Select this tier", className = "rate-action" }) {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("haus26:select-guests", { detail: { guests } }));
  }
  return (
    <a
      href="#inquire"
      onClick={handleClick}
      className={className}
      aria-label={`${label}: ${guests >= 11 ? "11 or more" : guests} guests`}
    >
      {label}
    </a>
  );
}
