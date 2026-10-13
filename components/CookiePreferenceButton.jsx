"use client";

import { useEffect, useState } from "react";

export default function CookiePreferenceButton() {
  const [consent, setConsent] = useState(null);

  useEffect(() => {
    function readConsent() {
      try {
        const stored = localStorage.getItem("haus26_cookie_consent");
        setConsent(stored || "not_set");
      } catch {
        setConsent("not_set");
      }
    }
    readConsent();

    function onStorage() {
      readConsent();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("haus26:cookie-notice-updated", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("haus26:cookie-notice-updated", onStorage);
    };
  }, []);

  function handleReopen() {
    window.dispatchEvent(new CustomEvent("haus26:open-cookie-preferences"));
  }

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: "8px",
        padding: "1.25rem",
        marginTop: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              color: "var(--color-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
            }}
          >
            Essential Site Storage
          </span>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.9375rem", fontWeight: 500 }}>
            {(consent === "allowed" || consent === "essential_only") && "Storage notice acknowledged. This site uses essential storage only."}
            {consent === "not_set" && "This site uses essential storage only. Notice not yet acknowledged."}
            {consent === null && "Checking browser storage..."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleReopen}
          className="button-primary"
          style={{ minHeight: "42px", padding: "0.5rem 1.15rem", fontSize: "0.875rem" }}
        >
          View storage notice
        </button>
      </div>
    </div>
  );
}
