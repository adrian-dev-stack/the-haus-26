"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_LABELS = {
  requested: "New Request",
  awaiting_payment: "Awaiting Deposit",
  confirmed: "Confirmed",
  test_paid: "Test Payment",
  cancelled: "Cancelled",
  declined: "Declined",
  payment_issue: "Payment Review",
  refunded: "Refunded",
};

const STATUS_CLASSES = {
  requested: "badge-requested",
  awaiting_payment: "badge-awaiting",
  confirmed: "badge-confirmed",
  test_paid: "badge-confirmed",
  cancelled: "badge-cancelled",
  declined: "badge-cancelled",
  payment_issue: "badge-awaiting",
  refunded: "badge-cancelled",
};

const money = (amount) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format((amount || 0) / 100);

const stayDate = (date) => {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeZone: "Asia/Manila",
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00Z`));
  } catch {
    return date;
  }
};

function suggestedRate(guests) {
  const g = Number(guests) || 1;
  if (g <= 4) return 5000;
  if (g <= 6) return 6000;
  if (g <= 10) return 8000;
  return 8000 + (g - 10) * 500;
}

const DEFAULT_TERMS =
  "50% deposit via PayMongo holds the reservation. Remaining 50% balance payable upon check-in. Check-in 11:00 AM - 1:00 PM, 22-hour stay. Quiet hours begin at 10:00 PM.";

function BookingEntry({ booking, onChanged, onUnauthorized }) {
  const prefix = useId();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [quoteTotal, setQuoteTotal] = useState(
    booking.totalAmount ? String(booking.totalAmount / 100) : String(suggestedRate(booking.guests))
  );
  const [quoteTerms, setQuoteTerms] = useState(booking.terms || DEFAULT_TERMS);

  const isRequested = booking.status === "requested";
  const isAwaiting = booking.status === "awaiting_payment";
  const isConfirmed = booking.status === "confirmed" || booking.status === "test_paid";
  const canCancel = isRequested || isAwaiting;
  const hasQuote = Number.isSafeInteger(booking.totalAmount) && booking.totalAmount > 0;

  async function action(payload) {
    if (pending) return;
    setPending(payload.action);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(booking.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || "This booking could not be updated. Please try again.");
      }
      setNotice(
        payload.action === "confirm"
          ? "Quote approved and saved. Share the guest link so they can complete their deposit."
          : payload.action === "refresh"
          ? "PayMongo deposit status refreshed."
          : payload.action === "mark_balance_paid"
          ? payload.paid === false
            ? "Remaining balance reset to unpaid."
            : "Remaining balance recorded as paid on arrival."
          : "Booking cancelled successfully."
      );
      onChanged(result.data.booking);
    } catch (failure) {
      setError(
        failure instanceof TypeError
          ? "We could not reach the booking service. Please retry."
          : failure.message
      );
    } finally {
      setPending("");
    }
  }

  function handleConfirm(event) {
    event.preventDefault();
    action({ action: "confirm", total: quoteTotal, terms: quoteTerms });
  }

  function handleCancel(event) {
    event.preventDefault();
    const reason = new FormData(event.currentTarget).get("reason");
    action({ action: "cancel", reason });
  }

  async function copyGuestLink() {
    try {
      const fullUrl = new URL(booking.guestUrl, window.location.origin).href;
      await navigator.clipboard.writeText(fullUrl);
      setCopyMessage("Guest link copied to clipboard. Send it directly to the guest.");
      setTimeout(() => setCopyMessage(""), 4000);
    } catch {
      setCopyMessage("Please copy the booking address directly from your browser address bar.");
    }
  }

  const initials = (booking.name || "G")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const balanceAmount = hasQuote ? booking.totalAmount - (booking.depositAmount || 0) : 0;

  return (
    <article
      className={`admin-booking-card status-${booking.status}`}
      aria-busy={!!pending}
    >
      <div className="admin-card-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
            <span className="admin-ref-tag">{booking.reference}</span>
            <span className={`admin-badge ${STATUS_CLASSES[booking.status] || "badge-requested"}`}>
              {STATUS_LABELS[booking.status] || "Review"}
            </span>
            {booking.livemode === false && <span className="admin-badge badge-test">Test Mode</span>}
          </div>
          <h2 className="admin-stay-title">{stayDate(booking.date)}</h2>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--color-muted)" }}>
            {booking.guests} {booking.guests === 1 ? "guest" : "guests"} · 22-hour private rental
          </p>
        </div>

        {booking.guestUrl && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button type="button" className="booking-secondary" onClick={copyGuestLink} style={{ minHeight: "36px", padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}>
              Copy Guest Link
            </button>
            <Link
              href={booking.guestUrl}
              className="booking-secondary"
              target="_blank"
              rel="noopener noreferrer"
              style={{ minHeight: "36px", padding: "0.25rem 0.75rem", fontSize: "0.8125rem", textDecoration: "none" }}
            >
              Open Guest Page ↗
            </Link>
          </div>
        )}
      </div>

      <div className="admin-card-grid">
        <div className="admin-profile-section">
          <h3>Guest Profile</h3>
          <div className="admin-guest-header">
            <div className="admin-avatar">{initials}</div>
            <div>
              <div className="admin-guest-name">{booking.name}</div>
              <div className="admin-guest-quicklinks">
                <a href={`tel:${booking.phone}`}>{booking.phone}</a>
                <span>·</span>
                <a href={`mailto:${booking.email}`}>{booking.email}</a>
              </div>
            </div>
          </div>

          <dl className="admin-meta-list">
            <div className="admin-meta-row">
              <dt>Party Size</dt>
              <dd>{booking.guests} guests</dd>
            </div>
            {booking.occasion && (
              <div className="admin-meta-row">
                <dt>Occasion</dt>
                <dd>{booking.occasion}</dd>
              </div>
            )}
            <div className="admin-meta-row">
              <dt>Stay Date</dt>
              <dd>{booking.date}</dd>
            </div>
            <div className="admin-meta-row">
              <dt>Created</dt>
              <dd>{new Date(booking.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</dd>
            </div>
          </dl>

          {booking.notes && (
            <div className="admin-note-bubble">
              <strong>Guest Notes & Questions</strong>
              {booking.notes}
            </div>
          )}

          {booking.terms && (
            <div className="admin-note-bubble" style={{ marginTop: "0.75rem" }}>
              <strong>Agreed Terms</strong>
              {booking.terms}
            </div>
          )}

          {copyMessage && (
            <div className="admin-toast-feedback is-success" role="status">
              {copyMessage}
            </div>
          )}
        </div>

        <div className="admin-action-section">
          <h3>Financials & Actions</h3>

          {hasQuote ? (
            <div className="admin-finance-box">
              <h4>Reservation Financials</h4>
              <div className="admin-finance-rows">
                <div className="admin-finance-row">
                  <dt>Confirmed Total</dt>
                  <dd>{money(booking.totalAmount)}</dd>
                </div>
                <div className="admin-finance-row">
                  <dt>50% Deposit ({booking.paymentStatus || "pending"})</dt>
                  <dd style={{ color: isConfirmed ? "#2e7d32" : "inherit" }}>
                    {money(booking.depositAmount)}
                  </dd>
                </div>
                <div className="admin-finance-row" style={{ paddingTop: "0.25rem", borderTop: "1px dashed var(--color-divider)" }}>
                  <dt>50% Balance on Arrival</dt>
                  <dd>
                    {money(balanceAmount)}
                    {booking.balancePaidAt && (
                      <span style={{ display: "block", fontSize: "0.75rem", color: "#2e7d32", fontWeight: 500 }}>
                        Paid ({booking.balanceMethod || "Cash"})
                      </span>
                    )}
                  </dd>
                </div>
              </div>
            </div>
          ) : (
            <div className="admin-finance-box">
              <h4>Suggested Pricing</h4>
              <p style={{ margin: "0.25rem 0", fontSize: "0.875rem", color: "var(--color-muted)" }}>
                Standard rate for {booking.guests} guests is <strong>₱{suggestedRate(booking.guests).toLocaleString()}</strong>.
              </p>
            </div>
          )}

          <div className="admin-action-controls">
            {isRequested && (
              <form onSubmit={handleConfirm} className="admin-confirm-form">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Approve Quote & Hold Date</span>
                  <button
                    type="button"
                    className="admin-preset-btn"
                    onClick={() => {
                      setQuoteTotal(String(suggestedRate(booking.guests)));
                      setQuoteTerms(DEFAULT_TERMS);
                    }}
                  >
                    Reset standard rate (₱{suggestedRate(booking.guests).toLocaleString()})
                  </button>
                </div>

                <fieldset disabled={!!pending}>
                  <div>
                    <label htmlFor={`${prefix}-total`}>Confirmed Total (PHP)</label>
                    <input
                      id={`${prefix}-total`}
                      type="number"
                      inputMode="decimal"
                      min="2"
                      step="0.02"
                      required
                      value={quoteTotal}
                      onChange={(e) => setQuoteTotal(e.target.value)}
                    />
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                      Guest pays 50% deposit (₱{quoteTotal ? (Number(quoteTotal) / 2).toLocaleString() : "0"}) via PayMongo.
                    </p>
                  </div>

                  <div>
                    <label htmlFor={`${prefix}-terms`}>Agreed Terms & Conditions</label>
                    <textarea
                      id={`${prefix}-terms`}
                      rows={3}
                      minLength={10}
                      maxLength={2000}
                      required
                      value={quoteTerms}
                      onChange={(e) => setQuoteTerms(e.target.value)}
                    />
                  </div>
                </fieldset>

                <button className="button-primary" type="submit" disabled={!!pending} style={{ width: "100%", marginTop: "0.5rem" }}>
                  {pending === "confirm" ? "Preparing Deposit Link…" : "Approve & Create Deposit"}
                </button>
              </form>
            )}

            {isAwaiting && !booking.paymentToken && (
              <div style={{ padding: "0.875rem", background: "var(--color-surface-elevated)", borderRadius: "6px" }}>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-muted)" }}>
                  Quote is approved. Resume checkout setup to generate guest deposit token.
                </p>
                <button
                  type="button"
                  className="button-primary"
                  disabled={!!pending}
                  onClick={() => action({ action: "confirm", total: String(booking.totalAmount / 100), terms: booking.terms })}
                  style={{ marginTop: "0.5rem" }}
                >
                  {pending === "confirm" ? "Preparing Deposit…" : "Retry Deposit Setup"}
                </button>
              </div>
            )}

            {(booking.paymentToken || isConfirmed || booking.status === "payment_issue") && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  className="booking-secondary"
                  disabled={!!pending}
                  onClick={() => action({ action: "refresh" })}
                  style={{ minHeight: "36px", fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                >
                  {pending === "refresh" ? "Checking PayMongo…" : "Refresh Deposit Status"}
                </button>
                {booking.paymentToken && (
                  <Link
                    href={`/pay/${encodeURIComponent(booking.paymentToken)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="booking-secondary"
                    style={{ minHeight: "36px", fontSize: "0.8125rem", padding: "0.25rem 0.75rem", textDecoration: "none" }}
                  >
                    View PayMongo Checkout ↗
                  </Link>
                )}
              </div>
            )}

            {isConfirmed && (
              <div style={{ marginTop: "0.5rem", padding: "0.875rem", border: "1px solid var(--color-divider)", borderRadius: "6px", background: "var(--color-surface-elevated)" }}>
                <h4 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
                  Remaining Balance ({money(balanceAmount)})
                </h4>
                {booking.balancePaidAt ? (
                  <div style={{ marginTop: "0.5rem" }}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "#2e7d32", fontWeight: 500 }}>
                      ✓ Paid on arrival via {booking.balanceMethod || "Cash"}.
                    </p>
                    <button
                      type="button"
                      className="booking-secondary"
                      disabled={!!pending}
                      onClick={() => action({ action: "mark_balance_paid", paid: false })}
                      style={{ marginTop: "0.5rem", minHeight: "32px", fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
                    >
                      {pending === "mark_balance_paid" ? "Updating…" : "Reset balance to unpaid"}
                    </button>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const method = new FormData(e.currentTarget).get("method");
                      action({ action: "mark_balance_paid", method, paid: true });
                    }}
                    style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}
                  >
                    <select name="method" defaultValue="Cash on arrival" disabled={!!pending} style={{ height: "36px", fontSize: "0.8125rem" }}>
                      <option value="Cash on arrival">Cash on arrival</option>
                      <option value="GCash on arrival">GCash on arrival</option>
                      <option value="Bank transfer on arrival">Bank transfer on arrival</option>
                    </select>
                    <button className="button-primary" type="submit" disabled={!!pending} style={{ minHeight: "36px", fontSize: "0.8125rem" }}>
                      {pending === "mark_balance_paid" ? "Recording…" : "Mark Balance Paid on Arrival"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {canCancel && (
              <details className="admin-cancel-drawer">
                <summary>Cancel this reservation</summary>
                <form onSubmit={handleCancel}>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--color-muted)" }}>
                    {isAwaiting
                      ? "The checkout will expire and the date will be released for other guests."
                      : "The guest request will be marked cancelled."}
                  </p>
                  <textarea
                    name="reason"
                    minLength={3}
                    maxLength={500}
                    rows={2}
                    required
                    placeholder="Reason for cancellation (shared with guest records)"
                    disabled={!!pending}
                  />
                  <button type="submit" className="booking-secondary" disabled={!!pending} style={{ width: "fit-content", minHeight: "36px", fontSize: "0.8125rem" }}>
                    {pending === "cancel" ? "Cancelling…" : "Confirm Cancellation"}
                  </button>
                </form>
              </details>
            )}
          </div>

          {error && <div className="admin-toast-feedback is-error" role="alert">{error}</div>}
          {notice && <div className="admin-toast-feedback is-success" role="status">{notice}</div>}
        </div>
      </div>
    </article>
  );
}

