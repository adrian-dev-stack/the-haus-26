import { randomUUID } from "node:crypto";
import { BookingError, getBookingStore } from "./booking-store.js";

export const EXPENSE_CATEGORIES = ["cleaning", "water", "electricity", "utilities", "maintenance", "supplies", "laundry", "staff", "other"];
export const OPERATIONS_PAGE_SIZE = 50;
const MAX_QUANTITY = 1_000_000;
const initialized = new WeakMap();
const writes = new WeakMap();

function fail(code, message, status = 422) { throw new BookingError(code, message, status); }

export async function initializeAdminOperations(client) {
  if (!initialized.has(client)) {
    const pending = client.batch([
      `CREATE TABLE IF NOT EXISTS admin_expenses (
        id TEXT PRIMARY KEY, spent_date TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('cleaning','water','electricity','utilities','maintenance','supplies','laundry','staff','other')),
        description TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 9999999999),
        supplier TEXT NOT NULL, notes TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS admin_expenses_date ON admin_expenses(spent_date DESC, created_at DESC)",
      `CREATE TABLE IF NOT EXISTS admin_inventory_items (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('consumable','reusable')),
        category TEXT NOT NULL, unit TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 0 AND 1000000),
        low_stock_threshold INTEGER NOT NULL CHECK(low_stock_threshold BETWEEN 0 AND 1000000),
        location TEXT NOT NULL, notes TEXT NOT NULL, archived_at INTEGER,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS admin_inventory_status ON admin_inventory_items(archived_at, name)",
      `CREATE TABLE IF NOT EXISTS admin_inventory_movements (
        id TEXT PRIMARY KEY, item_id TEXT NOT NULL REFERENCES admin_inventory_items(id),
        type TEXT NOT NULL CHECK(type IN ('opening','restock','use','damaged','missing','correction')),
        quantity_change INTEGER NOT NULL, quantity_after INTEGER NOT NULL CHECK(quantity_after BETWEEN 0 AND 1000000),
        reason TEXT NOT NULL, created_at INTEGER NOT NULL
      )`,
      "CREATE INDEX IF NOT EXISTS admin_inventory_history ON admin_inventory_movements(item_id, created_at DESC)",
    ], "write").catch(() => {
      initialized.delete(client);
      fail("operations-unavailable", "The expense and inventory records are unavailable right now.", 503);
    });
    initialized.set(client, pending);
  }
  await initialized.get(client);
  return client;
}

async function store(client) { return initializeAdminOperations(client || await getBookingStore()); }

async function write(client, operation) {
  const previous = writes.get(client) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const tx = await client.transaction("write");
    try { const result = await operation(tx); await tx.commit(); return result; }
    catch (error) { if (!tx.closed) await tx.rollback(); throw error; }
    finally { tx.close(); }
  });
  writes.set(client, pending);
  try { return await pending; }
  finally { if (writes.get(client) === pending) writes.delete(client); }
}

function shape(input, allowed) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("invalid-input", "Complete the required fields.");
  const keys = new Set([...allowed, "action", "id", "expectedUpdatedAt"]);
  if (Object.keys(input).some((key) => !keys.has(key))) fail("invalid-input", "This request contains an unsupported field.");
}

