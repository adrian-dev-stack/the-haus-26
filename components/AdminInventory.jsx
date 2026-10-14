"use client";

import { useEffect, useId, useState } from "react";
import {
  dateLabel, useAdminRead, useAdminMutation, useDebouncedSearch, OperationError, OperationPagination,
} from "./AdminOperations";

const kindLabels = { consumable: "Consumable", reusable: "Reusable" };
const movementLabels = {
  opening: "Opening count", restock: "Restock", use: "Used", damaged: "Damaged",
  missing: "Missing", correction: "Count correction",
};
const quantityLabel = (quantity) => new Intl.NumberFormat("en-PH").format(quantity);

function ItemFields({ item, prefix }) {
  return <>
    <div className="ops-field"><label htmlFor={`${prefix}-name`}>Item name</label>
      <input id={`${prefix}-name`} name="name" required maxLength={120} defaultValue={item?.name || ""} /></div>
    {!item && <div className="ops-field"><label htmlFor={`${prefix}-kind`}>Type</label>
      <select id={`${prefix}-kind`} name="kind" defaultValue="consumable"><option value="consumable">Consumable</option><option value="reusable">Reusable</option></select>
      <p className="ops-help">Consumables are used up. Reusables are counted while available for use. Type stays fixed after saving.</p></div>}
    <div className="ops-field-pair">
      <div className="ops-field"><label htmlFor={`${prefix}-category`}>Category</label>
        <input id={`${prefix}-category`} name="category" required maxLength={60} defaultValue={item?.category || ""} /></div>
      <div className="ops-field"><label htmlFor={`${prefix}-unit`}>Unit</label>
        <input id={`${prefix}-unit`} name="unit" required maxLength={40} placeholder="Pieces, bottles, or packs" defaultValue={item?.unit || ""} /></div>
    </div>
    <div className="ops-field-pair">
      {!item && <div className="ops-field"><label htmlFor={`${prefix}-quantity`}>Opening usable quantity</label>
        <input id={`${prefix}-quantity`} name="quantity" type="number" inputMode="numeric" min="0" max="1000000" step="1" required defaultValue="0" /></div>}
      <div className="ops-field"><label htmlFor={`${prefix}-threshold`}>Low stock at</label>
        <input id={`${prefix}-threshold`} name="lowStockThreshold" type="number" inputMode="numeric" min="0" max="1000000" step="1" required defaultValue={item?.lowStockThreshold ?? 0} />
        <p className="ops-help">Flag when usable quantity is at or below this count.</p></div>
    </div>
    <div className="ops-field"><label htmlFor={`${prefix}-location`}>Location <span>(optional)</span></label>
      <input id={`${prefix}-location`} name="location" maxLength={120} defaultValue={item?.location || ""} /></div>
    <div className="ops-field"><label htmlFor={`${prefix}-notes`}>Notes <span>(optional)</span></label>
      <textarea id={`${prefix}-notes`} name="notes" rows={2} maxLength={1000} defaultValue={item?.notes || ""} /></div>
  </>;
}

function InventoryForm({ item, onSaved, onCancel, onUnauthorized, disabled = false, onPendingChange }) {
  const prefix = useId();
  const mutation = useAdminMutation(onUnauthorized, onPendingChange);
  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    fields.lowStockThreshold = Number(fields.lowStockThreshold);
    if (!item) fields.quantity = Number(fields.quantity);
    mutation.run(item ? "update" : "create", "/api/admin/inventory", {
      action: item ? "update" : "create", ...fields,
      ...(item ? { id: item.id, expectedUpdatedAt: item.updatedAt } : {}),
    }, (result) => { if (!item) form.reset(); onSaved(result.item); });
  }
  return <form className="ops-form" onSubmit={submit} aria-busy={!!mutation.pending}>
    <fieldset disabled={disabled || !!mutation.pending}>
      <legend className="ops-form-title">{item ? "Edit item" : "Add an item"}</legend>
      {!item && <p className="ops-help">Keep consumables, linens, kitchenware, and equipment ready for the next stay. Start with the items you actually have.</p>}
      {item && <p className="ops-help">{kindLabels[item.kind]}. Update stock from the Stock adjustment tab.</p>}
      <ItemFields item={item} prefix={prefix} />
      <div className="ops-actions"><button type="submit" className="button-primary">
        {mutation.pending ? "Saving item..." : item ? "Save details" : "Save item"}</button>
        {onCancel && <button type="button" className="booking-secondary" onClick={onCancel}>Cancel editing</button>}
      </div>
    </fieldset>
    <OperationError error={mutation.error} />
  </form>;
}

