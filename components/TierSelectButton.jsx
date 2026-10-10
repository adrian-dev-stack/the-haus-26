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
          ? "bg-accent text-white hover:bg-[#104846] shadow-xs"
          : "border border-line bg-paper text-ink hover:border-ink hover:bg-white"
      }`}
    >
      Select this tier
    </a>
  );
}
