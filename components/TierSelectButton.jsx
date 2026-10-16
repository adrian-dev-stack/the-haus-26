"use client";

export default function TierSelectButton({ guests, label = "Select tier & choose dates", className = "rate-action" }) {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("haus26:select-guests", { detail: { guests } }));
  }
  return (
    <a
      href="#calendar"
      onClick={handleClick}
      className={className}
      aria-label={`${label}: ${guests >= 11 ? "11 or more" : guests} guests`}
    >
      {label}
    </a>
  );
}