function StockAdjustment({ item, onSaved, onUnauthorized, disabled, onPendingChange }) {
  const prefix = useId();
  const [type, setType] = useState("restock");
  const mutation = useAdminMutation(onUnauthorized, onPendingChange);
  const isCorrection = type === "correction";
  const isRemoval = ["use", "damaged", "missing"].includes(type);

  function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    mutation.run("adjust", "/api/admin/inventory", {
      action: "adjust", id: item.id, expectedUpdatedAt: item.updatedAt,
      type, quantity: Number(fields.quantity), reason: fields.reason,
    }, () => { form.reset(); onSaved("Stock adjustment recorded."); });
  }

  return <form className="ops-form" onSubmit={submit} aria-busy={!!mutation.pending}>
    <fieldset disabled={disabled || !!mutation.pending}>
      <legend className="ops-form-title">Adjust usable stock</legend>
      <p className="ops-help">Current usable count: <strong>{quantityLabel(item.quantity)} {item.unit}</strong>. Record damaged or missing items separately so the history stays clear.</p>
      <div className="ops-field-pair">
        <div className="ops-field"><label htmlFor={`${prefix}-type`}>Adjustment type</label>
          <select id={`${prefix}-type`} value={type} onChange={(event) => { setType(event.target.value); mutation.clear(); }}>
            <option value="restock">Restock</option>{item.kind === "consumable" && <option value="use">Use</option>}<option value="damaged">Damaged</option>
            <option value="missing">Missing</option><option value="correction">Count correction</option>
          </select></div>
        <div className="ops-field"><label htmlFor={`${prefix}-quantity`}>{isCorrection ? "Counted usable quantity" : "Quantity to " + (isRemoval ? "remove" : "add")}</label>
          <input key={type} id={`${prefix}-quantity`} name="quantity" type="number" inputMode="numeric"
            min={isCorrection ? "0" : "1"} max={isRemoval ? item.quantity : 1000000} step="1" required
            defaultValue={isCorrection ? item.quantity : ""} aria-describedby={`${prefix}-quantity-help`} /></div>
      </div>
      <p id={`${prefix}-quantity-help`} className="ops-help">{isCorrection
        ? "A correction replaces the usable count with the quantity you counted. It is not added to the current stock."
        : isRemoval ? "This quantity will be taken out of usable stock." : "This quantity will be added to usable stock."}</p>
      <div className="ops-field"><label htmlFor={`${prefix}-reason`}>Reason</label>
        <textarea id={`${prefix}-reason`} name="reason" required maxLength={300} rows={2} /></div>
      <button type="submit" className="button-primary">{mutation.pending ? "Saving adjustment..." : "Save adjustment"}</button>
    </fieldset>
    <OperationError error={mutation.error} />
  </form>;
}

function MovementHistory({ data, loading, onPage }) {
  return <div className="ops-history">
    <h4>Movement history</h4>
    <p className="ops-help">Newest first. All quantities refer to usable stock.</p>
    {data.movements.length ? <ol className="ops-movement-list">{data.movements.map((movement) => <li key={movement.id}>
      <div className="ops-movement-heading"><strong>{movementLabels[movement.type] || movement.type}</strong>
        <span className="ops-movement-change">{movement.quantityChange > 0 ? "+" : ""}{quantityLabel(movement.quantityChange)} {data.item.unit}</span></div>
      <p>{movement.reason}</p>
      <div className="ops-row-caption"><time dateTime={movement.createdAt}>{dateLabel(movement.createdAt, true)}</time>
        <span>Usable after: {quantityLabel(movement.quantityAfter)}</span></div>
    </li>)}</ol> : <p className="ops-empty">No movements yet. The first stock adjustment will appear here.</p>}
    <OperationPagination pagination={data.pagination} onPage={onPage} disabled={loading} label="Movement history" />
  </div>;
}

