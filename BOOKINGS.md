# Booking module

Guests request one 22-hour private stay at `/book` or through the home page. They receive a private status link. Requests do not reserve a date or take a payment. The host signs in at `/admin`, confirms the date, guest count, final total and agreed terms, then creates the existing PayMongo 50% deposit checkout.

Approval atomically holds the check-in date. A verified live deposit confirms the booking. A test payment is labeled `test_paid` and never presented as a real reservation. The calendar combines these holds with the manually entered dates in `lib/property.js`. Test and live holds are separate.

## Local setup

1. Keep the PayMongo configuration in `.env.local`; start with your test key.
2. Run `npm run booking:setup`. This preserves existing PayMongo keys and generates booking secrets plus a strong host password. The password is written privately to `.booking-data/admin-access.txt`, not printed or committed.
3. Run `npm run dev`, then open the exact `SITE_URL` configured in `.env.local`, normally `http://localhost:3000`.
4. Open `/admin/login` and use the password from the private access file. Save it in your password manager. Sessions expire after eight hours.

Local development stores bookings in `.booking-data/bookings.db`. The whole `.booking-data` directory is excluded from Git. Keep private backups. To replace the host password, run `npm run booking:setup -- --reset-password`; restart the website and update the deployed password hash. Existing sessions are revoked by changing the password hash. Preserve `BOOKING_TOKEN_SECRET`, `BOOKING_SESSION_SECRET`, and `PAYMENT_LINK_SECRET` between machines and deployments.

There is one host account, configured through secrets. There is no public admin registration. Guests need no account. Their status link is private: anyone with it can see the date, group size, approved quote and terms, but it does not reveal the guest's name, email, phone, or notes. Never put personal details in the booking terms or reference.

## Vercel and a persistent database

Vercel deployments must use a remote database. Local files are rejected on Vercel; redeploying must never erase reservations or split availability across instances.

This module uses the official [`@libsql/client`](https://docs.turso.tech/sdk/ts/reference) SDK. Create a **libSQL database** in [Turso](https://turso.tech/), then obtain its `libsql://...` URL and private auth token from the database settings. A new-engine `turso://...` database uses another SDK and does not work with this module.

With the [Turso CLI](https://docs.turso.tech/quickstart), sign in and run the following. Omit `--tursodb` so it creates a libSQL database. Keep the token output private.

```powershell
turso db create haus26-bookings
turso db show haus26-bookings --url
turso db tokens create haus26-bookings
```

In Vercel's project environment variables, configure:

- `BOOKING_DATABASE_URL`: the remote `libsql://...` URL.
- `BOOKING_DATABASE_AUTH_TOKEN`: the database's private token.
- `BOOKING_ADMIN_PASSWORD_HASH`, `BOOKING_SESSION_SECRET`, `BOOKING_TOKEN_SECRET`: the same values from your local `.env.local`.
- `PAYMONGO_SECRET_KEY`, `PAYMENT_LINK_SECRET`, `PAYMONGO_PAYMENT_METHODS`, `PAYMENTS_LIVE_ENABLED`: your existing payment configuration.
- `SITE_URL`: the exact HTTPS origin of the deployed site, without a path. Configure previews separately if you test them.

Choose the Node.js runtime, not an Edge runtime. Build with `npm run build`, then redeploy after setting variables. Schema tables initialize on first database access. Do not use a `NEXT_PUBLIC_` prefix for any credential.

To manage the same bookings locally, set the remote database URL and token in `.env.local` as well. Your local development database is not automatically migrated to Turso. Keep development test requests separate from production. This integration has not provisioned a Turso account, database, or Vercel deployment on your behalf.

## Host workflow

1. Review new requests in `/admin`. Contact the guest using the submitted details. There are no automatic emails or messages.
2. Confirm that the group can be accommodated, and agree cancellation, rescheduling and remaining-balance terms. The property has no configured maximum capacity; the module does not invent one.
3. Enter the final total in pesos and those agreed terms, then choose **Approve & create deposit**. The amount is an approved quote, never an automatic charge based on a starting-rate estimate.
4. Share the guest's private booking link. It shows the quote, terms, deposit and remaining balance, then opens PayMongo.
5. Payment return and booking refresh retrieve PayMongo's actual checkout record and update the booking. Use **Refresh payment status** if a guest paid but closed their browser. A redirect or a screenshot is not proof of payment.
6. Cancel an unpaid request with a reason. When a checkout exists, cancellation expires it in PayMongo and verifies that it is unpaid before releasing the date. Paid, refunded, partial-refund or pending-refund cases retain the hold for host review. Refunds and release decisions require reconciliation in PayMongo; this module does not issue refunds or auto-release those dates.

The agreed quote is frozen after approval. Retrying an interrupted creation reuses its stored idempotency key and checkout. An unresolved attempt beyond 23 hours requires dashboard reconciliation; the date stays held. Do not delete or edit database records to force another payment request. The earlier `payment:request` CLI remains available for standalone requests, but standalone CLI requests do not create a booking record or calendar hold.

## PayMongo webhook

For updates when a guest does not return, register `https://YOUR-SITE/api/payments/webhook` in PayMongo and subscribe to `checkout_session.payment.paid`. Set `PAYMONGO_WEBHOOK_SECRET` to that endpoint's signing secret, separate from the API key. Keep test and live webhook configuration aligned with the site's current key.

The handler validates `Paymongo-Signature` against timestamp plus exact raw body, enforces a five-minute timestamp window and payment mode, deduplicates event IDs in the database, and retrieves the stored checkout before updating the booking. Failed processing returns an error for retry. Without a configured endpoint secret, webhooks are refused; guest return and host refresh still work. See [PayMongo's webhook setup](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management).

## Contact details and retention

Names, email, phone, occasion, special requests and free-text terms are private booking data. They are stored for the host's review and contact purpose, behind password-protected endpoints. Guest links and public availability responses exclude contact data; request logs must not contain it. No guest contact data is included in the server-created PayMongo checkout payload; the hosted provider collects its own billing details.

Run `npm run booking:retention` monthly, or schedule it from a trusted host machine with database credentials. It redacts contact data and free text from inactive, past requests after 180 days, preserving non-personal reference and payment audit fields. Change `BOOKING_CONTACT_RETENTION_DAYS` if the host adopts a different retention period. It does not release dates, erase unresolved holds, or erase paid booking records. Paid-record retention and individual correction/deletion requests must be handled by the host according to the property's actual recordkeeping needs. Apply the same retention to private backups, and rerun the job after restoring a backup.

For a specific past completed or cancelled booking, the host can run `npm run booking:retention -- --erase BOOKING_UUID` to remove contact data and free text while preserving the financial metadata and date hold. Unresolved payment and refund cases are not eligible. This is an explicit host action, not an automatic paid-record deletion policy. Keep the same redaction in backup copies.

## Checks

Run `npm test` and `npm run build`. The booking tests use real temporary SQLite databases and mocked provider responses, including competing approvals, request retries, immutable quotes, exact payment verification, mode separation, provider failure and cancellation. `--expose-gc` is used only for Windows test-database cleanup.

Before accepting live bookings, configure the remote Vercel database, test a request through host approval and PayMongo return on the deployed origin, register and test the webhook, verify backup restoration, and confirm activated payment methods. Your merchant test key remains in use until the existing payment go-live steps in [PAYMENTS.md](PAYMENTS.md) are completed.
