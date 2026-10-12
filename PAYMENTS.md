# Booking deposits

HauS 26 website bookings use the listed rates and a 50% deposit, with a 30-minute payment hold. The booking module creates an individual checkout after the guest chooses available dates and reviews the quote. The separate host CLI described below still creates custom, host-confirmed payment requests.

The booking module calculates prices on the server; guests cannot supply their own payable amount. PayMongo stores the transaction, and the booking database records verified payment and calendar holds. Standalone CLI requests are created from the host's computer and must be reconciled separately. See [BOOKINGS.md](BOOKINGS.md) for the website flow and Vercel database setup.

## Configure test mode

1. Log in to your [PayMongo dashboard](https://dashboard.paymongo.com/). Under **Settings > Product Settings > Developers**, find the **Secret Test Key** starting with `sk_test_`. Test keys are available before live activation; having an account does not establish that live payments or individual payment methods are ready. See [PayMongo's API key guide](https://docs.paymongo.com/docs/account-settings-api-keys).
2. If `.env.local` does not exist, copy `.env.example` to `.env.local`. Paste the test secret key directly into `PAYMONGO_SECRET_KEY` in that private local file. This integration does not use the public `pk_test_` key. Do not paste secret keys into chat.
3. If `PAYMENT_LINK_SECRET` is blank, generate it once with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Preserve an existing value, and keep the same value on the host's computer and the deployed website. Changing it invalidates existing guest links.
4. Set `SITE_URL` to the website's exact origin, such as `http://localhost:3000` for local testing. Use an HTTPS origin for deployment. It must match the URL guests open, including `www` if applicable.
5. Set `PAYMONGO_PAYMENT_METHODS` to the payment methods activated for your account, such as `card,gcash`. Keep `PAYMENTS_LIVE_ENABLED=false` during testing.

All configuration is server-side. Never rename these variables with a `NEXT_PUBLIC_` prefix, put keys in `lib/property.js`, or commit `.env.local`.

Save `.env.local` and restart the development server after changing it. Begin with a sandbox card or GCash checkout using the provider's [testing guide](https://docs.paymongo.com/docs/payment-acceptance-testing); live approval can be checked separately before launch.

## Create a confirmed booking's payment request

Use an opaque, unique booking reference without the guest's name, phone number, or email. Use that same reference for all retries of this request.

```powershell
npm run payment:request -- create --confirmed --reference H26-20261120-001 --date 2026-11-20 --guests 4 --total 5000
```

The example produces a ₱2,500 deposit for an agreed ₱5,000 stay. The total is your confirmed quote, not an automatic calculation from the public starting rate. These example details are for testing, not a real reservation.

The command prints the guest's website payment link. Share it in your existing conversation with the guest. No messages are sent automatically.

Each reference is saved in `.payment-requests/`, which is excluded from Git. Keep this folder backed up privately and create requests from one host workspace. Running the same command again reuses its checkout. Changing the quote under the same reference is refused. A failed creation retains its retry information; after PayMongo's 24-hour idempotency window, an unresolved attempt requires reconciliation in the dashboard before any replacement is created.

```powershell
npm run payment:request -- show --reference H26-20261120-001
npm run payment:request -- expire --reference H26-20261120-001
```

Expire an unpaid request in PayMongo before releasing the date or replacing the quote. Deleting a local link or navigating away from checkout does not cancel it. A paid request must be handled through the provider's refund process; do not create another request for the same deposit.

## Standalone host request flow

1. The guest inquires through the existing form.
2. The host confirms the date, final rate, and cancellation/rescheduling terms, then creates and shares the payment request.
3. The guest reviews the request on the website and continues to PayMongo.
4. On return, the website retrieves PayMongo's payment record. A redirect alone is never treated as proof of payment. If cookies are unavailable, the guest can reopen their original link to check the same request.
5. The host verifies the reference and payment in PayMongo, finalizes the reservation, and updates `property.bookedDates` manually. Agree the timing of the remaining balance with the guest.

No card details are collected by this website. Private payment pages are excluded from indexing and use no-store caching and origin-only referrer headers. The checkout redirect uses a no-referrer policy. Test-mode requests and receipts are visibly labeled as tests.

## Go live

Complete a sandbox checkout with your own test merchant account first. Verify pending, paid, cancellation, expired, and refund behavior, and confirm that the correct booking reference and deposit appear in your dashboard.

Once PayMongo activates your merchant account and payment methods, set the deployed site and host workspace to the live secret key, the same `PAYMENT_LINK_SECRET`, the correct HTTPS `SITE_URL`, and `PAYMENTS_LIVE_ENABLED=true`. Deploy the configuration and code. Do not share test links as live requests.

The website booking module now provides a durable database, private host dashboard, calendar holds, and verified payment updates; see [BOOKINGS.md](BOOKINGS.md). Standalone CLI payment requests remain separate and do not reserve dates. Use the booking dashboard for website reservations. Vercel requires the remote database to be configured before taking booking requests.

## Verification and provider references

Run `npm test` and `npm run build`. Payment tests use mocked provider responses and do not charge anyone. Merchant sandbox and native wallet/card flows require your configured provider account.

The framework is pinned to Next.js 15.5.27. PostCSS 8.5.29 and Sharp 0.35.5 overrides address the dependency findings present before this integration. Use Node.js 20.9 or newer. A clean `npm ci --ignore-scripts` installs the locked dependencies without running package lifecycle scripts.

Local verification on October 11, 2026 passed all 12 payment tests, property checks, the production build, and the dependency audit (zero findings). Chromium checks at 320, 768, 1024, and 1440px found no horizontal overflow on the real setup page or payment components rendered with fixture data; payment controls measured 48px high. Pending, test-paid, expired, refunded, and invalid-link messages were checked using those fixtures. The real unconfigured checkout returns 503, and a forged success query without a verified payment does not show receipt. A native-form browser regression confirmed that `strict-origin` permits the origin check without sending the private pathname in the referrer. These checks do not replace a PayMongo sandbox transaction; Firefox, Safari, and native wallet applications were not tested.

A merchant sandbox card checkout also passed on October 11, 2026 using reference `H26-TEST-20261011-001`: the website displayed a PHP 5,000 test quote and PHP 2,500 deposit, opened PayMongo through its native checkout button, and returned to a verified test receipt after the provider's documented successful test card was used. The host command independently retrieved the same paid test payment and deposit. No real money was collected, no reservation was made, and live payments remain disabled. Sandbox cancellation, expiration, refunds, GCash, and native wallet flows still need merchant-account testing before launch.

- [Hosted Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Create a V2 checkout](https://docs.paymongo.com/reference/create_checkout_sessions_2)
- [Retrieve a checkout](https://docs.paymongo.com/reference/get_checkout_sessions)
- [Checkout resource and payment status](https://docs.paymongo.com/reference/checkout-session-resource)
- [Idempotency and the 24-hour window](https://docs.paymongo.com/reference/idempotent-requests)
- [Expire a checkout](https://docs.paymongo.com/reference/create_checkout_sessions_id_expire)
