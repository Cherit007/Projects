# Architecture decisions

## Framework: Expo (React Native + TypeScript)

Expo lets the same code run on an iPhone through Expo Go and on Android,
without Xcode for day-to-day development. Native Android code (the UPI
notification listener) will be added through a development build
(`npx expo run:android`) and a config plugin; `android/` and `ios/` are
generated and git-ignored.

## Local-first storage: SQLite (`expo-sqlite`)

All entries are written to an on-device SQLite database first. The app works
fully offline. Cloud sync to Appwrite is a later milestone and will read from
the local database through a sync queue.

Schema changes are applied by numbered migrations in
`src/data/local/migrations.ts`, tracked with SQLite's `user_version`.

## Money

Amounts are stored as integer minor units (paise for INR) in `amount_minor`
columns. Floating-point numbers are never used for money arithmetic.
Helpers live in `src/domain/money`.

## Accounting rules

Totals are computed by pure functions in `src/domain/accounting`, which are
independent of the UI and database and are covered by unit tests. Rules in
force for Milestone 1:

- Income increases an account balance and the income total.
- An expense decreases an account balance and increases the expense total.
- A transfer moves money between two owned accounts and is neither income
  nor expense.

## Time

Transactions store `occurred_at` as a UTC ISO-8601 timestamp. Monthly
boundaries are calculated in the device's local timezone.

## UPI payment detection (Android)

A local Expo module (`modules/upi-notifications`) provides an Android
`NotificationListenerService`. The flow is:

1. The service ignores everything unless detection is enabled and the
   notification comes from an allowed payment app. Text that looks like an
   OTP, PIN or CVV is dropped immediately.
2. Title and text are queued in app-private storage, and a local prompt
   notification invites the user to review.
3. When the app is active, `syncUpiEvents` drains the queue, parses each
   event with `src/domain/upi/parser.ts` and stores a candidate in
   `upi_candidates`. The raw text is not stored or uploaded.
4. Nothing becomes a transaction until the user confirms it in the review
   flow. Failed payments and payment requests are marked `ignored`.

Duplicates are prevented at three levels: the native queue skips identical
repeats within a minute, `upi_candidates.dedupe_key` is unique (UPI
reference, or app + amount + payee + 2-minute window), and confirming a
candidate is atomic so it can create only one transaction. The review
screens also warn when a transaction with the same amount already exists
within 30 minutes.

The native module is optional: on iOS and in Expo Go it is `null` and the
feature is hidden.

## Budgets

One monthly limit per top-level expense category; spending in its
subcategories counts towards it. A budget is "warning" once spending
reaches the warn threshold (70/80/90%, default 80%, a device setting) and
"over" once it exceeds the limit. Saving an expense compares the budget
before and after, and alerts only when a threshold is newly crossed.

## Cloud sync (Appwrite)

The device database stays the source of truth; the app works fully
without an account. When signed in (Google OAuth via Appwrite), the
`accounts`, `categories`, `transactions` and `budgets` tables sync to an
Appwrite database. UPI candidates (which hold notification text) and
device settings never leave the phone.

- **Change tracking:** SQLite triggers record every local insert, update
  and delete in `sync_outbox`, except while remote changes are being
  applied (`sync_meta.applying_remote`).
- **Push:** each outbox row is upserted with its full current values, or
  as a tombstone (`deleted = true`) if the local row is gone. Rows carry
  per-user read/update/delete permissions; tables only grant `create` to
  signed-in users, so no user can see another user's rows.
- **Pull:** per table, rows with `$updatedAt` at or after the last cursor
  are applied in one transaction with foreign keys deferred.
- **Conflicts:** last writer wins on the client-written `updated_at`; ties
  keep the local copy.
- **First sign-in on a device:** default accounts and categories that
  already exist in the cloud (same type and name) are merged onto the
  cloud copies, so a second device does not duplicate them. Then all local
  rows are queued for upload.
- **Sign-out** keeps local data and forgets the sync position.
- **Secrets:** the app only contains the public endpoint and project ID.
  The server API key is used once, from the shell, by
  `scripts/setup-appwrite.mjs`.

## Platform constraints

- Android can read payment-app notifications only after the user grants
  notification access; formats vary and detection is best-effort.
- iOS apps cannot read other apps' notifications. iOS relies on quick manual
  entry and imports.