function BlockedDatesManager({ onUnauthorized, onCountChange }) {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadBlocked = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/blocked-dates");
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not load blocked dates.");
      const list = data.data?.blockedDates || [];
      setBlocked(list);
      if (onCountChange) onCountChange(list.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, onCountChange]);

  useEffect(() => {
    loadBlocked();
  }, [loadBlocked]);

  async function handleBlock(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(e.currentTarget);
    const date = form.get("date");
    const reason = form.get("reason");
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", date, reason }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not block date.");
      const list = data.data?.blockedDates || [];
      setBlocked(list);
      if (onCountChange) onCountChange(list.length);
      setNotice(`Date ${date} blocked successfully. Guests can no longer book this date.`);
      e.currentTarget.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock(date) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", date }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not unblock date.");
      const list = data.data?.blockedDates || [];
      setBlocked(list);
      if (onCountChange) onCountChange(list.length);
      setNotice(`Date ${date} unblocked. It is now open on the public booking calendar.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const todayManila = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="admin-blocked-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.25rem", margin: 0, fontWeight: 600 }}>Calendar Blackouts & Maintenance</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--color-muted)", fontSize: "0.875rem" }}>
            Block dates for maintenance, private family stays, or off-platform reservations without changing code.
          </p>
        </div>
        <div className="admin-stat-badge" style={{ background: "var(--color-surface-elevated)", color: "var(--color-accent)", border: "1px solid var(--color-divider)" }}>
          {blocked.length} {blocked.length === 1 ? "Date Blocked" : "Dates Blocked"}
        </div>
      </div>

      <form onSubmit={handleBlock} style={{ display: "grid", gap: "1rem", maxWidth: "34rem", marginTop: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem" }}>
          <div className="booking-field" style={{ margin: 0 }}>
            <label htmlFor="block-date-input" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Stay Date to Block</label>
            <input
              id="block-date-input"
              name="date"
              type="date"
              required
              disabled={busy}
              min={todayManila}
              style={{ height: "42px", padding: "0.5rem 0.75rem", border: "1px solid var(--color-line)", borderRadius: "6px" }}
            />
          </div>
          <div className="booking-field" style={{ margin: 0 }}>
            <label htmlFor="block-reason-input" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Reason (optional)</label>
            <input
              id="block-reason-input"
              name="reason"
              type="text"
              maxLength={200}
              placeholder="e.g. Scheduled pool maintenance"
              disabled={busy}
              style={{ height: "42px", padding: "0.5rem 0.75rem", border: "1px solid var(--color-line)", borderRadius: "6px" }}
            />
          </div>
        </div>

        <button className="button-primary" type="submit" disabled={busy} style={{ width: "fit-content", minHeight: "40px" }}>
          {busy ? "Saving…" : "Block Date from Calendar"}
        </button>
      </form>

      {error && <div className="admin-toast-feedback is-error" role="alert">{error}</div>}
      {notice && <div className="admin-toast-feedback is-success" role="status">{notice}</div>}

      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--color-muted)", marginBottom: "0.75rem" }}>
          Currently Blocked Dates
        </h3>

        {loading ? (
          <p style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>Loading blocked dates…</p>
        ) : blocked.length === 0 ? (
          <div className="admin-empty" style={{ padding: "2rem" }}>
            <p style={{ margin: 0, color: "var(--color-muted)", fontSize: "0.875rem" }}>
              No dates are manually blocked. Calendar availability is completely open for public reservations.
            </p>
          </div>
        ) : (
          <div className="admin-blocked-grid">
            {blocked.map((item) => (
              <div key={item.date} className="admin-blocked-card">
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>{stayDate(item.date)}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-muted)", marginTop: "0.15rem" }}>
                    {item.date} {item.reason ? `· ${item.reason}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="booking-secondary"
                  disabled={busy}
                  onClick={() => handleUnblock(item.date)}
                  style={{ minHeight: "32px", padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookingAdmin() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("reservations");
  const [status, setStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1 });
  const [summary, setSummary] = useState({
    total: 0,
    requested: 0,
    awaitingPayment: 0,
    confirmed: 0,
    cancelled: 0,
    confirmedRevenue: 0,
    collectedDeposits: 0,
    collectedBalances: 0,
  });
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const unauthorized = useCallback(() => {
    router.replace("/admin/login");
    router.refresh();
  }, [router]);

  const load = useCallback(
    async (signal) => {
      setLoading(true);
      setError("");
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          ...(status ? { status } : {}),
        });
        const response = await fetch(`/api/admin/bookings?${queryParams}`, {
          cache: "no-store",
          signal,
        });
        if (response.status === 401) {
          unauthorized();
          return;
        }
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || "Bookings could not be loaded.");
        setBookings(result.data.bookings || []);
        setPagination(result.data.pagination || { totalItems: 0, totalPages: 1 });
        if (result.data.summary) {
          setSummary(result.data.summary);
        }
      } catch (failure) {
        if (failure.name !== "AbortError") {
          setError(
            failure instanceof TypeError
              ? "We could not reach the booking service. Please check your connection."
              : failure.message
          );
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [status, page, unauthorized]
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function logout() {
    setLoggingOut(true);
    setError("");
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out could not be completed. Please try again.");
      unauthorized();
    } catch (failure) {
      setError(failure.message);
      setLoggingOut(false);
    }
  }

  function updateBooking(updated) {
    setBookings((current) => current.map((b) => (b.id === updated.id ? updated : b)));
    // Silently re-fetch summary metrics
    load();
  }

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b) => {
      return (
        b.reference?.toLowerCase().includes(q) ||
        b.name?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.date?.toLowerCase().includes(q) ||
        b.occasion?.toLowerCase().includes(q)
      );
    });
  }, [bookings, searchQuery]);

  const totalPages = pagination.totalPages || pagination.pages || 1;

  return (
    <>
      <div className="admin-dash-header">
        <div>
          <span className="section-label">Executive Host Dashboard</span>
          <h1 className="admin-dash-title">Host Command Center</h1>
          <p className="admin-dash-subtitle">
            Track reservation inquiries, review quotes, verify PayMongo deposits, and manage blackout dates.
          </p>
        </div>
        <div className="admin-dash-actions">
          <button
            type="button"
            className="booking-secondary"
            disabled={loading}
            onClick={() => load()}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
          >
            <span>↻</span>
            <span>{loading ? "Refreshing…" : "Refresh"}</span>
          </button>
          <button
            type="button"
            className="booking-secondary"
            onClick={logout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div
          className={`admin-stat-card ${status === "requested" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("reservations");
            setStatus(status === "requested" ? "" : "requested");
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setActiveTab("reservations");
              setStatus(status === "requested" ? "" : "requested");
              setPage(1);
            }
          }}
        >
          <div className="admin-stat-label">
            <span>Action Required</span>
            {summary.requested > 0 && (
              <span className="admin-stat-badge badge-awaiting">Needs Quote</span>
            )}
          </div>
          <div className="admin-stat-value">{summary.requested}</div>
          <div className="admin-stat-subtext">
            {summary.requested === 1 ? "1 new inquiry awaiting quote" : `${summary.requested} inquiries awaiting quote`}
          </div>
        </div>

        <div
          className={`admin-stat-card ${status === "awaiting_payment" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("reservations");
            setStatus(status === "awaiting_payment" ? "" : "awaiting_payment");
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setActiveTab("reservations");
              setStatus(status === "awaiting_payment" ? "" : "awaiting_payment");
              setPage(1);
            }
          }}
        >
          <div className="admin-stat-label">
            <span>Awaiting Deposit</span>
            <span className="admin-stat-badge badge-requested">Dates Held</span>
          </div>
          <div className="admin-stat-value">{summary.awaitingPayment}</div>
          <div className="admin-stat-subtext">Approved quotes awaiting guest deposit</div>
        </div>

        <div
          className={`admin-stat-card ${status === "confirmed" ? "is-active" : ""}`}
          onClick={() => {
            setActiveTab("reservations");
            setStatus(status === "confirmed" ? "" : "confirmed");
            setPage(1);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setActiveTab("reservations");
              setStatus(status === "confirmed" ? "" : "confirmed");
              setPage(1);
            }
          }}
        >
          <div className="admin-stat-label">
            <span>Confirmed Stays</span>
            <span className="admin-stat-badge badge-confirmed">Secured</span>
          </div>
          <div className="admin-stat-value">{summary.confirmed}</div>
          <div className="admin-stat-subtext">Deposit secured via PayMongo</div>
        </div>

        <div
          className={`admin-stat-card ${activeTab === "financials" ? "is-active" : ""}`}
          onClick={() => setActiveTab("financials")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setActiveTab("financials");
          }}
        >
          <div className="admin-stat-label">
            <span>Confirmed Revenue</span>
            <span className="admin-stat-badge badge-confirmed">Gross</span>
          </div>
          <div className="admin-stat-value">{money(summary.confirmedRevenue)}</div>
          <div className="admin-stat-subtext">
            {money(summary.collectedDeposits)} deposits collected
          </div>
        </div>
      </div>

      <nav className="admin-tabs-nav" aria-label="Dashboard sections">
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === "reservations" ? "is-active" : ""}`}
          onClick={() => setActiveTab("reservations")}
        >
          <span>Reservations & Inquiries</span>
          <span className="admin-tab-count">{pagination.totalItems || 0}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === "calendar" ? "is-active" : ""}`}
          onClick={() => setActiveTab("calendar")}
        >
          <span>Calendar Blackouts</span>
          <span className="admin-tab-count">{blockedCount}</span>
        </button>
        <button
          type="button"
          className={`admin-tab-btn ${activeTab === "financials" ? "is-active" : ""}`}
          onClick={() => setActiveTab("financials")}
        >
          <span>Financial Summary</span>
        </button>
      </nav>

      {error && <div className="admin-toast-feedback is-error" role="alert" style={{ marginTop: "1.5rem" }}>{error}</div>}

      {activeTab === "reservations" && (
        <>
          <div className="admin-filter-bar">
            <div className="admin-search-box">
              <input
                type="text"
                className="admin-search-input"
                placeholder="Search reference, guest name, email, phone, or date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search query"
                >
                  ×
                </button>
              )}
            </div>

            <div className="admin-filter-chips">
              <button
                type="button"
                className={`admin-chip ${status === "" ? "is-active" : ""}`}
                onClick={() => {
                  setStatus("");
                  setPage(1);
                }}
              >
                <span>All</span>
                <span className="admin-chip-count">({summary.total})</span>
              </button>
              <button
                type="button"
                className={`admin-chip ${status === "requested" ? "is-active" : ""}`}
                onClick={() => {
                  setStatus("requested");
                  setPage(1);
                }}
              >
                <span>New Requests</span>
                <span className="admin-chip-count">({summary.requested})</span>
              </button>
              <button
                type="button"
                className={`admin-chip ${status === "awaiting_payment" ? "is-active" : ""}`}
                onClick={() => {
                  setStatus("awaiting_payment");
                  setPage(1);
                }}
              >
                <span>Awaiting Deposit</span>
                <span className="admin-chip-count">({summary.awaitingPayment})</span>
              </button>
              <button
                type="button"
                className={`admin-chip ${status === "confirmed" ? "is-active" : ""}`}
                onClick={() => {
                  setStatus("confirmed");
                  setPage(1);
                }}
              >
                <span>Confirmed</span>
                <span className="admin-chip-count">({summary.confirmed})</span>
              </button>
              <button
                type="button"
                className={`admin-chip ${status === "cancelled" ? "is-active" : ""}`}
                onClick={() => {
                  setStatus("cancelled");
                  setPage(1);
                }}
              >
                <span>Cancelled</span>
                <span className="admin-chip-count">({summary.cancelled})</span>
              </button>
            </div>
          </div>

          <div className="admin-booking-list" aria-busy={loading}>
            {!loading && filteredBookings.length === 0 && (
              <div className="admin-empty">
                <h2>No reservations found</h2>
                <p>
                  {searchQuery
                    ? `No bookings match your search "${searchQuery}".`
                    : status
                    ? "Try selecting another status tab above to see other bookings."
                    : "New inquiries from guests will appear here as soon as they submit a reservation request."}
                </p>
                {(searchQuery || status) && (
                  <button
                    type="button"
                    className="booking-secondary"
                    onClick={() => {
                      setSearchQuery("");
                      setStatus("");
                      setPage(1);
                    }}
                    style={{ marginTop: "1rem" }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}

            {filteredBookings.map((booking) => (
              <BookingEntry
                key={booking.id}
                booking={booking}
                onChanged={updateBooking}
                onUnauthorized={unauthorized}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav className="admin-pagination-bar" aria-label="Reservation page navigation">
              <button
                type="button"
                className="booking-secondary"
                disabled={loading || page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                ← Previous Page
              </button>
              <span style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="booking-secondary"
                disabled={loading || page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next Page →
              </button>
            </nav>
          )}
        </>
      )}

      {activeTab === "calendar" && (
        <BlockedDatesManager
          onUnauthorized={unauthorized}
          onCountChange={setBlockedCount}
        />
      )}

      {activeTab === "financials" && (
        <div className="admin-overview-grid">
          <div className="admin-overview-panel">
            <h3>Revenue Snapshot</h3>
            <p style={{ margin: "0 0 1.25rem", color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Summary of all confirmed reservations and collected receipts.
            </p>
            <dl className="admin-meta-list">
              <div className="admin-meta-row">
                <dt>Gross Confirmed Stays</dt>
                <dd style={{ fontSize: "1.125rem", color: "var(--color-ink)" }}>{money(summary.confirmedRevenue)}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>50% Online Deposits Collected (PayMongo)</dt>
                <dd style={{ color: "#2e7d32" }}>{money(summary.collectedDeposits)}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>On-Site Balances Recorded Paid</dt>
                <dd style={{ color: "#2e7d32" }}>{money(summary.collectedBalances)}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>Remaining Outstanding Balances on Arrival</dt>
                <dd style={{ color: "#b76e00" }}>{money(summary.confirmedRevenue - summary.collectedDeposits - summary.collectedBalances)}</dd>
              </div>
            </dl>
          </div>

          <div className="admin-overview-panel">
            <h3>Reservation Volume Breakdown</h3>
            <p style={{ margin: "0 0 1.25rem", color: "var(--color-muted)", fontSize: "0.875rem" }}>
              Total reservation lifecycle count across all inquiries.
            </p>
            <dl className="admin-meta-list">
              <div className="admin-meta-row">
                <dt>All-Time Inquiries</dt>
                <dd>{summary.total}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>Confirmed Stays</dt>
                <dd>{summary.confirmed}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>Pending Approval (Quotes Needed)</dt>
                <dd>{summary.requested}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>Pending Guest Deposit</dt>
                <dd>{summary.awaitingPayment}</dd>
              </div>
              <div className="admin-meta-row">
                <dt>Cancelled / Expired</dt>
                <dd>{summary.cancelled}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
