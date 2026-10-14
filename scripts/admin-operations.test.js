import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import {
  adjustInventory, archiveInventoryItem, createExpense, createInventoryItem, currentOperationsMonth, deleteExpense,
  getFinancialOverview, getInventoryHistory, initializeAdminOperations, listExpenses, listInventory, parseExpenseAmount, updateExpense, updateInventoryItem,
} from "../lib/admin-operations.js";

const now = Date.parse("2030-01-01T16:10:00Z");
const rejectCode = (code) => (error) => error?.code === code;
const expense = (overrides = {}) => ({ spentDate: "2030-02-01", category: "supplies", description: "Restock guest soap", amount: "250.50", supplier: "Local store", notes: "", ...overrides });
const item = (overrides = {}) => ({ name: "Guest soap", kind: "consumable", category: "Toiletries", unit: "pieces", quantity: 10, lowStockThreshold: 2,
  location: "Supply cupboard", notes: "", ...overrides });
const metadata = (record, overrides = {}) => ({ name: record.name, category: record.category, unit: record.unit, lowStockThreshold: record.lowStockThreshold,
  location: record.location, notes: record.notes, expectedUpdatedAt: record.updatedAt, ...overrides });

async function database(operation) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "haus26-operations-"));
  const url = `file:${path.join(directory, "operations.db").replaceAll("\\", "/")}`;
  const client = createClient({ url });
  try { await operation(client, url); }
  finally {
    client.close();
    globalThis.gc?.();
    await new Promise((resolve) => setImmediate(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith("haus26-operations-"));
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 25 });
  }
}

test("expense amounts preserve centavos and reject coercion, excess precision, and invalid bounds", () => {
  assert.equal(parseExpenseAmount("0.01"), 1);
  assert.equal(parseExpenseAmount("12.3"), 1230);
  assert.equal(parseExpenseAmount(" 100.10 "), 10010);
  assert.equal(parseExpenseAmount("99999999.99"), 9999999999);
  for (const value of [12, null, {}, "", "0", "-12", "+12", "1e3", "1,000", "1.001", "100000000", "Infinity", "NaN", "1."]) {
    assert.throws(() => parseExpenseAmount(value), rejectCode("invalid-amount"));
  }
});

test("the default month follows Manila even when UTC is still in the previous month", () => {
  assert.equal(currentOperationsMonth(Date.parse("2030-02-28T18:00:00Z")), "2030-03");
});

test("operations schema initializes once, remains durable, and preserves existing booking tables", async () => {
  await database(async (client, url) => {
    await client.execute("CREATE TABLE bookings (id TEXT PRIMARY KEY, name TEXT)");
    await client.execute({ sql: "INSERT INTO bookings (id,name) VALUES (?,?)", args: ["existing", "Guest fixture"] });
    await Promise.all([initializeAdminOperations(client), initializeAdminOperations(client)]);
    const record = await createExpense(expense(), { client, now });
    assert.equal((await client.execute("SELECT name FROM bookings WHERE id='existing'")).rows[0].name, "Guest fixture");
    const reopened = createClient({ url });
    try { assert.equal((await listExpenses({ month: "2030-02" }, { client: reopened })).expenses[0].id, record.id); }
    finally { reopened.close(); }
  });
});

