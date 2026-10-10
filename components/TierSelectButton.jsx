"use client";

export default function TierSelectButton({ guests, popular }) {
  function handleClick() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("haus26:select-guests", { detail: { guests } })
      );
    }
  }

  return (
    <a
      href="#inquire"
      onClick={handleClick}
      className={`flex h-10 w-full items-center justify-center rounded-xl text-xs font-semibold transition-all active:scale-95 ${
        popular
          ? "bg-accent text-white hover:bg-accent-hover shadow-[0_0_16px_rgba(2,132,199,0.3)]"
          : "border border-line bg-surface-elevated text-ink hover:border-white/20 hover:bg-surface-hover"
      }`}
    >
      Select this tier
    </a>
  );
}
