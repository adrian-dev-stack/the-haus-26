"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const expenseCategories = {
  water: "Water bill",
  electricity: "Electricity bill",
  cleaning: "Cleaning",
  utilities: "Other utilities",
  maintenance: "Maintenance",
  supplies: "Supplies",
  laundry: "Laundry",
  staff: "Staff",
  other: "Other",
};

export const money = (amount) => new Intl.NumberFormat("en-PH", {
  style: "currency", currency: "PHP",
}).format(amount / 100);

export function todayManila() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function dateLabel(value, withTime = false) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(withTime ? value : `${value}T12:00:00Z`));
}

export function monthLabel(value) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", month: "long", year: "numeric",
  }).format(new Date(`${value}-01T12:00:00Z`));
}

async function request(endpoint, options, onUnauthorized) {
  const response = await fetch(endpoint, { cache: "no-store", ...options });
  if (response.status === 401) {
    onUnauthorized?.();
    return null;
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.data) {
    const error = new Error(result?.error?.message || "The request could not be completed. Please try again.");
    error.status = response.status;
    throw error;
  }
  return result.data;
}

export function useAdminRead(endpoint, onUnauthorized, refreshKey) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const auth = useRef(onUnauthorized);
  auth.current = onUnauthorized;
  const reload = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setLoading(Boolean(endpoint));
    if (!endpoint) return () => controller.abort();
    request(endpoint, { signal: controller.signal }, () => auth.current?.())
      .then((result) => {
        if (!controller.signal.aborted) setSnapshot({ endpoint, data: result });
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure instanceof TypeError
          ? "The service could not be reached. Check your connection and retry."
          : failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, refreshKey, revision]);

  return { data: snapshot?.endpoint === endpoint ? snapshot.data : null, loading, error, reload };
}

export function useAdminMutation(onUnauthorized, onPendingChange) {
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const controller = useRef(null);
  const auth = useRef(onUnauthorized);
  const pendingChange = useRef(onPendingChange);
  auth.current = onUnauthorized;
  pendingChange.current = onPendingChange;
  useEffect(() => () => {
    controller.current?.abort();
    pendingChange.current?.(false);
  }, []);

  async function run(action, endpoint, payload, onSuccess) {
    if (controller.current) return;
    const current = new AbortController();
    controller.current = current;
    pendingChange.current?.(true);
    setPending(action);
    setError("");
    try {
      const result = await request(endpoint, {
        method: "POST", signal: current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, () => auth.current?.());
      if (!current.signal.aborted && result) onSuccess(result);
    } catch (failure) {
      if (!current.signal.aborted) setError(failure instanceof TypeError
        ? "The service could not be reached. Your change has not been confirmed. Retry after checking the list."
        : failure.message);
    } finally {
      if (!current.signal.aborted) setPending("");
      pendingChange.current?.(false);
      if (controller.current === current) controller.current = null;
    }
  }

  return { run, pending, error, clear: () => setError("") };
}

export function OperationError({ error, onRetry }) {
  if (!error) return null;
  return <div className="ops-feedback ops-feedback-error" role="alert">
    <p>{error}</p>
    {onRetry && <button type="button" className="booking-secondary" onClick={onRetry}>Retry loading</button>}
  </div>;
}

export function OperationPagination({ pagination, onPage, disabled = false, label = "records" }) {
  if (!pagination || pagination.pages < 2) return null;
  return <nav className="ops-pagination" aria-label={`${label} pages`}>
    <button type="button" className="booking-secondary" disabled={disabled || pagination.page <= 1}
      onClick={() => onPage(pagination.page - 1)}>Previous</button>
    <span>Page {pagination.page} of {pagination.pages}</span>
    <button type="button" className="booking-secondary" disabled={disabled || pagination.page >= pagination.pages}
      onClick={() => onPage(pagination.page + 1)}>Next</button>
  </nav>;
}

export function useDebouncedSearch(value) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);
  return search;
}
