"use client";

import { useId, useState } from "react";
import {
  expenseCategories, money, todayManila, monthLabel, useAdminRead, OperationError,
} from "./AdminOperations";

export default function AdminFinancialSummary({ onUnauthorized, refreshKey, onNavigateTab, fallbackSummary }) {
  const prefix = useId();
  const currentMonth = todayManila().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);

  const financials = useAdminRead(`/api/admin/financials?month=${encodeURIComponent(month)}`, onUnauthorized, refreshKey);
  const data = financials.data;
  const monthly = data?.monthly;
  const allTime = data?.allTime;

  const isCurrentMonth = month === currentMonth;

  // Derive all-time volumes from fallbackSummary if available
  const allTimeVolumes = {
    total: fallbackSummary?.total ?? 0,
    confirmed: fallbackSummary?.confirmed ?? allTime?.confirmedStays ?? 0,
    requested: fallbackSummary?.requested ?? 0,
    awaitingPayment: fallbackSummary?.awaitingPayment ?? 0,
    cancelled: fallbackSummary?.cancelled ?? 0,
  };

  const isProfit = monthly ? monthly.netOperatingIncome >= 0 : true;
  const isAllTimeProfit = allTime ? allTime.netOperatingIncome >= 0 : true;

  return (
    <section className="admin-operations ops-financial-overview" aria-labelledby={`${prefix}-heading`}>
      <div className="ops-section-heading">
        <div>
          <h2 id={`${prefix}-heading`}>Financial & Operating Summary</h2>
          <p>
            Contrast reservation revenue against utility bills and operating expenses to track your net operating income.
          </p>
        </div>
        <div className="ops-month-control">
          <label htmlFor={`${prefix}-month`} className="ops-field-label">Period</label>
          <div className="ops-month-picker-wrap">
            <input
              id={`${prefix}-month`}
              type="month"
              className="ops-month-input"
              value={month}
              min="2020-01"
              max="2099-12"
              onChange={(e) => setMonth(e.target.value || currentMonth)}
            />
            {!isCurrentMonth && (
              <button
                type="button"
                className="booking-secondary ops-btn-sm"
                onClick={() => setMonth(currentMonth)}
              >
                Current month
              </button>
            )}
          </div>
        </div>
      </div>

      <OperationError error={financials.error} onRetry={financials.reload} />

      {financials.loading && !data && (
        <p className="ops-empty" role="status">Loading financial records...</p>
      )}

      {monthly && (
        <>
          {/* Top Hero KPI Cards */}
          <div className="ops-hero-metrics" role="region" aria-label={`Financial metrics for ${monthLabel(month)}`}>
            {/* 1. Confirmed Revenue */}
            <div className="ops-metric-card">
              <span className="ops-metric-label">Confirmed Stay Revenue</span>
              <strong className="ops-metric-value">{money(monthly.confirmedRevenue)}</strong>
              <span className="ops-metric-subtext">
                {monthly.confirmedStays} {monthly.confirmedStays === 1 ? "stay" : "stays"} · {monthly.bookedNights} {monthly.bookedNights === 1 ? "night" : "nights"}
              </span>
            </div>

            {/* 2. Total Operating Expenses */}
            <div className="ops-metric-card">
              <span className="ops-metric-label">Operating Expenses</span>
              <strong className="ops-metric-value ops-val-expense">{money(monthly.totalExpenses)}</strong>
              <span className="ops-metric-subtext">
                {monthly.expenseRatio != null
                  ? `${monthly.expenseRatio}% of revenue`
                  : `${monthly.expenseCategories.length} expense categories`}
              </span>
            </div>

            {/* 3. Net Operating Income */}
            <div className={`ops-metric-card ${isProfit ? "is-profit" : "is-loss"}`}>
              <div className="ops-card-badge-row">
                <span className="ops-metric-label">Net Operating Income</span>
                <span className={`ops-status-pill ${isProfit ? "pill-profit" : "pill-loss"}`}>
                  {isProfit ? "Profit" : "Deficit"}
                </span>
              </div>
              <strong className="ops-metric-value ops-val-noi">
                {isProfit ? "+" : ""}{money(monthly.netOperatingIncome)}
              </strong>
              <span className="ops-metric-subtext">
                {monthly.profitMargin != null
                  ? `${monthly.profitMargin}% profit margin`
                  : "Gross revenue minus expenses"}
              </span>
            </div>

            {/* 4. Net Cash Flow */}
            <div className="ops-metric-card">
              <span className="ops-metric-label">Net Cash Flow</span>
              <strong className="ops-metric-value">
                {monthly.netCashFlow >= 0 ? "+" : ""}{money(monthly.netCashFlow)}
              </strong>
              <span className="ops-metric-subtext">
                {money(monthly.collectedCash)} cash collected
              </span>
            </div>
          </div>

          {/* Monthly Detailed Breakdown Grid */}
          <div className="ops-pnl-grid">
            {/* Revenue & Collection Snapshot */}
            <div className="ops-ledger-panel">
              <div className="ops-panel-header">
                <h3>{monthLabel(month)} Revenue & Cash Collection</h3>
                <p className="ops-help">Accrued stay revenue and actual cash received for this month.</p>
              </div>
              <dl className="admin-meta-list" style={{ marginTop: "1rem" }}>
                <div className="admin-meta-row">
                  <dt>Gross Confirmed Stays</dt>
                  <dd style={{ fontSize: "1.125rem", color: "var(--color-ink)", fontWeight: 600 }}>
                    {money(monthly.confirmedRevenue)}
                  </dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Online Deposits Collected (PayMongo)</dt>
                  <dd style={{ color: "#2e7d32", fontWeight: 600 }}>{money(monthly.collectedDeposits)}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>On-Site Balances Recorded Paid</dt>
                  <dd style={{ color: "#2e7d32", fontWeight: 600 }}>{money(monthly.collectedBalances)}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Total Cash Collected</dt>
                  <dd style={{ color: "#2e7d32", fontWeight: 700 }}>{money(monthly.collectedCash)}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Remaining Outstanding Balances on Arrival</dt>
                  <dd style={{ color: monthly.pendingBalances > 0 ? "#b76e00" : "var(--color-muted)", fontWeight: 600 }}>
                    {money(monthly.pendingBalances)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Operating Expenses Breakdown */}
            <div className="ops-ledger-panel">
              <div className="ops-panel-header">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3>{monthLabel(month)} Expenses</h3>
                  <strong style={{ fontSize: "1.125rem", color: "var(--color-accent)" }}>
                    {money(monthly.totalExpenses)}
                  </strong>
                </div>
                <p className="ops-help">Utility bills and property upkeep recorded for this month.</p>
              </div>

              {monthly.expenseCategories.length > 0 ? (
                <div className="ops-expense-bars" style={{ marginTop: "1rem" }}>
                  {monthly.expenseCategories.map((item) => {
                    const pct = monthly.totalExpenses > 0
                      ? Math.round((item.totalAmount / monthly.totalExpenses) * 100)
                      : 0;
                    return (
                      <div key={item.category} className="ops-expense-bar-row">
                        <div className="ops-expense-bar-info">
                          <span>{expenseCategories[item.category] || item.category}</span>
                          <strong>{money(item.totalAmount)} <small>({pct}%)</small></strong>
                        </div>
                        <div className="ops-bar-track" aria-hidden="true">
                          <div className="ops-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: "1.25rem" }}>
                    <button
                      type="button"
                      className="booking-secondary ops-btn-sm"
                      onClick={() => onNavigateTab?.("expenses")}
                    >
                      Open Expenses ledger →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="ops-empty" style={{ padding: "1.25rem 0" }}>
                  <p>No expenses recorded for {monthLabel(month)}.</p>
                  <button
                    type="button"
                    className="button-primary ops-btn-sm"
                    style={{ marginTop: "0.75rem" }}
                    onClick={() => onNavigateTab?.("expenses")}
                  >
                    Record a bill or expense
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* All-Time Snapshot Grid */}
          <div className="admin-overview-grid" style={{ marginTop: "1.5rem" }}>
            {/* All-Time Net Operating Profit */}
            <div className="admin-overview-panel">
              <h3>All-Time Operating Profit Snapshot</h3>
              <p style={{ margin: "0 0 1.25rem", color: "var(--color-muted)", fontSize: "0.875rem" }}>
                Cumulative operational revenue, expenses, and net profit since launch.
              </p>
              <dl className="admin-meta-list">
                <div className="admin-meta-row">
                  <dt>All-Time Confirmed Stays</dt>
                  <dd style={{ fontSize: "1.125rem", color: "var(--color-ink)", fontWeight: 600 }}>
                    {money(allTime?.confirmedRevenue ?? 0)}
                  </dd>
                </div>
                <div className="admin-meta-row">
                  <dt>All-Time Collected Cash</dt>
                  <dd style={{ color: "#2e7d32", fontWeight: 600 }}>
                    {money(allTime?.collectedCash ?? 0)}
                  </dd>
                </div>
                <div className="admin-meta-row">
                  <dt>All-Time Recorded Expenses</dt>
                  <dd style={{ color: "#8c302a", fontWeight: 600 }}>
                    {money(allTime?.totalExpenses ?? 0)}
                  </dd>
                </div>
                <div className="admin-meta-row">
                  <dt>All-Time Net Operating Profit</dt>
                  <dd style={{ fontSize: "1.125rem", color: isAllTimeProfit ? "#2e7d32" : "#8c302a", fontWeight: 700 }}>
                    {isAllTimeProfit ? "+" : ""}{money(allTime?.netOperatingIncome ?? 0)}
                  </dd>
                </div>
                {allTime?.profitMargin != null && (
                  <div className="admin-meta-row">
                    <dt>All-Time Profit Margin</dt>
                    <dd style={{ fontWeight: 600 }}>{allTime.profitMargin}%</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Reservation Volume Breakdown */}
            <div className="admin-overview-panel">
              <h3>Reservation Volume Breakdown</h3>
              <p style={{ margin: "0 0 1.25rem", color: "var(--color-muted)", fontSize: "0.875rem" }}>
                Total reservation lifecycle count across all inquiries.
              </p>
              <dl className="admin-meta-list">
                <div className="admin-meta-row">
                  <dt>All-Time Inquiries</dt>
                  <dd>{allTimeVolumes.total}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Confirmed Stays</dt>
                  <dd>{allTimeVolumes.confirmed}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Pending Approval (Quotes Needed)</dt>
                  <dd>{allTimeVolumes.requested}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Pending Guest Deposit</dt>
                  <dd>{allTimeVolumes.awaitingPayment}</dd>
                </div>
                <div className="admin-meta-row">
                  <dt>Cancelled / Expired</dt>
                  <dd>{allTimeVolumes.cancelled}</dd>
                </div>
              </dl>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