test("expenses support monthly categories, bills, exact totals, updates, and guarded deletion", async () => {
  await database(async (client) => {
    const first = await createExpense(expense(), { client, now });
    await createExpense(expense({ category: "water", amount: "1250.25", description: "February water bill" }), { client, now });
    await createExpense(expense({ category: "electricity", amount: "2500", description: "February electricity bill" }), { client, now });
    await createExpense(expense({ spentDate: "2030-03-01", amount: "50" }), { client, now });
    let result = await listExpenses({ month: "2030-02", category: "water", search: "bill" }, { client });
    assert.equal(result.expenses.length, 1);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.summary.count, 3);
    assert.equal(result.summary.totalAmount, 400075);
    assert.deepEqual(result.summary.byCategory.map((row) => row.category), ["electricity", "water", "supplies"]);
    const updated = await updateExpense(first.id, expense({ amount: "75.01", expectedUpdatedAt: first.updatedAt }), { client, now });
    assert.equal(updated.amount, 7501);
    assert.notEqual(updated.updatedAt, first.updatedAt);
    await assert.rejects(updateExpense(first.id, expense({ expectedUpdatedAt: first.updatedAt }), { client, now }), rejectCode("record-changed"));
    await assert.rejects(deleteExpense(first.id, { expectedUpdatedAt: first.updatedAt }, { client }), rejectCode("record-changed"));
    assert.deepEqual(await deleteExpense(first.id, { expectedUpdatedAt: updated.updatedAt }, { client }), { deleted: true });
    result = await listExpenses({ month: "2030-02" }, { client });
    assert.equal(result.summary.totalAmount, 375025);
    await assert.rejects(deleteExpense(first.id, {}, { client }), rejectCode("not-found"));
  });
});

test("expense validation rejects impossible dates, unsupported categories, and unbounded text", async () => {
  await database(async (client) => {
    for (const spentDate of ["2030-13-01", "2030-01-99", "2030-02-29", "2030-04-31", "1899-01-01", "2030-2-01", null]) {
      await assert.rejects(createExpense(expense({ spentDate }), { client }), rejectCode("invalid-date"));
    }
    await assert.rejects(createExpense(expense({ category: "fake" }), { client }), rejectCode("invalid-input"));
    await assert.rejects(createExpense(expense({ description: "a".repeat(241) }), { client }), rejectCode("invalid-input"));
    await assert.rejects(createExpense(expense({ notes: "bad\0input" }), { client }), rejectCode("invalid-input"));
    await assert.rejects(createExpense(expense({ unrecognized: true }), { client }), rejectCode("invalid-input"));
    await createExpense(expense({ spentDate: "2032-02-29" }), { client });
    await createExpense(expense({ spentDate: "9999-12-31" }), { client });
    assert.equal((await listExpenses({ month: "9999-12" }, { client })).summary.count, 1);
    for (const month of ["2030-00", "2030-13", "invalid", "2030-2"]) {
      await assert.rejects(listExpenses({ month }, { client }), rejectCode("invalid-month"));
    }
  });
});

test("expense filters and pagination operate over all records without truncating monthly totals", async () => {
  await database(async (client) => {
    for (let index = 0; index < 55; index++) await createExpense(expense({ description: index === 54 ? "Find %_ literal text" : `Purchase ${index}`, amount: "1.25" }), { client, now: now + index });
    const first = await listExpenses({ month: "2030-02" }, { client });
    const second = await listExpenses({ month: "2030-02", page: "2" }, { client });
    assert.equal(first.expenses.length, 50);
    assert.equal(second.expenses.length, 5);
    assert.equal(first.pagination.total, 55);
    assert.equal(first.pagination.pages, 2);
    assert.equal(first.summary.totalAmount, 6875);
    const filtered = await listExpenses({ month: "2030-02", search: "%_" }, { client });
    assert.equal(filtered.expenses.length, 1);
    assert.equal(filtered.summary.count, 55);
    await assert.rejects(listExpenses({ month: "2030-02", page: 100001 }, { client }), rejectCode("invalid-page"));
    await assert.rejects(listExpenses({ month: "2030-02", page: 1.5 }, { client }), rejectCode("invalid-page"));
  });
});

test("inventory movements keep stock, usable counts, threshold alerts, and explanations together", async () => {
  await database(async (client) => {
    const created = await createInventoryItem(item(), { client, now });
    assert.equal(created.isLowStock, false);
    const used = await adjustInventory(created.id, { type: "use", quantity: 8, reason: "Guest rooms restocked" }, { client, now });
    assert.equal(used.item.quantity, 2);
    assert.equal(used.item.isLowStock, true);
    assert.equal(used.movement.quantityChange, -8);
    const restocked = await adjustInventory(created.id, { type: "restock", quantity: 5, reason: "Store purchase" }, { client, now });
    assert.equal(restocked.item.quantity, 7);
    await adjustInventory(created.id, { type: "damaged", quantity: 1, reason: "Package torn" }, { client, now });
    const missing = await adjustInventory(created.id, { type: "missing", quantity: 1, reason: "Missing at stocktake" }, { client, now });
    assert.equal(missing.item.quantity, 5);
    const history = await getInventoryHistory(created.id, {}, { client });
    assert.deepEqual(history.movements.map((entry) => entry.type), ["missing", "damaged", "restock", "use", "opening"]);
    assert.equal(history.pagination.total, 5);
    assert.equal(history.movements[0].quantityAfter, history.item.quantity);
    assert.equal(history.movements.at(-1).reason, "Opening count");
  });
});