function text(value, label, maximum, required = true) {
  if (value == null && !required) return "";
  if (typeof value !== "string") fail("invalid-input", `Enter ${label}.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean)) {
    fail("invalid-input", `Enter ${label} using ${required ? "1 to " : "at most "}${maximum} characters.`);
  }
  return clean;
}

function choice(value, values, label) {
  if (!values.includes(value)) fail("invalid-input", `Choose ${label}.`);
  return value;
}

function quantity(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_QUANTITY) fail("invalid-quantity", `Enter ${label} as a whole number from ${minimum} to ${MAX_QUANTITY.toLocaleString("en-US")}.`);
  return value;
}

function id(value) {
  if (typeof value !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)) fail("not-found", "This record was not found.", 404);
  return value;
}

function timestamp(value = Date.now()) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid operation timestamp.");
  return value;
}

function checkVersion(row, expected, required = false) {
  if (expected === undefined && !required) return;
  if (typeof expected !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(expected) || !Number.isFinite(Date.parse(expected))) {
    fail("invalid-version", "Reload this record before saving the change.");
  }
  if (Date.parse(expected) !== Number(row.updated_at)) fail("record-changed", "This record changed while you were editing. Reload it and try again.", 409);
}

export function parseExpenseAmount(value) {
  if (typeof value !== "string" || !/^\d{1,8}(?:\.\d{1,2})?$/.test(value.trim())) fail("invalid-amount", "Enter the amount in pesos with up to two decimal places.");
  const [whole, decimal = ""] = value.trim().split(".");
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 9_999_999_999) fail("invalid-amount", "Enter an amount from PHP 0.01 to PHP 99,999,999.99.");
  return amount;
}

function spentDate(value) {
  const parsed = typeof value === "string" ? Date.parse(`${value}T12:00:00Z`) : NaN;
  if (typeof value !== "string" || !/^(?:19|[2-9]\d)\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
    fail("invalid-date", "Enter a valid expense date.");
  }
  return value;
}

export function currentOperationsMonth(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" }).format(new Date(now));
}

function monthRange(value) {
  const month = value ?? currentOperationsMonth();
  if (typeof month !== "string" || !/^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/.test(month)) fail("invalid-month", "Choose a valid expense month.");
  const [year, number] = month.split("-").map(Number);
  const end = year === 9999 && number === 12 ? "9999-12-32" : number === 12 ? `${year + 1}-01-01` : `${year}-${String(number + 1).padStart(2, "0")}-01`;
  return { month, start: `${month}-01`, end };
}

function pageNumber(value = 1) {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) fail("invalid-page", "Choose a valid records page.");
  return page;
}

function pagination(page, total) { return { page, pageSize: OPERATIONS_PAGE_SIZE, total, pages: Math.max(1, Math.ceil(total / OPERATIONS_PAGE_SIZE)) }; }
function iso(value) { return new Date(Number(value)).toISOString(); }
function expenseView(row) {
  return { id: row.id, spentDate: row.spent_date, category: row.category, description: row.description, amount: Number(row.amount), supplier: row.supplier,
    notes: row.notes, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function itemView(row) {
  return { id: row.id, name: row.name, kind: row.kind, category: row.category, unit: row.unit, quantity: Number(row.quantity),
    lowStockThreshold: Number(row.low_stock_threshold), location: row.location, notes: row.notes,
    archivedAt: row.archived_at == null ? null : iso(row.archived_at), isLowStock: row.archived_at == null && Number(row.quantity) <= Number(row.low_stock_threshold),
    createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}
function movementView(row) {
  return { id: row.id, type: row.type, quantityChange: Number(row.quantity_change), quantityAfter: Number(row.quantity_after), reason: row.reason, createdAt: iso(row.created_at) };
}

function expenseInput(input) {
  shape(input, ["spentDate", "category", "description", "amount", "supplier", "notes"]);
  return { date: spentDate(input.spentDate), category: choice(input.category, EXPENSE_CATEGORIES, "an expense category"),
    description: text(input.description, "an expense description", 240), amount: parseExpenseAmount(input.amount),
    supplier: text(input.supplier, "a supplier", 120, false), notes: text(input.notes, "notes", 1000, false) };
}

async function find(tx, table, recordId) {
  const row = (await tx.execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [id(recordId)] })).rows[0];
  if (!row) fail("not-found", "This record was not found.", 404);
  return row;
}

function searchTerm(value) {
  if (value == null || value === "") return "";
  return text(value, "a search term", 120).toLowerCase();
}

export async function listExpenses({ month, page = 1, category, search } = {}, { client } = {}) {
  const range = monthRange(month);
  const current = pageNumber(page);
  const args = [range.start, range.end];
  const clauses = ["spent_date >= ?", "spent_date < ?"];
  if (category) { clauses.push("category = ?"); args.push(choice(category, EXPENSE_CATEGORIES, "an expense category")); }
  const term = searchTerm(search);
  if (term) { clauses.push("(instr(lower(description), ?) > 0 OR instr(lower(supplier), ?) > 0 OR instr(lower(notes), ?) > 0)"); args.push(term, term, term); }
  const where = clauses.join(" AND ");
  const database = await store(client);
  const [records, count, totals] = await database.batch([
    { sql: `SELECT * FROM admin_expenses WHERE ${where} ORDER BY spent_date DESC, created_at DESC, id DESC LIMIT ? OFFSET ?`, args: [...args, OPERATIONS_PAGE_SIZE, (current - 1) * OPERATIONS_PAGE_SIZE] },
    { sql: `SELECT COUNT(*) AS count FROM admin_expenses WHERE ${where}`, args },
    { sql: "SELECT category, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count FROM admin_expenses WHERE spent_date >= ? AND spent_date < ? GROUP BY category ORDER BY amount DESC, category", args: [range.start, range.end] },
  ], "read");
  const byCategory = totals.rows.map((row) => ({ category: row.category, totalAmount: Number(row.amount), count: Number(row.count) }));
  return { expenses: records.rows.map(expenseView), summary: { month: range.month, totalAmount: byCategory.reduce((total, row) => total + row.totalAmount, 0),
    count: byCategory.reduce((total, row) => total + row.count, 0), byCategory }, pagination: pagination(current, Number(count.rows[0].count)) };
}

export async function createExpense(input, { client, now = Date.now() } = {}) {
  const clean = expenseInput(input);
  const recordId = randomUUID();
  const time = timestamp(now);
  const database = await store(client);
  return write(database, async (tx) => {
    const result = await tx.execute({ sql: "INSERT INTO admin_expenses (id,spent_date,category,description,amount,supplier,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING *",
      args: [recordId, clean.date, clean.category, clean.description, clean.amount, clean.supplier, clean.notes, time, time] });
    return expenseView(result.rows[0]);
  });
}

export async function updateExpense(recordId, input, { client, now = Date.now() } = {}) {
  const clean = expenseInput(input);
  const database = await store(client);
  return write(database, async (tx) => {
    const row = await find(tx, "admin_expenses", recordId);
    checkVersion(row, input.expectedUpdatedAt);
    const result = await tx.execute({ sql: "UPDATE admin_expenses SET spent_date=?,category=?,description=?,amount=?,supplier=?,notes=?,updated_at=? WHERE id=? RETURNING *",
      args: [clean.date, clean.category, clean.description, clean.amount, clean.supplier, clean.notes, Math.max(timestamp(now), Number(row.updated_at) + 1), row.id] });
    return expenseView(result.rows[0]);
  });
}

export async function deleteExpense(recordId, input = {}, { client } = {}) {
  shape(input, []);
  const database = await store(client);
  return write(database, async (tx) => {
    const row = await find(tx, "admin_expenses", recordId);
    checkVersion(row, input.expectedUpdatedAt);
    await tx.execute({ sql: "DELETE FROM admin_expenses WHERE id=?", args: [row.id] });
    return { deleted: true };
  });
}

export async function getFinancialOverview({ month } = {}, { client } = {}) {
  const range = monthRange(month);
  const database = await store(client);

  const [monthlyExpenseTotals, allTimeExpenseTotal] = await database.batch([
    {
      sql: "SELECT category, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count FROM admin_expenses WHERE spent_date >= ? AND spent_date < ? GROUP BY category ORDER BY amount DESC, category",
      args: [range.start, range.end],
    },
    {
      sql: "SELECT COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count FROM admin_expenses",
      args: [],
    },
  ], "read");

  const monthlyExpenseCategories = monthlyExpenseTotals.rows.map((row) => ({
    category: row.category,
    totalAmount: Number(row.amount),
    count: Number(row.count),
  }));
  const totalMonthlyExpenses = monthlyExpenseCategories.reduce((sum, item) => sum + item.totalAmount, 0);
  const totalAllTimeExpenses = Number(allTimeExpenseTotal.rows[0]?.amount || 0);
  const totalAllTimeExpenseCount = Number(allTimeExpenseTotal.rows[0]?.count || 0);

  let monthlyBookings = {
    confirmedRevenue: 0,
    collectedDeposits: 0,
    collectedBalances: 0,
    collectedCash: 0,
    pendingBalances: 0,
    confirmedStays: 0,
    bookedNights: 0,
  };
  let allTimeBookings = {
    confirmedRevenue: 0,
    collectedDeposits: 0,
    collectedBalances: 0,
    collectedCash: 0,
    pendingBalances: 0,
    confirmedStays: 0,
    bookedNights: 0,
  };

  try {
    const [monthlyBookingsResult, allTimeBookingsResult] = await database.batch([
      {
        sql: `SELECT 
          COUNT(*) AS confirmed_stays,
          COALESCE(SUM(total_amount), 0) AS confirmed_revenue,
          COALESCE(SUM(deposit_amount), 0) AS collected_deposits,
          COALESCE(SUM(CASE WHEN balance_paid_at IS NOT NULL THEN total_amount - deposit_amount ELSE 0 END), 0) AS collected_balances,
          COALESCE(SUM(COALESCE(days, 1)), 0) AS booked_nights
        FROM bookings
        WHERE livemode = 1 AND status = 'confirmed' AND stay_date >= ? AND stay_date < ?`,
        args: [range.start, range.end],
      },
      {
        sql: `SELECT 
          COUNT(*) AS confirmed_stays,
          COALESCE(SUM(total_amount), 0) AS confirmed_revenue,
          COALESCE(SUM(deposit_amount), 0) AS collected_deposits,
          COALESCE(SUM(CASE WHEN balance_paid_at IS NOT NULL THEN total_amount - deposit_amount ELSE 0 END), 0) AS collected_balances,
          COALESCE(SUM(COALESCE(days, 1)), 0) AS booked_nights
        FROM bookings
        WHERE livemode = 1 AND status = 'confirmed'`,
        args: [],
      },
    ], "read");

    const mRow = monthlyBookingsResult.rows[0] || {};
    const mConfirmedRev = Number(mRow.confirmed_revenue || 0);
    const mDeposits = Number(mRow.collected_deposits || 0);
    const mBalances = Number(mRow.collected_balances || 0);
    const mCash = mDeposits + mBalances;
    monthlyBookings = {
      confirmedRevenue: mConfirmedRev,
      collectedDeposits: mDeposits,
      collectedBalances: mBalances,
      collectedCash: mCash,
      pendingBalances: Math.max(0, mConfirmedRev - mCash),
      confirmedStays: Number(mRow.confirmed_stays || 0),
      bookedNights: Number(mRow.booked_nights || 0),
    };

    const aRow = allTimeBookingsResult.rows[0] || {};
    const aConfirmedRev = Number(aRow.confirmed_revenue || 0);
    const aDeposits = Number(aRow.collected_deposits || 0);
    const aBalances = Number(aRow.collected_balances || 0);
    const aCash = aDeposits + aBalances;
    allTimeBookings = {
      confirmedRevenue: aConfirmedRev,
      collectedDeposits: aDeposits,
      collectedBalances: aBalances,
      collectedCash: aCash,
      pendingBalances: Math.max(0, aConfirmedRev - aCash),
      confirmedStays: Number(aRow.confirmed_stays || 0),
      bookedNights: Number(aRow.booked_nights || 0),
    };
  } catch {}

  const monthlyNetOperatingIncome = monthlyBookings.confirmedRevenue - totalMonthlyExpenses;
  const monthlyNetCashFlow = monthlyBookings.collectedCash - totalMonthlyExpenses;
  const monthlyProfitMargin = monthlyBookings.confirmedRevenue > 0
    ? Math.round((monthlyNetOperatingIncome / monthlyBookings.confirmedRevenue) * 100)
    : null;
  const monthlyExpenseRatio = monthlyBookings.confirmedRevenue > 0
    ? Math.round((totalMonthlyExpenses / monthlyBookings.confirmedRevenue) * 100)
    : null;

  const allTimeNetOperatingIncome = allTimeBookings.confirmedRevenue - totalAllTimeExpenses;
  const allTimeNetCashFlow = allTimeBookings.collectedCash - totalAllTimeExpenses;
  const allTimeProfitMargin = allTimeBookings.confirmedRevenue > 0
    ? Math.round((allTimeNetOperatingIncome / allTimeBookings.confirmedRevenue) * 100)
    : null;

  return {
    month: range.month,
    monthly: {
      ...monthlyBookings,
      totalExpenses: totalMonthlyExpenses,
      netOperatingIncome: monthlyNetOperatingIncome,
      netCashFlow: monthlyNetCashFlow,
      profitMargin: monthlyProfitMargin,
      expenseRatio: monthlyExpenseRatio,
      expenseCategories: monthlyExpenseCategories,
    },
    allTime: {
      ...allTimeBookings,
      totalExpenses: totalAllTimeExpenses,
      expenseCount: totalAllTimeExpenseCount,
      netOperatingIncome: allTimeNetOperatingIncome,
      netCashFlow: allTimeNetCashFlow,
      profitMargin: allTimeProfitMargin,
    },
  };
}


function itemInput(input, creating) {
  shape(input, ["name", "category", "unit", "lowStockThreshold", "location", "notes", ...(creating ? ["kind", "quantity"] : [])]);
  return { name: text(input.name, "an item name", 120), category: text(input.category, "an inventory category", 60), unit: text(input.unit, "a stock unit", 40),
    threshold: quantity(input.lowStockThreshold, "the low-stock threshold"), location: text(input.location, "a location", 120, false), notes: text(input.notes, "notes", 1000, false),
    ...(creating ? { kind: choice(input.kind, ["consumable", "reusable"], "an item type"), quantity: quantity(input.quantity, "the opening quantity") } : {}) };
}

export async function listInventory({ status = "active", page = 1, kind, lowStock, search } = {}, { client } = {}) {
  choice(status, ["active", "archived", "all"], "an inventory status");
  const current = pageNumber(page);
  const clauses = [];
  const args = [];
  if (status !== "all") clauses.push(`archived_at IS ${status === "active" ? "NULL" : "NOT NULL"}`);
  if (kind) { clauses.push("kind = ?"); args.push(choice(kind, ["consumable", "reusable"], "an item type")); }
  if (lowStock !== undefined && lowStock !== "" && lowStock !== false && lowStock !== "false") {
    if (lowStock !== true && lowStock !== "true") fail("invalid-input", "Choose a valid low-stock filter.");
    clauses.push("archived_at IS NULL AND quantity <= low_stock_threshold");
  }
  const term = searchTerm(search);
  if (term) { clauses.push("(instr(lower(name), ?) > 0 OR instr(lower(category), ?) > 0 OR instr(lower(location), ?) > 0)"); args.push(term, term, term); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const database = await store(client);
  const [records, count, summary] = await database.batch([
    { sql: `SELECT * FROM admin_inventory_items ${where} ORDER BY name COLLATE NOCASE, id LIMIT ? OFFSET ?`, args: [...args, OPERATIONS_PAGE_SIZE, (current - 1) * OPERATIONS_PAGE_SIZE] },
    { sql: `SELECT COUNT(*) AS count FROM admin_inventory_items ${where}`, args },
    "SELECT COUNT(*) AS active, COALESCE(SUM(CASE WHEN quantity <= low_stock_threshold THEN 1 ELSE 0 END),0) AS low FROM admin_inventory_items WHERE archived_at IS NULL",
  ], "read");
  return { items: records.rows.map(itemView), summary: { activeItems: Number(summary.rows[0].active), lowStockItems: Number(summary.rows[0].low) },
    pagination: pagination(current, Number(count.rows[0].count)) };
}

async function addMovement(tx, itemId, type, change, after, reason, now) {
  const result = await tx.execute({ sql: "INSERT INTO admin_inventory_movements (id,item_id,type,quantity_change,quantity_after,reason,created_at) VALUES (?,?,?,?,?,?,?) RETURNING *",
    args: [randomUUID(), itemId, type, change, after, reason, now] });
  return movementView(result.rows[0]);
}

export async function createInventoryItem(input, { client, now = Date.now() } = {}) {
  const clean = itemInput(input, true);
  const recordId = randomUUID();
  const time = timestamp(now);
  const database = await store(client);
  return write(database, async (tx) => {
    const result = await tx.execute({ sql: "INSERT INTO admin_inventory_items (id,name,kind,category,unit,quantity,low_stock_threshold,location,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) RETURNING *",
      args: [recordId, clean.name, clean.kind, clean.category, clean.unit, clean.quantity, clean.threshold, clean.location, clean.notes, time, time] });
    if (clean.quantity > 0) await addMovement(tx, recordId, "opening", clean.quantity, clean.quantity, "Opening count", time);
    return itemView(result.rows[0]);
  });
}

export async function updateInventoryItem(recordId, input, { client, now = Date.now() } = {}) {
  const clean = itemInput(input, false);
  const database = await store(client);
  return write(database, async (tx) => {
    const row = await find(tx, "admin_inventory_items", recordId);
    if (row.archived_at != null) fail("item-archived", "Archived inventory can be reviewed but cannot be edited.", 409);
    checkVersion(row, input.expectedUpdatedAt);
    const result = await tx.execute({ sql: "UPDATE admin_inventory_items SET name=?,category=?,unit=?,low_stock_threshold=?,location=?,notes=?,updated_at=? WHERE id=? RETURNING *",
      args: [clean.name, clean.category, clean.unit, clean.threshold, clean.location, clean.notes, Math.max(timestamp(now), Number(row.updated_at) + 1), row.id] });
    return itemView(result.rows[0]);
  });
}

export async function archiveInventoryItem(recordId, input = {}, { client, now = Date.now() } = {}) {
  shape(input, []);
  const database = await store(client);
  return write(database, async (tx) => {
    const row = await find(tx, "admin_inventory_items", recordId);
    checkVersion(row, input.expectedUpdatedAt);
    if (row.archived_at != null) return itemView(row);
    const time = Math.max(timestamp(now), Number(row.updated_at) + 1);
    const result = await tx.execute({ sql: "UPDATE admin_inventory_items SET archived_at=?,updated_at=? WHERE id=? RETURNING *", args: [time, time, row.id] });
    return itemView(result.rows[0]);
  });
}

export async function adjustInventory(recordId, input, { client, now = Date.now() } = {}) {
  shape(input, ["type", "quantity", "reason"]);
  const type = choice(input.type, ["restock", "use", "damaged", "missing", "correction"], "a stock adjustment type");
  const amount = quantity(input.quantity, type === "correction" ? "the counted quantity" : "the adjustment quantity", type === "correction" ? 0 : 1);
  const reason = text(input.reason, "the adjustment reason", 300);
  const database = await store(client);
  return write(database, async (tx) => {
    const row = await find(tx, "admin_inventory_items", recordId);
    if (row.archived_at != null) fail("item-archived", "Archived inventory cannot receive stock adjustments.", 409);
    checkVersion(row, input.expectedUpdatedAt, type === "correction");
    if (type === "use" && row.kind === "reusable") fail("invalid-adjustment", "Reusable items stay in stock when used. Record damage, loss, restocking, or a count correction instead.");
    const after = type === "correction" ? amount : Number(row.quantity) + (type === "restock" ? amount : -amount);
    if (after < 0) fail("insufficient-stock", "This adjustment would make usable stock negative. Check the current quantity.", 409);
    if (after > MAX_QUANTITY) fail("invalid-quantity", "The usable quantity cannot exceed 1,000,000.");
    const time = Math.max(timestamp(now), Number(row.updated_at) + 1);
    const result = await tx.execute({ sql: "UPDATE admin_inventory_items SET quantity=?,updated_at=? WHERE id=? RETURNING *", args: [after, time, row.id] });
    const movement = await addMovement(tx, row.id, type, after - Number(row.quantity), after, reason, time);
    return { item: itemView(result.rows[0]), movement };
  });
}

export async function getInventoryHistory(recordId, { page = 1 } = {}, { client } = {}) {
  const current = pageNumber(page);
  const database = await store(client);
  const [records, history, count] = await database.batch([
    { sql: "SELECT * FROM admin_inventory_items WHERE id=?", args: [id(recordId)] },
    { sql: "SELECT * FROM admin_inventory_movements WHERE item_id=? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?", args: [recordId, OPERATIONS_PAGE_SIZE, (current - 1) * OPERATIONS_PAGE_SIZE] },
    { sql: "SELECT COUNT(*) AS count FROM admin_inventory_movements WHERE item_id=?", args: [recordId] },
  ], "read");
  if (!records.rows[0]) fail("not-found", "This inventory item was not found.", 404);
  return { item: itemView(records.rows[0]), movements: history.rows.map(movementView), pagination: pagination(current, Number(count.rows[0].count)) };
}
