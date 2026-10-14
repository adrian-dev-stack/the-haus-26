"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  expenseCategories, money, todayManila, dateLabel, monthLabel, useAdminRead,
  useAdminMutation, useDebouncedSearch, OperationError, OperationPagination,
} from "./AdminOperations";

function ExpenseForm({ expense, onSaved, onCancel, onUnauthorized }) {
  const prefix = useId();
  const formRef = useRef(null);
  const mutation = useAdminMutation(onUnauthorized);

  function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    mutation.run(expense ? "update" : "create", "/api/admin/expenses", {
      action: expense ? "update" : "create", ...fields,
      ...(expense ? { id: expense.id, expectedUpdatedAt: expense.updatedAt } : {}),
    }, (result) => {
      if (!expense) formRef.current?.reset();
      onSaved(result.expense);
    });
  }

  return <form ref={formRef} className="ops-form" onSubmit={submit} aria-busy={!!mutation.pending}>
    <fieldset disabled={!!mutation.pending}>
      <legend className="ops-form-title">{expense ? "Edit expense" : "Record an expense"}</legend>
      <p className="ops-help">Track water and electricity bills, upkeep, and purchases for the house. Amounts are in Philippine pesos.</p>
      <div className="ops-field-pair">
        <div className="ops-field"><label htmlFor={`${prefix}-date`}>Expense date</label>
          <input id={`${prefix}-date`} name="spentDate" type="date" min="1900-01-01" max="9999-12-31" required defaultValue={expense?.spentDate || todayManila()} /></div>
        <div className="ops-field"><label htmlFor={`${prefix}-amount`}>Amount (PHP)</label>
          <input id={`${prefix}-amount`} name="amount" type="number" inputMode="decimal" min="0.01" max="99999999.99" step="0.01" required
            defaultValue={expense ? (expense.amount / 100).toFixed(2) : ""} /></div>
      </div>
      <div className="ops-field"><label htmlFor={`${prefix}-category`}>Category</label>
        <select id={`${prefix}-category`} name="category" required defaultValue={expense?.category || "water"}>
          {Object.entries(expenseCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>
      <div className="ops-field"><label htmlFor={`${prefix}-description`}>Description</label>
        <input id={`${prefix}-description`} name="description" required maxLength={240} defaultValue={expense?.description || ""} /></div>
      <div className="ops-field"><label htmlFor={`${prefix}-supplier`}>Supplier or payee <span>(optional)</span></label>
        <input id={`${prefix}-supplier`} name="supplier" maxLength={120} defaultValue={expense?.supplier || ""} /></div>
      <div className="ops-field"><label htmlFor={`${prefix}-notes`}>Notes <span>(optional)</span></label>
        <textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={1000} defaultValue={expense?.notes || ""} /></div>
      <div className="ops-actions">
        <button type="submit" className="button-primary">{mutation.pending ? "Saving expense..." : expense ? "Save changes" : "Save expense"}</button>
        {onCancel && <button type="button" className="booking-secondary" onClick={onCancel}>Cancel editing</button>}
      </div>
    </fieldset>
    <OperationError error={mutation.error} />
  </form>;
}

function ExpenseEntry({ expense, onChanged, onUnauthorized }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mutation = useAdminMutation(onUnauthorized);

  function remove() {
    mutation.run("delete", "/api/admin/expenses", {
      action: "delete", id: expense.id, expectedUpdatedAt: expense.updatedAt,
    }, () => onChanged("Expense deleted."));
  }

  return <li className="ops-ledger-row" aria-busy={!!mutation.pending}>
    <div className="ops-row-top">
      <div className="ops-row-content">
        <div className="ops-row-caption"><time dateTime={expense.spentDate}>{dateLabel(expense.spentDate)}</time>
          <span>{expenseCategories[expense.category] || expense.category}</span></div>
        <h4>{expense.description}</h4>
        {expense.supplier && <p className="ops-help">{expense.supplier}</p>}
        {expense.notes && <p className="ops-record-notes">{expense.notes}</p>}
      </div>
      <strong className="ops-row-amount">{money(expense.amount)}</strong>
    </div>
    {!editing && <div className="ops-actions">
      <button type="button" className="booking-secondary" disabled={!!mutation.pending} onClick={() => {
        setEditing(true); setConfirmDelete(false); mutation.clear();
      }} aria-label={`Edit expense: ${expense.description}`}>Edit</button>
      <button type="button" className="ops-text-button ops-danger" disabled={!!mutation.pending} onClick={() => {
        setConfirmDelete(true); mutation.clear();
      }} aria-label={`Delete expense: ${expense.description}`}>Delete</button>
    </div>}
    {editing && <div className="ops-inline-panel"><ExpenseForm expense={expense} onUnauthorized={onUnauthorized}
      onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged("Expense updated."); }} /></div>}
    {confirmDelete && <div className="ops-confirmation">
      <p>Delete this {money(expense.amount)} expense? It will be removed from the monthly totals.</p>
      <div className="ops-actions">
        <button type="button" className="booking-secondary ops-danger" disabled={!!mutation.pending} onClick={remove}>
          {mutation.pending ? "Deleting..." : "Confirm delete"}</button>
        <button type="button" className="booking-secondary" disabled={!!mutation.pending} onClick={() => setConfirmDelete(false)}>Keep expense</button>
      </div>
    </div>}
    <OperationError error={mutation.error} />
  </li>;
}