test("stock failures leave neither a negative balance nor an orphan movement", async () => {
  await database(async (client) => {
    const created = await createInventoryItem(item({ quantity: 1 }), { client, now });
    await assert.rejects(adjustInventory(created.id, { type: "use", quantity: 2, reason: "Too many" }, { client }), rejectCode("insufficient-stock"));
    await assert.rejects(adjustInventory(created.id, { type: "restock", quantity: 1000000, reason: "Too many" }, { client }), rejectCode("invalid-quantity"));
    await assert.rejects(adjustInventory(created.id, { type: "use", quantity: 0, reason: "Invalid" }, { client }), rejectCode("invalid-quantity"));
    await assert.rejects(adjustInventory(created.id, { type: "use", quantity: 1, reason: " " }, { client }), rejectCode("invalid-input"));
    await client.execute("CREATE TRIGGER reject_test_movement BEFORE INSERT ON admin_inventory_movements WHEN NEW.type = 'use' BEGIN SELECT RAISE(ABORT, 'test movement failure'); END");
    await assert.rejects(adjustInventory(created.id, { type: "use", quantity: 1, reason: "Force rollback" }, { client }));
    const history = await getInventoryHistory(created.id, {}, { client });
    assert.equal(history.item.quantity, 1);
    assert.equal(history.pagination.total, 1);
  });
});