function InventoryItemPanel({ item, onChanged, onClose, onUnauthorized, refreshKey }) {
  const prefix = useId();
  const [tab, setTab] = useState(item.archivedAt ? "history" : "adjust");
  const [page, setPage] = useState(1);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [toolPending, setToolPending] = useState(false);
  const detail = useAdminRead(`/api/admin/inventory/${encodeURIComponent(item.id)}?page=${page}`, onUnauthorized, refreshKey);
  const mutation = useAdminMutation(onUnauthorized);
  const current = detail.data?.item;
  useEffect(() => {
    const pagination = detail.data?.pagination;
    if (pagination && pagination.page > Math.max(1, pagination.pages)) setPage(Math.max(1, pagination.pages));
  }, [detail.data]);

  function changed(message) {
    setPage(1);
    detail.reload();
    onChanged(message);
  }

  function archive() {
    mutation.run("archive", "/api/admin/inventory", {
      action: "archive", id: current.id, expectedUpdatedAt: current.updatedAt,
    }, () => { onClose(); onChanged("Item archived. Its movement history is still available in Archived items."); });
  }

  return <div className="ops-inline-panel" aria-labelledby={`${prefix}-title`}>
    <div className="ops-panel-heading"><h4 id={`${prefix}-title`}>Manage {item.name}</h4>
      <button type="button" className="booking-secondary" disabled={toolPending || !!mutation.pending} onClick={onClose}>Close item</button></div>
    <OperationError error={detail.error} onRetry={detail.reload} />
    {detail.loading && <p className="ops-help" role="status">Loading item and movement history...</p>}
    {current && <>
      <div className="ops-item-tabs" role="group" aria-label="Item tools">
        {!current.archivedAt && <><button type="button" className="booking-secondary" disabled={toolPending || !!mutation.pending} aria-pressed={tab === "adjust"}
          onClick={() => setTab("adjust")}>Stock adjustment</button>
          <button type="button" className="booking-secondary" disabled={toolPending || !!mutation.pending} aria-pressed={tab === "edit"}
            onClick={() => setTab("edit")}>Edit details</button></>}
        <button type="button" className="booking-secondary" disabled={toolPending || !!mutation.pending} aria-pressed={tab === "history"} onClick={() => setTab("history")}>Movement history</button>
      </div>
      {tab === "adjust" && !current.archivedAt && <StockAdjustment key={current.updatedAt} item={current} onUnauthorized={onUnauthorized}
        disabled={detail.loading || !!mutation.pending} onPendingChange={setToolPending} onSaved={changed} />}
      {tab === "edit" && !current.archivedAt && <InventoryForm key={current.updatedAt} item={current} onUnauthorized={onUnauthorized}
        disabled={detail.loading || !!mutation.pending} onPendingChange={setToolPending} onCancel={() => setTab("adjust")} onSaved={() => changed("Item details updated.")} />}
      {tab === "history" && <MovementHistory data={detail.data} loading={detail.loading} onPage={setPage} />}
      {!current.archivedAt && <div className="ops-archive-controls">
        {!confirmArchive ? <button type="button" className="ops-text-button ops-danger" disabled={detail.loading || toolPending || !!mutation.pending}
          onClick={() => { setConfirmArchive(true); mutation.clear(); }}>Archive item</button> : <div className="ops-confirmation">
          <p>Archive {current.name}? It will leave the active inventory. The stock count and history will be kept.</p>
          <div className="ops-actions"><button type="button" className="booking-secondary ops-danger" disabled={detail.loading || toolPending || !!mutation.pending} onClick={archive}>
            {mutation.pending ? "Archiving..." : "Confirm archive"}</button>
            <button type="button" className="booking-secondary" disabled={!!mutation.pending} onClick={() => setConfirmArchive(false)}>Keep active</button></div>
        </div>}
        <OperationError error={mutation.error} />
      </div>}
    </>}
  </div>;
}

function InventoryEntry({ item, selected, onSelect, onChanged, onUnauthorized, refreshKey }) {
  return <li className="ops-ledger-row">
    <div className="ops-row-top">
      <div className="ops-row-content"><div className="ops-row-caption"><span>{kindLabels[item.kind]}</span><span>{item.category}</span></div>
        <h3>{item.name}</h3>{item.location && <p className="ops-help">Location: {item.location}</p>}
        {item.notes && <p className="ops-record-notes">{item.notes}</p>}
      </div>
      <div className="ops-stock-count"><strong>{quantityLabel(item.quantity)} <span>{item.unit}</span></strong>
        <span className={`ops-stock-status${item.isLowStock && !item.archivedAt ? " is-low" : ""}`}>
          {item.archivedAt ? "Archived" : item.isLowStock ? "Low stock" : "In stock"}</span>
        <span className="ops-help">Low stock at {quantityLabel(item.lowStockThreshold)}</span></div>
    </div>
    {item.archivedAt && <p className="ops-help">Archived {dateLabel(item.archivedAt, true)}</p>}
    {!selected && <button type="button" className="booking-secondary" aria-expanded={false}
      aria-label={`${item.archivedAt ? "View history" : "Manage item"}: ${item.name}`} onClick={() => onSelect(item.id)}>
      {item.archivedAt ? "View history" : "Manage item"}</button>}
    {selected && <InventoryItemPanel item={item} onUnauthorized={onUnauthorized} refreshKey={refreshKey}
      onClose={() => onSelect("")} onChanged={onChanged} />}
  </li>;
}

