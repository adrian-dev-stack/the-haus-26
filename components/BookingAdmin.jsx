"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_LABELS = { requested: "New request", awaiting_payment: "Awaiting deposit", confirmed: "Confirmed", test_paid: "Test payment", cancelled: "Cancelled", declined: "Declined", payment_issue: "Payment review", refunded: "Refund review" };
const money = (amount) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount / 100);
const stayDate = (date) => new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "long" }).format(new Date(`${date}T12:00:00Z`));

function BookingEntry({ booking, onChanged, onUnauthorized }) {
  const prefix = useId();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const isRequested = booking.status === "requested";
  const isAwaiting = booking.status === "awaiting_payment";
  const canCancel = isRequested || isAwaiting;
  const hasQuote = Number.isSafeInteger(booking.totalAmount) && booking.totalAmount > 0;

  async function action(payload) {
    if (pending) return;
    setPending(payload.action); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/bookings/${encodeURIComponent(booking.id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (response.status === 401) { onUnauthorized(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "This booking could not be updated. Please try again.");
      setNotice(payload.action === "confirm" ? "Quote saved. Share the guest’s private booking link so they can review the terms and deposit." : payload.action === "refresh" ? "Latest payment status checked." : "Booking cancelled.");
      onChanged(result.data.booking);
    } catch (failure) { setError(failure instanceof TypeError ? "We could not reach the booking service. Retry this action to check its result." : failure.message); }
    finally { setPending(""); }
  }

  function confirm(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    action({ action: "confirm", total: form.get("total"), terms: form.get("terms") });
  }
  function cancel(event) { event.preventDefault(); action({ action: "cancel", reason: new FormData(event.currentTarget).get("reason") }); }
  async function copyGuestLink() {
    try { await navigator.clipboard.writeText(new URL(booking.guestUrl, window.location.origin).href); setCopyMessage("Guest link copied. Send it directly to the guest."); }
    catch { setCopyMessage("Open the guest’s booking, then copy its address from your browser."); }
  }

  return (
    <article className="admin-booking" aria-busy={!!pending}>
      <div className="admin-booking-header"><div><p className="section-label">{booking.reference}</p><h2>{stayDate(booking.date)}</h2><p>{booking.guests} {booking.guests === 1 ? "guest" : "guests"} · 22-hour stay</p></div><div className="admin-status-group"><span className="booking-status-label">{STATUS_LABELS[booking.status] || "Needs review"}</span>{booking.livemode === false && <span className="booking-mode-label">Test mode</span>}</div></div>
      <div className="admin-booking-body">
        <div className="admin-guest-details"><h3>Guest details</h3><dl className="booking-details"><div><dt>Name</dt><dd>{booking.name}</dd></div><div><dt>Email</dt><dd><a href={`mailto:${booking.email}`} className="admin-contact-link">{booking.email}</a></dd></div><div><dt>Mobile</dt><dd><a href={`tel:${booking.phone}`} className="admin-contact-link">{booking.phone}</a></dd></div>{booking.occasion && <div><dt>Occasion</dt><dd>{booking.occasion}</dd></div>}</dl>{booking.notes && <div className="admin-notes"><h3>Questions or requests</h3><p>{booking.notes}</p></div>}{hasQuote && <dl className="booking-details admin-quote"><div><dt>Confirmed total</dt><dd>{money(booking.totalAmount)}</dd></div><div><dt>50% deposit</dt><dd>{money(booking.depositAmount)}</dd></div><div><dt>Balance</dt><dd>{money(booking.totalAmount - booking.depositAmount)}</dd></div></dl>}{booking.terms && <div className="admin-notes"><h3>Confirmed terms</h3><p>{booking.terms}</p></div>}{booking.guestUrl && <div className="booking-actions"><button type="button" className="booking-secondary" onClick={copyGuestLink}>Copy guest link</button><Link href={booking.guestUrl} className="text-link" target="_blank" rel="noopener noreferrer">Open guest booking</Link></div>}{copyMessage && <p className="booking-small" role="status">{copyMessage}</p>}</div>
        <div className="admin-booking-controls">
          {isRequested && <form onSubmit={confirm} className="admin-confirm-form"><h3>Approve date & quote</h3><p>Agree on the final rate and terms with the guest before approving. Approval holds this date while the deposit is pending.</p><fieldset disabled={!!pending}><div className="booking-field"><label htmlFor={`${prefix}-total`}>Confirmed total (PHP)</label><input id={`${prefix}-total`} name="total" type="number" inputMode="decimal" min="2" step="0.02" required placeholder="5000.00" /><p>The guest pays 50% of this amount as their deposit.</p></div><div className="booking-field"><label htmlFor={`${prefix}-terms`}>Terms agreed with the guest</label><textarea id={`${prefix}-terms`} name="terms" rows={4} minLength={10} maxLength={2000} required placeholder="Enter the agreed cancellation, rescheduling, and remaining balance terms." /></div></fieldset><button className="button-primary" type="submit" disabled={!!pending}>{pending === "confirm" ? "Preparing deposit…" : "Approve & create deposit"}</button></form>}
          {isAwaiting && !booking.paymentToken && <div className="admin-retry"><h3>Finish preparing the deposit</h3><p>The quote is saved. Retry to safely resume preparation of the same payment request.</p><button type="button" className="button-primary" disabled={!!pending} onClick={() => action({ action: "confirm", total: String(booking.totalAmount / 100), terms: booking.terms })}>{pending === "confirm" ? "Preparing deposit…" : "Retry deposit setup"}</button></div>}
          {(booking.paymentToken || booking.paymentStatus || ["confirmed", "test_paid", "payment_issue", "refunded"].includes(booking.status)) && <div className="admin-payment-controls"><h3>Payment status</h3><p>Check PayMongo for the latest deposit status before finalizing arrival details.</p><button type="button" className="booking-secondary" disabled={!!pending} onClick={() => action({ action: "refresh" })}>{pending === "refresh" ? "Checking PayMongo…" : "Refresh payment status"}</button>{booking.paymentToken && <Link href={`/pay/${encodeURIComponent(booking.paymentToken)}`} target="_blank" rel="noopener noreferrer" className="text-link">View payment request</Link>}</div>}
          {canCancel && <details className="admin-cancel"><summary>Cancel this {isRequested ? "request" : "unpaid booking"}</summary><form onSubmit={cancel}><p>{isAwaiting ? "The checkout will be expired before the date is released. A payment already received requires a separate refund review." : "The guest will see that this request is cancelled."}</p><div className="booking-field"><label htmlFor={`${prefix}-reason`}>Reason for cancellation</label><textarea id={`${prefix}-reason`} name="reason" minLength={3} maxLength={500} rows={2} required disabled={!!pending} /></div><button type="submit" className="booking-secondary" disabled={!!pending}>{pending === "cancel" ? "Cancelling…" : "Cancel booking"}</button></form></details>}
          {["confirmed", "test_paid", "refunded", "payment_issue"].includes(booking.status) && <p className="booking-notice">For a paid booking, review any refund in PayMongo and agree on changes directly with the guest. Refresh the payment status after reviewing it.</p>}
        </div>
      </div>
      {error && <p className="booking-error" role="alert">{error}</p>}{notice && <p className="admin-action-notice" role="status">{notice}</p>}
    </article>
  );
}

function BlockedDatesManager({ onUnauthorized }) {
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);

  const loadBlocked = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/blocked-dates");
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not load blocked dates.");
      setBlocked(data.data?.blockedDates || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => { loadBlocked(); }, [loadBlocked]);

  async function handleBlock(e) {
    e.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const form = new FormData(e.currentTarget);
    const date = form.get("date");
    const reason = form.get("reason");
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", date, reason }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not block date.");
      setBlocked(data.data?.blockedDates || []);
      setNotice(`Date ${date} blocked successfully. Guests cannot book this date.`);
      e.currentTarget.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnblock(date) {
    setBusy(true); setError(""); setNotice("");
    try {
      const res = await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock", date }),
      });
      if (res.status === 401) { onUnauthorized(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Could not unblock date.");
      setBlocked(data.data?.blockedDates || []);
      setNotice(`Date ${date} unblocked. It is now open on the calendar.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-booking" style={{ marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.125rem", margin: 0 }}>Calendar Date Blocker</h2>
          <p style={{ margin: "0.25rem 0 0", color: "var(--color-muted)", fontSize: "0.875rem" }}>
            {blocked.length} {blocked.length === 1 ? "date manually blocked" : "dates manually blocked"} from public bookings
          </p>
        </div>
        <button type="button" className="booking-secondary" onClick={() => setOpen(!open)}>
          {open ? "Hide date blocker" : "Manage blocked dates"}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--color-divider)", paddingTop: "1.25rem" }}>
          <form onSubmit={handleBlock} style={{ display: "grid", gap: "1rem", maxWidth: "30rem" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--color-muted)" }}>
              Block dates for maintenance, personal stays, or off-platform reservations without code changes.
            </p>
            <div className="booking-field">
              <label htmlFor="block-date-input">Stay Date</label>
              <input id="block-date-input" name="date" type="date" required disabled={busy} min={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())} />
            </div>
            <div className="booking-field">
              <label htmlFor="block-reason-input">Reason (optional)</label>
              <input id="block-reason-input" name="reason" type="text" maxLength={200} placeholder="e.g. Scheduled pool maintenance" disabled={busy} />
            </div>
            <button className="button-primary" type="submit" disabled={busy} style={{ width: "fit-content" }}>
              {busy ? "Saving…" : "Block this date"}
            </button>
          </form>

          {error && <p className="booking-error" role="alert" style={{ marginTop: "1rem" }}>{error}</p>}
          {notice && <p className="admin-action-notice" role="status" style={{ marginTop: "1rem" }}>{notice}</p>}

          <div style={{ marginTop: "1.5rem" }}>
            <h3 style={{ fontSize: "0.9375rem", marginBottom: "0.75rem" }}>Currently blocked dates</h3>
            {loading ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>Loading dates…</p>
            ) : blocked.length === 0 ? (
              <p style={{ fontSize: "0.875rem", color: "var(--color-muted)" }}>No dates are manually blocked. Calendar availability is active.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" }}>
                {blocked.map((item) => (
                  <li key={item.date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.625rem 0.875rem", background: "var(--color-surface-elevated)", border: "1px solid var(--color-divider)", borderRadius: "4px" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{stayDate(item.date)}</span>
                      <span style={{ marginLeft: "0.5rem", fontSize: "0.8125rem", color: "var(--color-muted)" }}>({item.date})</span>
                      {item.reason && <span style={{ marginLeft: "0.75rem", fontSize: "0.8125rem", color: "var(--color-muted)" }}>- {item.reason}</span>}
                    </div>
                    <button type="button" className="booking-secondary" disabled={busy} onClick={() => handleUnblock(item.date)} style={{ minHeight: "36px", padding: "0.25rem 0.75rem", fontSize: "0.8125rem" }}>
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function BookingAdmin() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const unauthorized = useCallback(() => { router.replace("/admin/login"); router.refresh(); }, [router]);

  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/bookings?${new URLSearchParams({ status, page: String(page) })}`, { cache: "no-store", signal });
      if (response.status === 401) { unauthorized(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "Bookings could not be loaded.");
      setBookings(result.data.bookings); setPagination(result.data.pagination);
    } catch (failure) { if (failure.name !== "AbortError") setError(failure instanceof TypeError ? "We could not reach the booking service. Please try again." : failure.message); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [status, page, unauthorized]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);

  async function logout() {
    setLoggingOut(true); setError("");
    try { const response = await fetch("/api/admin/logout", { method: "POST" }); if (!response.ok) throw new Error("Sign-out could not be completed. Please try again."); unauthorized(); }
    catch (failure) { setError(failure.message); setLoggingOut(false); }
  }
  function updateBooking(updated) { setBookings((current) => current.map((booking) => booking.id === updated.id ? updated : booking)); }
  const totalPages = pagination.totalPages || pagination.pages || 1;

  return (
    <>
      <div className="admin-page-heading"><div><p className="section-label">Your private host workspace</p><h1>Bookings</h1><p>Review each request, confirm its quote, and track the 50% deposit.</p></div><button type="button" className="booking-secondary" onClick={logout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Sign out"}</button></div>
      <BlockedDatesManager onUnauthorized={unauthorized} />
      <div className="admin-toolbar"><div className="booking-field"><label htmlFor="booking-filter">Show bookings</label><select id="booking-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{[["", "All bookings"], ...Object.entries(STATUS_LABELS)].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><button type="button" className="booking-secondary" disabled={loading} onClick={() => load()}>{loading ? "Loading…" : "Refresh bookings"}</button><p role="status">{loading ? "Loading bookings…" : `${pagination.totalItems || 0} ${pagination.totalItems === 1 ? "booking" : "bookings"}`}</p></div>
      {error && <p className="booking-error" role="alert">{error}</p>}
      <div className="admin-booking-list" aria-busy={loading}>{!loading && !error && bookings.length === 0 && <div className="booking-panel admin-empty"><h2>No bookings here yet.</h2><p>{status ? "Try another status to see other requests." : "Guest requests will appear here when they submit the booking form."}</p></div>}{bookings.map((booking) => <BookingEntry key={booking.id} booking={booking} onChanged={updateBooking} onUnauthorized={unauthorized} />)}</div>
      {totalPages > 1 && <nav className="admin-pagination" aria-label="Booking pages"><button type="button" className="booking-secondary" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><p>Page {page} of {totalPages}</p><button type="button" className="booking-secondary" disabled={loading || page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></nav>}
    </>
  );
}