test("concurrent stock adjustments apply each delta once and serialize quantity history", async () => {
  await database(async (client) => {
    const created = await createInventoryItem(item({ quantity: 5 }), { client, now });
    const results = await Promise.all(Array.from({ length: 10 }, (_, index) => adjustInventory(created.id,
      { type: "restock", quantity: 1, reason: `Delivery ${index}` }, { client, now })));
    assert.equal(new Set(results.map((entry) => entry.movement.id)).size, 10);
    assert.deepEqual(results.map((entry) => entry.item.quantity), [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    const history = await getInventoryHistory(created.id, {}, { client });
    assert.equal(history.item.quantity, 15);
    assert.equal(history.pagination.total, 11);
    const removals = await Promise.allSettled(Array.from({ length: 20 }, () => adjustInventory(created.id,
      { type: "use", quantity: 1, reason: "Room replenishment" }, { client, now })));
    assert.equal(removals.filter((entry) => entry.status === "fulfilled").length, 15);
    assert.equal(removals.filter((entry) => entry.status === "rejected" && entry.reason.code === "insufficient-stock").length, 5);
    assert.equal((await getInventoryHistory(created.id, {}, { client })).item.quantity, 0);
  });
});

test("count corrections require a current record version and allow an explicit zero count", async () => {
  await database(async (client) => {
    const created = await createInventoryItem(item(), { client, now });
    await assert.rejects(adjustInventory(created.id, { type: "correction", quantity: 4, reason: "Shelf count" }, { client }), rejectCode("invalid-version"));
    const restocked = await adjustInventory(created.id, { type: "restock", quantity: 2, reason: "Delivery" }, { client, now });
    await assert.rejects(adjustInventory(created.id, { type: "correction", quantity: 4, reason: "Shelf count", expectedUpdatedAt: created.updatedAt }, { client }), rejectCode("record-changed"));
    const corrected = await adjustInventory(created.id, { type: "correction", quantity: 0, reason: "Counted none left", expectedUpdatedAt: restocked.item.updatedAt }, { client, now });
    assert.equal(corrected.item.quantity, 0);
    assert.equal(corrected.movement.quantityChange, -12);
    assert.equal(corrected.item.isLowStock, true);
  });
});

test("metadata edits preserve quantities and type; archiving preserves history and removes active alerts", async () => {
  await database(async (client) => {
    const created = await createInventoryItem(item({ quantity: 1, kind: "reusable", name: "Bath towels" }), { client, now });
    await assert.rejects(adjustInventory(created.id, { type: "use", quantity: 1, reason: "Guest used towel" }, { client }), rejectCode("invalid-adjustment"));
    await assert.rejects(updateInventoryItem(created.id, metadata(created, { quantity: 50 }), { client }), rejectCode("invalid-input"));
    await assert.rejects(updateInventoryItem(created.id, metadata(created, { kind: "consumable" }), { client }), rejectCode("invalid-input"));
    const updated = await updateInventoryItem(created.id, metadata(created, { name: "White bath towels" }), { client, now });
    assert.equal(updated.quantity, 1);
    assert.equal(updated.kind, "reusable");
    await assert.rejects(updateInventoryItem(created.id, metadata(created), { client, now }), rejectCode("record-changed"));
    const archived = await archiveInventoryItem(created.id, { expectedUpdatedAt: updated.updatedAt }, { client, now });
    assert.ok(archived.archivedAt);
    assert.equal(archived.isLowStock, false);
    assert.deepEqual((await listInventory({}, { client })).summary, { activeItems: 0, lowStockItems: 0 });
    assert.equal((await listInventory({ status: "archived" }, { client })).items.length, 1);
    assert.equal((await getInventoryHistory(created.id, {}, { client })).movements.length, 1);
    await assert.rejects(adjustInventory(created.id, { type: "missing", quantity: 1, reason: "Missing" }, { client }), rejectCode("item-archived"));
    await assert.rejects(updateInventoryItem(created.id, metadata(archived), { client }), rejectCode("item-archived"));
  });
});

test("inventory lists and movement histories paginate with all-record filters and global summaries", async () => {
  await database(async (client) => {
    for (let index = 0; index < 52; index++) await createInventoryItem(item({ name: `Item ${String(index).padStart(2, "0")}`, quantity: 0,
      kind: index === 51 ? "reusable" : "consumable", location: index === 51 ? "Find %_ here" : "Store" }), { client, now });
    const first = await listInventory({}, { client });
    const second = await listInventory({ page: 2 }, { client });
    const filtered = await listInventory({ kind: "reusable", lowStock: "true", search: "%_" }, { client });
    assert.equal(first.items.length, 50);
    assert.equal(second.items.length, 2);
    assert.equal(filtered.pagination.total, 1);
    assert.deepEqual(filtered.summary, { activeItems: 52, lowStockItems: 52 });
    const selected = filtered.items[0];
    for (let index = 0; index < 55; index++) await adjustInventory(selected.id, { type: "restock", quantity: 1, reason: `Restock ${index}` }, { client, now });
    const history = await getInventoryHistory(selected.id, { page: 2 }, { client });
    assert.equal(history.movements.length, 5);
    assert.equal(history.pagination.total, 55);
    assert.equal(history.item.quantity, 55);
    await assert.rejects(listInventory({ lowStock: "maybe" }, { client }), rejectCode("invalid-input"));
    await assert.rejects(listInventory({ status: "unknown" }, { client }), rejectCode("invalid-input"));
    await assert.rejects(getInventoryHistory(randomUUID(), {}, { client }), rejectCode("not-found"));
    await assert.rejects(createInventoryItem(item({ quantity: "1" }), { client }), rejectCode("invalid-quantity"));
    await assert.rejects(createInventoryItem(item({ lowStockThreshold: -1 }), { client }), rejectCode("invalid-quantity"));
  });
});

const routeFixtures = new Map();
globalThis.__haus26OperationsRouteFixtures = routeFixtures;
let routeFixtureId = 0;
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function routeFixture(operation, { signedIn = false, limited = false } = {}) {
  const fixtureId = ++routeFixtureId;
  const savedSecret = process.env.BOOKING_SESSION_SECRET;
  process.env.BOOKING_SESSION_SECRET = "operations-route-fixture-session-secret-32-characters";
  const calls = { sessions: 0, rateStores: 0, operations: [] };
  const fixture = {
    async getAdminSession() { calls.sessions++; return signedIn; },
    async getBookingStore() {
      calls.rateStores++;
      return { async execute(statement) {
        if (typeof statement === "object" && statement.sql.startsWith("INSERT INTO booking_rate_limits")) return { rows: [{ attempts: limited ? 61 : 1 }] };
        return { rows: [] };
      } };
    },
  };
  const operationNames = ["createExpense", "deleteExpense", "listExpenses", "updateExpense", "adjustInventory", "archiveInventoryItem", "createInventoryItem", "listInventory", "updateInventoryItem", "getInventoryHistory", "getFinancialOverview"];
  for (const name of operationNames) fixture[name] = async (...args) => {
    calls.operations.push({ name, args });
    if (name === "deleteExpense") return { deleted: true };
    if (name === "adjustInventory") return { item: { id: "fixture" }, movement: { id: "movement" } };
    return { id: "fixture" };
  };
  routeFixtures.set(fixtureId, fixture);
  try {
    // Exercise real HTTP origin, body, rate-limit, and response code with isolated auth and storage boundaries.
    const boundaryModule = moduleUrl(`
      const fixture = globalThis.__haus26OperationsRouteFixtures.get(${fixtureId});
      export const getAdminSession = (...args) => fixture.getAdminSession(...args);
      export const getBookingStore = (...args) => fixture.getBookingStore(...args);
      export const getPaymentConfig = () => ({siteUrl:'https://haus.example'});
      export const NextResponse = {json: (data, options) => new Response(JSON.stringify(data), {...options,headers:{'Content-Type':'application/json',...options?.headers}})};
      ${operationNames.map((name) => `export const ${name} = (...args) => fixture.${name}(...args);`).join("\n")}
    `);
    let httpSource = await readFile(new URL("../lib/booking-http.js", import.meta.url), "utf8");
    for (const specifier of ["next/server", "./payments.js", "./booking-store.js", "./booking-auth.js"]) {
      httpSource = httpSource.replaceAll(JSON.stringify(specifier), JSON.stringify(boundaryModule));
    }
    const httpModule = moduleUrl(httpSource + `\n// fixture ${fixtureId}`);
    const routes = {};
    for (const [name, routePath] of Object.entries({
      expenses: "../app/api/admin/expenses/route.js",
      inventory: "../app/api/admin/inventory/route.js",
      history: "../app/api/admin/inventory/[id]/route.js",
      financials: "../app/api/admin/financials/route.js",
    })) {
      let routeSource = await readFile(new URL(routePath, import.meta.url), "utf8");
      routeSource = routeSource.replaceAll(JSON.stringify("@/lib/admin-operations"), JSON.stringify(boundaryModule))
        .replaceAll(JSON.stringify("@/lib/booking-http"), JSON.stringify(httpModule));
      routes[name] = await import(moduleUrl(routeSource + `\n// fixture ${fixtureId}`));
    }
    await operation(routes, calls);
  } finally {
    routeFixtures.delete(fixtureId);
    if (savedSecret === undefined) delete process.env.BOOKING_SESSION_SECRET;
    else process.env.BOOKING_SESSION_SECRET = savedSecret;
  }
}

const routeRequest = (path, body = undefined, headers = {}) => new Request(`https://haus.example/api/admin/${path}`, body === undefined ? {} : {
  method: "POST", headers: { origin: "https://haus.example", "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body),
});

test("all operations reads reject unauthenticated callers before consulting storage", async () => {
  await routeFixture(async (routes, calls) => {
    for (const [name, route] of Object.entries(routes)) {
      const response = await route.GET(routeRequest(name), { params: Promise.resolve({ id: randomUUID() }) });
      assert.equal(response.status, 401);
      assert.equal((await response.json()).error.code, "unauthorized");
      assert.match(response.headers.get("Cache-Control"), /no-store/);
    }
    assert.equal(calls.sessions, 4);
    assert.equal(calls.rateStores, 0);
    assert.deepEqual(calls.operations, []);
  });
});

test("operations mutations require sign-in before rate storage or record mutation", async () => {
  await routeFixture(async (routes, calls) => {
    for (const name of ["expenses", "inventory"]) {
      const response = await routes[name].POST(routeRequest(name, { action: "create" }));
      assert.equal(response.status, 401);
    }
    assert.equal(calls.rateStores, 0);
    assert.deepEqual(calls.operations, []);
  });
});

test("forged and missing origins reject operations mutations before authentication or storage", async () => {
  await routeFixture(async (routes, calls) => {
    for (const name of ["expenses", "inventory"]) {
      for (const origin of ["https://other.example", "null", ""]) {
        const response = await routes[name].POST(routeRequest(name, { action: "create" }, { origin }));
        assert.equal(response.status, 403);
        assert.equal((await response.json()).error.code, "origin");
      }
    }
    assert.equal(calls.sessions, 0);
    assert.equal(calls.rateStores, 0);
    assert.deepEqual(calls.operations, []);
  }, { signedIn: true });
});

test("operations mutation rate limits stop requests before parsing or mutation", async () => {
  await routeFixture(async (routes, calls) => {
    for (const name of ["expenses", "inventory"]) {
      const response = await routes[name].POST(routeRequest(name, "malformed JSON"));
      assert.equal(response.status, 429);
      assert.equal((await response.json()).error.code, "rate-limited");
      assert.equal(response.headers.get("Retry-After"), "900");
    }
    assert.equal(calls.rateStores, 2);
    assert.deepEqual(calls.operations, []);
  }, { signedIn: true, limited: true });
});

test("real body parsing rejects non-JSON, malformed objects, and declared or streamed oversized bodies", async () => {
  await routeFixture(async (routes, calls) => {
    const cases = [
      [{ action: "create" }, { "content-type": "text/plain" }, 415, "content-type"],
      ["not json", {}, 400, "invalid-body"],
      ["[]", {}, 400, "invalid-body"],
      ["null", {}, 400, "invalid-body"],
      ["{}", { "content-length": "8193" }, 413, "too-large"],
      [{ action: "create", notes: "a".repeat(8192) }, {}, 413, "too-large"],
    ];
    for (const name of ["expenses", "inventory"]) {
      for (const [body, headers, status, code] of cases) {
        const response = await routes[name].POST(routeRequest(name, body, headers));
        assert.equal(response.status, status);
        assert.equal((await response.json()).error.code, code);
      }
    }
    assert.deepEqual(calls.operations, []);
  }, { signedIn: true });
});

test("authorized action routes dispatch only supported actions and forward collection filters", async () => {
  await routeFixture(async (routes, calls) => {
    assert.equal((await routes.expenses.POST(routeRequest("expenses", { action: "create", ...expense() }))).status, 201);
    assert.equal((await routes.inventory.POST(routeRequest("inventory", { action: "create", ...item() }))).status, 201);
    assert.equal((await routes.expenses.POST(routeRequest("expenses", { action: "unsupported" }))).status, 400);
    assert.equal((await routes.inventory.POST(routeRequest("inventory", { action: "unsupported" }))).status, 400);
    await routes.expenses.GET(routeRequest("expenses?month=2030-02&category=water&search=bill&page=2"));
    await routes.inventory.GET(routeRequest("inventory?status=all&kind=reusable&lowStock=true&search=towel&page=2"));
    await routes.history.GET(routeRequest("inventory/fixture?page=2"), { params: Promise.resolve({ id: "fixture" }) });
    await routes.financials.GET(routeRequest("financials?month=2030-02"));
    assert.deepEqual(calls.operations.map((call) => call.name), ["createExpense", "createInventoryItem", "listExpenses", "listInventory", "getInventoryHistory", "getFinancialOverview"]);
    assert.deepEqual(calls.operations[2].args[0], { month: "2030-02", page: "2", category: "water", search: "bill" });
    assert.deepEqual(calls.operations[3].args[0], { status: "all", page: "2", kind: "reusable", lowStock: "true", search: "towel" });
    assert.deepEqual(calls.operations[4].args, ["fixture", { page: "2" }]);
    assert.deepEqual(calls.operations[5].args[0], { month: "2030-02" });
    assert.equal(calls.rateStores, 4);
  }, { signedIn: true });
});

test("financial overview aggregates monthly revenue, expenses, net operating income, and profit margins", async () => {
  await database(async (client) => {
    await client.execute(`CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY, livemode INTEGER NOT NULL, status TEXT NOT NULL,
      stay_date TEXT NOT NULL, total_amount INTEGER, deposit_amount INTEGER,
      balance_paid_at INTEGER, days INTEGER
    )`);
    // Confirmed booking for February 2030 (PHP 10,000 total, PHP 5,000 deposit, balance paid, 2 nights)
    await client.execute({
      sql: "INSERT INTO bookings (id, livemode, status, stay_date, total_amount, deposit_amount, balance_paid_at, days) VALUES (?,?,?,?,?,?,?,?)",
      args: ["b1", 1, "confirmed", "2030-02-10", 1000000, 500000, 123456, 2],
    });
    // Another confirmed booking for March 2030 (PHP 5,000 total, PHP 2,500 deposit paid only, 1 night)
    await client.execute({
      sql: "INSERT INTO bookings (id, livemode, status, stay_date, total_amount, deposit_amount, balance_paid_at, days) VALUES (?,?,?,?,?,?,?,?)",
      args: ["b2", 1, "confirmed", "2030-03-05", 500000, 250000, null, 1],
    });
    // Test booking (livemode = 0, should be excluded from financial revenue)
    await client.execute({
      sql: "INSERT INTO bookings (id, livemode, status, stay_date, total_amount, deposit_amount, balance_paid_at, days) VALUES (?,?,?,?,?,?,?,?)",
      args: ["b-test", 0, "confirmed", "2030-02-12", 2000000, 1000000, null, 1],
    });

    // Expenses for February 2030 (Water PHP 1,200, Electricity PHP 2,800)
    await createExpense(expense({ spentDate: "2030-02-05", category: "water", description: "Water bill", amount: "1200.00" }), { client, now });
    await createExpense(expense({ spentDate: "2030-02-15", category: "electricity", description: "Electricity bill", amount: "2800.00" }), { client, now });
    // Expense for March 2030 (Cleaning PHP 500)
    await createExpense(expense({ spentDate: "2030-03-01", category: "cleaning", description: "Cleaning", amount: "500.00" }), { client, now });

    const feb = await getFinancialOverview({ month: "2030-02" }, { client });
    assert.equal(feb.month, "2030-02");
    assert.equal(feb.monthly.confirmedRevenue, 1000000); // PHP 10,000.00
    assert.equal(feb.monthly.collectedDeposits, 500000);
    assert.equal(feb.monthly.collectedBalances, 500000);
    assert.equal(feb.monthly.collectedCash, 1000000);
    assert.equal(feb.monthly.totalExpenses, 400000); // PHP 4,000.00
    assert.equal(feb.monthly.netOperatingIncome, 600000); // PHP 6,000.00 Net Operating Income
    assert.equal(feb.monthly.netCashFlow, 600000);
    assert.equal(feb.monthly.profitMargin, 60); // 60%
    assert.equal(feb.monthly.expenseRatio, 40); // 40%
    assert.equal(feb.monthly.confirmedStays, 1);
    assert.equal(feb.monthly.bookedNights, 2);
    assert.equal(feb.monthly.expenseCategories.length, 2);

    // All-time aggregates across all months
    assert.equal(feb.allTime.confirmedRevenue, 1500000); // PHP 15,000.00
    assert.equal(feb.allTime.collectedCash, 1250000); // 10k + 2.5k
    assert.equal(feb.allTime.totalExpenses, 450000); // PHP 4,500.00
    assert.equal(feb.allTime.netOperatingIncome, 1050000); // PHP 10,500.00 Net Profit
    assert.equal(feb.allTime.profitMargin, 70); // 70%
  });
});