export default function AdminExpenses({ onUnauthorized, refreshKey }) {
  const prefix = useId();
  const [month, setMonth] = useState(() => todayManila().slice(0, 7));
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const debouncedSearch = useDebouncedSearch(search);
  const query = new URLSearchParams({ month, page: String(page) });
  if (category) query.set("category", category);
  if (debouncedSearch) query.set("search", debouncedSearch);
  const collection = useAdminRead(`/api/admin/expenses?${query}`, onUnauthorized, refreshKey);
  const data = collection.data;
  useEffect(() => {
    if (data && data.pagination.page > Math.max(1, data.pagination.pages)) setPage(Math.max(1, data.pagination.pages));
  }, [data]);

  function changed(message) {
    setNotice(message);
    setPage(1);
    collection.reload();
  }

  return <section className="admin-operations" aria-labelledby={`${prefix}-heading`}>
    <div className="ops-section-heading">
      <div><h2 id={`${prefix}-heading`}>Expenses</h2><p>Keep the house bills and running costs in one monthly record.</p></div>
      <div className="ops-field ops-month-field"><label htmlFor={`${prefix}-month`}>Month</label>
        <input id={`${prefix}-month`} type="month" value={month} min="1900-01" max="9999-12" required onChange={(event) => {
          if (/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(event.target.value)) { setMonth(event.target.value); setPage(1); }
        }} /></div>
    </div>
    {notice && <p className="ops-feedback" role="status">{notice}</p>}
    <div className="ops-expense-layout">
      <aside className="ops-entry-panel" aria-label="Add an expense"><ExpenseForm onUnauthorized={onUnauthorized}
        onSaved={(expense) => { setMonth(expense.spentDate.slice(0, 7)); setPage(1); changed("Expense saved."); }} /></aside>
      <div className="ops-ledger-panel">
        <div className="ops-month-summary" aria-live="polite">
          <div><h3>{monthLabel(month)}</h3><p className="ops-help">Total recorded across all categories</p></div>
          <div className="ops-summary-figure"><strong>{data ? money(data.summary.totalAmount) : collection.error ? "Total unavailable" : "Loading total..."}</strong>
            {data && <span>{data.summary.count} {data.summary.count === 1 ? "expense" : "expenses"}</span>}</div>
        </div>
        {data?.summary.byCategory.length > 0 && <dl className="ops-category-totals">
          {data.summary.byCategory.map((entry) => <div key={entry.category}><dt>{expenseCategories[entry.category] || entry.category}</dt>
            <dd>{money(entry.totalAmount)}</dd></div>)}
        </dl>}
        <div className="ops-filters">
          <div className="ops-field ops-search-field"><label htmlFor={`${prefix}-search`}>Search expenses</label>
            <input id={`${prefix}-search`} type="search" value={search} maxLength={120} placeholder="Description, payee, or notes"
              onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div>
          <div className="ops-field"><label htmlFor={`${prefix}-filter-category`}>Category</label>
            <select id={`${prefix}-filter-category`} value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
              <option value="">All categories</option>{Object.entries(expenseCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select></div>
        </div>
        <OperationError error={collection.error} onRetry={collection.reload} />
        {collection.loading && <p className="ops-empty" role="status">Loading this month&apos;s expenses...</p>}
        {data && (data.expenses.length > 0 ? <>
          <p className="ops-result-count">{data.pagination.total} {data.pagination.total === 1 ? "matching expense" : "matching expenses"}</p>
          <ul className="ops-ledger">{data.expenses.map((expense) => <ExpenseEntry key={`${expense.id}-${expense.updatedAt}`} expense={expense}
            onUnauthorized={onUnauthorized} onChanged={changed} />)}</ul>
        </> : <div className="ops-empty"><h3>{category || debouncedSearch ? "No expenses match these filters" : "No expenses recorded for this month"}</h3>
          <p>{category || debouncedSearch ? "Change the category or search to see more expenses." : "Save a bill or purchase using the expense form."}</p>
          {(category || search) && <button type="button" className="booking-secondary" onClick={() => {
            setCategory(""); setSearch(""); setPage(1);
          }}>Clear filters</button>}
        </div>)}
        <OperationPagination pagination={data?.pagination} onPage={setPage} disabled={collection.loading} label="Expense" />
      </div>
    </div>
  </section>;
}
