"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const password = new FormData(event.currentTarget).get("password");
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "Sign-in failed. Please check your host password.");
      }
      router.replace("/admin");
      router.refresh();
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "We could not reach the sign-in service. Please check your network connection."
          : failure.message
      );
      setPending(false);
    }
  }

  return (
    <section className="admin-login">
      <span className="section-label">Private Host Workspace</span>
      <h1>Host Command Center</h1>
      <p>Sign in with your private host password to review guest inquiries, manage quotes, and track deposits.</p>
      <form onSubmit={submit} aria-busy={pending}>
        <div className="booking-field">
          <label htmlFor="host-password">Host Password</label>
          <div style={{ position: "relative" }}>
            <input
              id="host-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={256}
              disabled={pending}
              autoFocus
              style={{ width: "100%", paddingRight: "3.5rem" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                fontSize: "0.75rem",
                color: "var(--color-muted)",
                cursor: "pointer",
                padding: "0.25rem 0.5rem",
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        {error && <div className="admin-toast-feedback is-error" role="alert">{error}</div>}
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? "Authenticating…" : "Enter Host Dashboard"}
        </button>
      </form>
    </section>
  );
}
