# Expenses and inventory

Open `/admin` with the existing host login, then choose **Expenses** or **Inventory**.

## Expenses

Record the date, category, description, and amount in Philippine pesos. Water and electricity bills have their own categories; cleaning, maintenance, supplies, laundry, staff, other utilities, and other expenses are also available. Supplier and notes are optional.

The selected month's total and category breakdown include every saved expense in that month. The ledger is paginated. Search and category filters search the full month's records, while the summary keeps the whole month's total. Edit incorrect entries or use the confirmed delete action to remove them. Amounts are stored as integer centavos.

These are manually recorded costs. Saving a bill does not pay it, track its due date, or establish whether it has been paid. Under **Financial Summary**, the dashboard contrasts confirmed booking revenue with recorded operating expenses to compute your monthly **Net Operating Income (NOI / Profit)**, **Profit Margin (%)**, and **Net Cash Flow**, along with category breakdown and all-time operational performance.

## Inventory

Add consumable supplies or reusable items with a category, unit, starting usable quantity, and low-stock threshold. Location and notes are optional. A quantity at or below the threshold is flagged for restocking. Quantities are whole units; choose a practical unit such as pieces, bottles, packs, or sets.

Use **Restock** to add stock. **Used** removes consumable supplies from the usable count; using a reusable item keeps it in inventory. **Damaged** and **Missing** remove unusable or lost units. **Count correction** replaces the count after a physical check. Each adjustment needs a reason and appears in the item's history with its resulting quantity. Stock cannot go below zero. A conflicting update asks you to refresh before retrying.

Edit item details separately from stock adjustments. An item's type stays fixed after creation. Archive an item when it is no longer tracked; its count and movement history remain available in the archived view. Search, type, and low-stock filters search the full inventory before pagination.

Inventory changes and expenses are separate records. When you buy supplies, record the purchase expense and the stock received in their respective sections.

## Storage and verification

Both sections use the configured booking libSQL database and existing private host session. Their additive tables initialize on first use; no new environment variables are required. Back up this database along with your reservations. Inventory and expense records do not have automatic retention or scheduled bill reminders.

`npm test` includes isolated database and API security checks. After `npm run build`, run `npm run test:operations:browser` to check the flows against a local production server with a temporary database, synthetic host credentials, and disabled notifications. This check does not use your host password or modify your configured database.
