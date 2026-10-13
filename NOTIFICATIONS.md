# Booking email and SMS

HauS 26 uses Resend for guest and host email, and UniSMS for guest SMS. Notifications start disabled. After a verified live deposit confirms a booking, the server queues one guest confirmation email, one guest confirmation SMS and one host email alert. Creating a request or returning from checkout without verified payment does not send a confirmation.

For the testing site at `https://the-haus-26.vercel.app`, use your own inbox and phone. Test payment messages say `TEST` and explain that they are not a real reservation. The test flag routes both guest and host email to the test inbox, and SMS to the test phone, regardless of the contact details in the booking.

## Set up your providers

1. Create a [Resend account](https://resend.com) using the inbox where you want to receive test messages, then create an API key. Without a verified sender domain, `onboarding@resend.dev` can send only to the email associated with your Resend account. Your Vercel website address is sufficient to test the site; sending email to other guests requires your own verified sender domain later. See [Resend's test sender restriction](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
2. In your [UniSMS dashboard](https://unismsapi.com/dashboard), obtain the API Secret key and the test Sender ID assigned to your account. Use that exact Sender ID rather than inventing a name. Check that it supports your phone's mobile network; the default Sender ID may have network restrictions. See the [UniSMS API documentation](https://unismsapi.com/docs/sms).

Keep keys in `.env.local` and Vercel's private environment variables. Do not paste keys into chat, browser code, screenshots, or Git. Do not use `NEXT_PUBLIC_` for these values.

## Configure a local test

Append the following entries to your existing `.env.local`, or update them if they already exist. Preserve your existing PayMongo, database and booking secrets. The blank values below need your own private values.

```dotenv
BOOKING_NOTIFICATIONS_ENABLED=true
BOOKING_NOTIFICATIONS_TEST_ENABLED=true
BOOKING_NOTIFICATION_TEST_EMAIL=
BOOKING_NOTIFICATION_TEST_PHONE=
RESEND_API_KEY=
BOOKING_EMAIL_FROM=onboarding@resend.dev
BOOKING_EMAIL_REPLY_TO=
BOOKING_HOST_EMAIL=
UNISMS_API_KEY=
UNISMS_SENDER_ID=
```

Set `BOOKING_NOTIFICATION_TEST_EMAIL` to the exact email you used for your Resend account. Set `BOOKING_HOST_EMAIL` to your inbox too; test booking alerts still use `BOOKING_NOTIFICATION_TEST_EMAIL`. Set `BOOKING_NOTIFICATION_TEST_PHONE` to your own Philippine mobile number. The app accepts `09...`, `639...` or `+639...` and normalizes it to `+639...` for UniSMS. `BOOKING_EMAIL_REPLY_TO` is optional; if used, enter an inbox you monitor.

Keep your PayMongo `sk_test_` key and `PAYMENTS_LIVE_ENABLED=false` for this trial. Restart the website and maintenance runner after changing environment variables. Turning either notification flag off disables test payment messages. Enabling the test flag does not enable live payments.

| Variable | Purpose |
| --- | --- |
| `BOOKING_NOTIFICATIONS_ENABLED` | Master switch for automated notifications and send tests. Defaults to `false`. |
| `BOOKING_NOTIFICATIONS_TEST_ENABLED` | Allows `test_paid` notifications to the configured test recipients only. Defaults to `false`. |
| `BOOKING_NOTIFICATION_TEST_EMAIL` | Destination for both guest and host test emails. |
| `BOOKING_NOTIFICATION_TEST_PHONE` | Destination for guest test SMS. |
| `RESEND_API_KEY` | Private Resend sending API key. |
| `BOOKING_EMAIL_FROM` | Sender address; use `onboarding@resend.dev` for the domain-free trial. |
| `BOOKING_EMAIL_REPLY_TO` | Optional reply inbox. |
| `BOOKING_HOST_EMAIL` | Host alert inbox for verified live bookings. |
| `UNISMS_API_KEY` | API Secret key from UniSMS, used for server-side Basic authentication. |
| `UNISMS_SENDER_ID` | Exact Sender ID assigned or approved for your UniSMS account. |

## Preview, send a test, and check status

Preview the templates with sample data. This command makes no provider request and sends nothing:

```powershell
npm run notifications -- preview
```

After configuring your own recipients, these commands each send one actual test message. Both notification flags must be `true`. The email command uses only the configured test inbox; the SMS command uses only the configured test phone. A test SMS consumes UniSMS credits.

```powershell
npm run notifications -- test --channel email
npm run notifications -- test --channel sms
```

To test the booking workflow, create a new booking in PayMongo test mode, complete its test payment, then return to its private status page or let the configured webhook verify it. Run maintenance once to process a queued job, or leave `npm run booking:cron` running to process remaining jobs on later checks:

```powershell
npm run booking:cron -- --once
npm run notifications -- status
```

To filter the queue, replace the sample reference with your booking reference. Status output omits contact details and message bodies.

```powershell
npm run notifications -- status --reference H26-YOUR-REFERENCE
```

| Status | Meaning |
| --- | --- |
| `pending` | Waiting for a worker, channel configuration, or a scheduled retry. |
| `sending` | A worker has claimed this job. |
| `accepted` | The provider accepted or queued the message. This does not prove inbox or handset delivery. |
| `failed` | The attempt failed and automatic retries have stopped. Check configuration and the provider dashboard. |
| `review` | The send result is uncertain or requires a host decision. Check the provider dashboard before any manual resend. |
| `skipped` | The booking no longer qualifies or the notification window expired before sending. |

## Deploy to the Vercel test site

Add the same notification variables to the appropriate environment in the Vercel project, preserving the existing payment and database settings. Set `SITE_URL=https://the-haus-26.vercel.app` for that deployed origin. Redeploy after updating variables; a local `.env.local` change does not update Vercel.

Keep both test recipients as your own contacts and use PayMongo test mode on the deployed test site. Test a new payment through the deployed origin, and check the Resend and UniSMS dashboards along with the queue status. Local CLI status checks read the deployed queue only if `.env.local` points to the same remote booking database.

The payment webhook attempts notifications immediately. Other verified payment refreshes queue notifications for the existing maintenance endpoint or `npm run booking:cron`, which also process retries. A local runner stops when your PC sleeps or shuts down. For retries at all hours, configure an online scheduler to call `GET /api/bookings/maintenance` with the private `Authorization: Bearer CRON_SECRET` header every few minutes. See [BOOKINGS.md](BOOKINGS.md#expired-hold-maintenance).

## Retry and privacy behavior

The queue creates one job per booking and notification kind. It does not send a batch of old confirmations when you first enable the feature. Before sending, the worker checks that the booking still qualifies. The payment webhook can attempt up to three notification jobs immediately; each maintenance call handles at most one job so payment reconciliation has time to finish. A notification failure does not undo a verified booking payment.

Resend retries use the same idempotency key and unchanged message within the app's 23-hour retry window. Resend retains idempotency keys for 24 hours; the shorter app window avoids retrying beyond that protection. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys). If an SMS send has an ambiguous response or the worker crashes while sending, the job enters `review` instead of automatically resending and risking a duplicate.

Jobs store a payload hash and operational status, without copied guest contacts or message bodies. The worker reads the current booking details when it needs them. Resend and UniSMS receive the actual recipient and message during sending and may retain message records; review their account retention settings and policies. Provider acceptance is separate from delivery, so check your inbox or handset for the trial.

## When you accept real bookings

Verify your own sender domain in Resend, update `BOOKING_EMAIL_FROM` to an address on it, set the real host inbox, and use an approved UniSMS Sender ID. Set `BOOKING_NOTIFICATIONS_TEST_ENABLED=false` while leaving the master switch enabled. Complete the separate payment go-live checks in [PAYMENTS.md](PAYMENTS.md). Live confirmations require a verified paid booking in live mode; test payments never confirm a real stay.
