"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    const password = new FormData(event.currentTarget).get("password");
    setPending(true); setError("");
    try {
      const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Sign-in failed. Please try again.");
      router.replace("/admin"); router.refresh();
    } catch (failure) { setError(failure instanceof TypeError ? "We could not reach the sign-in service. Please try again." : failure.message); setPending(false); }
  }
  return <section className="booking-panel admin-login"><p className="section-label">Private host access</p><h1>Manage your bookings.</h1><p>Sign in to review requests and prepare booking deposits.</p><form onSubmit={submit} aria-busy={pending}><div className="booking-field"><label htmlFor="host-password">Host password</label><input id="host-password" name="password" type="password" autoComplete="current-password" required maxLength={256} disabled={pending} /></div>{error && <p className="booking-error" role="alert">{error}</p>}<button type="submit" className="button-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></form></section>;
}
