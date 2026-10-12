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

## Platform constraints

- Android can read payment-app notifications only after the user grants
  notification access; formats vary and detection is best-effort.
- iOS apps cannot read other apps' notifications. iOS relies on quick manual
  entry and imports.