export default function AdminInventory({ onUnauthorized, refreshKey }) {
  const prefix = useId();
  const [status, setStatus] = useState("active");
  const [kind, setKind] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [notice, setNotice] = useState("");
  const debouncedSearch = useDebouncedSearch(search);
  const query = new URLSearchParams({ status, page: String(page) });
  if (kind) query.set("kind", kind);
  if (status === "active" && lowStock) query.set("lowStock", "true");
  if (debouncedSearch) query.set("search", debouncedSearch);
  const collection = useAdminRead(`/api/admin/inventory?${query}`, onUnauthorized, refreshKey);
  const data = collection.data;
  useEffect(() => {
    if (data && data.pagination.page > Math.max(1, data.pagination.pages)) setPage(Math.max(1, data.pagination.pages));
  }, [data]);
  const filtered = Boolean(kind || (status === "active" && lowStock) || debouncedSearch);

  function resetPage() { setPage(1); setSelectedId(""); }
  function changed(message) { setNotice(message); setPage(1); collection.reload(); }

  return <section className="admin-operations" aria-labelledby={`${prefix}-heading`}>
    <div className="ops-section-heading"><div><h2 id={`${prefix}-heading`}>Inventory</h2>
      <p>Track what is ready to use, what needs replenishing, and where the count changed.</p></div>
      {data && <p className="ops-inventory-summary">{data.summary.activeItems} active {data.summary.activeItems === 1 ? "item" : "items"}
        <strong>{data.summary.lowStockItems} low stock</strong></p>}
    </div>
    {notice && <p className="ops-feedback" role="status">{notice}</p>}
    <div className="ops-inventory-layout">
      <aside className="ops-entry-panel" aria-label="Add inventory"><InventoryForm onUnauthorized={onUnauthorized} onSaved={() => {
        setStatus("active"); setKind(""); setLowStock(false); setSearch(""); resetPage(); changed("Inventory item saved.");
      }} /></aside>
      <div className="ops-ledger-panel">
        <div className="ops-list-heading"><h3>{status === "active" ? "Active inventory" : "Archived items"}</h3>
          <div className="ops-status-switch" role="group" aria-label="Inventory status">
            <button type="button" className="booking-secondary" aria-pressed={status === "active"} onClick={() => { setStatus("active"); resetPage(); }}>Active</button>
            <button type="button" className="booking-secondary" aria-pressed={status === "archived"} onClick={() => { setStatus("archived"); resetPage(); }}>Archived</button>
          </div></div>
        {status === "archived" && <p className="ops-help">Archived items keep their last usable count and movement history. They are excluded from active stock alerts.</p>}
        <div className="ops-filters">
          <div className="ops-field ops-search-field"><label htmlFor={`${prefix}-search`}>Search inventory</label>
            <input id={`${prefix}-search`} type="search" value={search} maxLength={120} placeholder="Item, category, or location"
              onChange={(event) => { setSearch(event.target.value); resetPage(); }} /></div>
          <div className="ops-field"><label htmlFor={`${prefix}-kind`}>Item type</label>
            <select id={`${prefix}-kind`} value={kind} onChange={(event) => { setKind(event.target.value); resetPage(); }}>
              <option value="">All types</option><option value="consumable">Consumable</option><option value="reusable">Reusable</option>
            </select></div>
        </div>
        {status === "active" && <label className="ops-checkbox" htmlFor={`${prefix}-low`}>
          <input id={`${prefix}-low`} type="checkbox" checked={lowStock} onChange={(event) => { setLowStock(event.target.checked); resetPage(); }} />
          Show low stock only</label>}
        <OperationError error={collection.error} onRetry={collection.reload} />
        {collection.loading && <p className="ops-empty" role="status">Loading {status === "active" ? "inventory" : "archived items"}...</p>}
        {data && (data.items.length ? <>
          <p className="ops-result-count">{data.pagination.total} {data.pagination.total === 1 ? "matching item" : "matching items"}</p>
          <ul className="ops-ledger">{data.items.map((item) => <InventoryEntry key={item.id} item={item} selected={selectedId === item.id}
            onSelect={setSelectedId} onChanged={changed} onUnauthorized={onUnauthorized} refreshKey={refreshKey} />)}</ul>
        </> : <div className="ops-empty"><h4>{filtered ? "No items match these filters" : status === "archived" ? "No archived items" : "Start with your current stock"}</h4>
          <p>{filtered ? "Change the search or filters to see more items." : status === "archived" ? "Items you archive will appear here with their history." : "Add an item with its usable count. Stock alerts follow the threshold you set."}</p>
          {filtered && <button type="button" className="booking-secondary" onClick={() => {
            setKind(""); setSearch(""); setLowStock(false); resetPage();
          }}>Clear filters</button>}</div>)}
        <OperationPagination pagination={data?.pagination} disabled={collection.loading} label="Inventory" onPage={(next) => { setPage(next); setSelectedId(""); }} />
      </div>
    </div>
  </section>;
}
