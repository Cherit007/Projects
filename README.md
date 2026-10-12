# Personal Finance & Smart UPI Expense Tracker

A privacy-conscious personal finance application for Android and iOS
that helps users track income, expenses, budgets, accounts, investments,
liabilities, and net worth. The key differentiator is Android-side
detection of supported UPI payment notifications, followed by a quick
prompt to categorize the transaction.

> **Product principle:** Make everyday money tracking fast, accounting
> accurate, and financial data private.
>
> **Important platform limitation:** Android can receive notifications
> through a user-authorized `NotificationListenerService`, but
> notification content varies and does not provide a guaranteed bank
> transaction feed. Ordinary iOS apps cannot freely read notifications
> or private data belonging to other apps. Do not promise identical
> automatic UPI detection on both platforms.

## Contents

-   [1. Product vision](#1-product-vision)
-   [2. Goals and non-goals](#2-goals-and-non-goals)
-   [3. Recommended technology](#3-recommended-technology)
-   [4. What to build first](#4-what-to-build-first)
-   [5. Product roadmap](#5-product-roadmap)
-   [6. Feature requirements](#6-feature-requirements)
-   [7. UPI detection design](#7-upi-detection-design)
-   [8. Accounting rules](#8-accounting-rules)
-   [9. Data model](#9-data-model)
-   [10. Appwrite architecture](#10-appwrite-architecture)
-   [11. Application screens](#11-application-screens)
-   [12. Security and privacy](#12-security-and-privacy)
-   [13. Testing and acceptance
    criteria](#13-testing-and-acceptance-criteria)
-   [14. Suggested repository
    structure](#14-suggested-repository-structure)
-   [15. Definition of done](#15-definition-of-done)
-   [16. Official references](#16-official-references)

------------------------------------------------------------------------

## 1. Product vision

Build a personal finance app that answers these questions clearly:

-   How much money did I earn this month?
-   How much did I spend, and on what?
-   How much did I invest?
-   How much cash do I have across my accounts?
-   What do I owe, and what is my net worth?
-   Which categories are exceeding my budget?
-   How has my financial position changed month over month?

The main user experience improvement is to reduce manual transaction
entry. On supported Android devices, after a likely completed UPI
payment notification appears from a supported app (for example, PhonePe,
Google Pay, or Paytm), the app should offer a quick categorization flow.
The user reviews the details and confirms the transaction.

The app is a **tracking and planning tool**, not a payment app. It must
never ask for a UPI PIN, banking password, or OTP, and it must not
initiate payments.

## 2. Goals and non-goals

### Goals

1.  Track income, consumption expenses, transfers, investments, assets,
    and liabilities.
2.  Show reliable monthly and yearly summaries.
3.  Make adding and categorizing transactions quick.
4.  Detect supported Android payment notifications with user permission.
5.  Provide a useful iOS app without relying on unsupported cross-app
    access.
6.  Support offline-first transaction entry with synchronization to
    Appwrite.
7.  Protect users' financial records through strict access control and
    privacy-conscious defaults.
8.  Keep financial calculations testable and independent of UI
    components.

### Non-goals for the initial release

-   Initiating UPI or bank payments.
-   Reading a user's UPI PIN, OTP, or banking credentials.
-   Claiming to detect every UPI payment or every payment-app
    notification.
-   Automatically connecting to every bank or investment provider.
-   Providing brokerage execution or personalized investment advice.
-   Requiring an AI service for basic expense tracking.
-   Building every advanced feature before validating the core expense
    workflow.

## 3. Recommended technology

  -----------------------------------------------------------------------
  Area                                Recommendation
  ----------------------------------- -----------------------------------
  Cross-platform UI                   React Native + TypeScript

  Android UPI integration             Kotlin native
                                      `NotificationListenerService`,
                                      connected through a native module

  iOS                                 Shared React Native UI, manual
                                      entry, imports, and supported
                                      integrations

  Local database                      SQLite with migrations and indexes

  Backend platform                    Appwrite

  Authentication                      Appwrite Account, when
                                      account-based sync is enabled

  Cloud data                          Appwrite TablesDB or DocumentsDB;
                                      choose one model consistently after
                                      reviewing query needs

  File attachments                    Private Appwrite Storage bucket

  Server-side tasks                   Appwrite Functions

  Cross-device updates                Appwrite Realtime, optional

  Tests                               Unit, integration, native device,
                                      synchronization, and end-to-end
                                      tests

  Source control                      Git
  -----------------------------------------------------------------------

### Local-first recommendation

Core transaction entry and review should work offline. Write to SQLite
first, update local summaries, and enqueue cloud synchronization. When
the network returns, sync records safely with retries and conflict
handling.

Do not make the backend round trip a prerequisite for recording an
expense.

## 4. What to build first

Build in small, validated increments. The first release should be useful
without AI, live investment prices, or complex bank integrations.

### Milestone 0 --- Repository audit and setup

**Deliverables** - Inspect the existing repository before changing
code. - Confirm whether it is React, React Native, or Capacitor and
document what can be reused. - Confirm Android and iOS build
requirements. - Establish linting, type checking, test scripts,
environment configuration, and CI where available. - Document Appwrite
endpoint, project, platform identifiers, and
development/staging/production configuration without committing
secrets. - Record architecture decisions and known platform constraints.

**Acceptance criteria** - A developer can install dependencies and run
the project using documented commands. - Existing functionality is
preserved or intentionally migrated. - No privileged Appwrite API key is
shipped in client code.

### Milestone 1 --- Finance foundation (first usable MVP)

Implement these before automatic UPI detection:

1.  Local database and migrations.
2.  Account creation for cash and bank accounts.
3.  Income and expense entry.
4.  Editable categories and subcategories.
5.  Transaction list, details, edit, delete, search, and filters.
6.  Internal account transfers.
7.  Monthly selector and dashboard totals.
8.  Basic category spending chart.
9.  Correct financial calculations and tests.
10. Clear empty, loading, validation, and error states.

**Acceptance criteria** - Users can record income and expenses
offline. - Monthly totals update immediately after a transaction is
created or edited. - Transfers do not count as income or expenses. -
Amounts are stored without binary floating-point rounding errors. -
Tests verify the same totals shown in the dashboard and transaction
list.

### Milestone 2 --- Android UPI proof of concept (highest technical risk)

Build a small, testable vertical slice:

1.  Explain notification access and provide a link to Android settings.
2.  Detect notifications only after the user enables access.
3.  Filter notifications from explicitly supported payment apps.
4.  Parse amount, merchant, time, and reference when available.
5.  Identify likely success, pending, failed, and request notifications.
6.  Show a notification action that opens the categorization screen.
7.  Save a user-confirmed transaction locally.
8.  Prevent duplicate notifications from creating duplicate expenses.
9.  Add a pending review list for ambiguous or ignored events.
10. Test with real devices and supported payment apps.

**Acceptance criteria** - Detection can be enabled and disabled by the
user. - The app does not treat an unverified payment request or failed
transaction as a completed expense. - Repeated notification events do
not create duplicate transactions. - Missing or ambiguous details are
shown for user review. - The app clearly communicates that detection is
best-effort, not guaranteed.

Do this proof of concept before promising automatic UPI detection in
marketing or expanding the feature set.

### Milestone 3 --- Accounts, budgets, and reports

-   Multiple accounts and opening balances.
-   Monthly category budgets.
-   Configurable budget warnings.
-   Recurring income and expense rules.
-   Month-over-month comparisons.
-   CSV export.
-   Transaction import and reconciliation.
-   Account balance reconciliation.

### Milestone 4 --- Investments, liabilities, and net worth

-   Investment ledger and manual valuation.
-   Stocks, mutual funds, ETFs, fixed deposits, EPF/PPF, NPS, gold,
    bonds, and custom assets.
-   Loans, credit-card dues, and other liabilities.
-   Net-worth history.
-   Separate investment contributions from consumption expenses.

### Milestone 5 --- iOS, sync, and release hardening

-   Useful iOS quick-entry and import workflows.
-   Appwrite authentication and sync if accounts are enabled.
-   Offline queue and conflict resolution.
-   Private receipt storage.
-   Backup, restore, export, and delete-account workflows.
-   Privacy review, accessibility, device testing, performance tests,
    and release builds.

### Later enhancements

-   Supported financial-data aggregation integrations.
-   Investment price feeds and portfolio valuation updates.
-   Subscription detection.
-   Savings goals.
-   Optional AI-based spending questions.
-   Advanced insights and household/shared finance features.

------------------------------------------------------------------------

## 5. Product roadmap

### P0 --- Must have for the first usable release

-   [ ] Local SQLite schema and migrations.
-   [ ] Income and expense transactions.
-   [ ] Categories and subcategories.
-   [ ] Cash and bank accounts.
-   [ ] Transaction list and edit flows.
-   [ ] Monthly dashboard.
-   [ ] Correct totals and accounting rules.
-   [ ] Unit tests for financial calculations.
-   [ ] Android notification detection proof of concept.
-   [ ] Manual review and duplicate handling for detected events.
-   [ ] Privacy explanation and notification-access settings.
-   [ ] Useful iOS manual entry experience.

### P1 --- Core product completion

-   [ ] Appwrite Account and user-specific data permissions.
-   [ ] Offline-to-cloud synchronization.
-   [ ] Multiple accounts and transfers.
-   [ ] Budgets and spending alerts.
-   [ ] Monthly and yearly reports.
-   [ ] CSV import/export.
-   [ ] Recurring transactions.
-   [ ] Credit-card purchases and repayments.
-   [ ] Receipts and notes.
-   [ ] Backup and restore.

### P2 --- Full personal finance management

-   [ ] Investment ledger.
-   [ ] Assets and liabilities.
-   [ ] Net-worth history.
-   [ ] Financial goals.
-   [ ] Merchant categorization rules.
-   [ ] Reconciliation workflows.
-   [ ] PDF reports.
-   [ ] Subscription and recurring-charge insights.
-   [ ] Optional supported account aggregation.

### P3 --- Advanced features

-   [ ] Optional AI financial assistant.
-   [ ] Configurable insights and anomaly detection.
-   [ ] Reliable investment-price integrations.
-   [ ] Shared household finances, if desired.
-   [ ] Advanced forecasts and savings planning.

------------------------------------------------------------------------

## 6. Feature requirements

### 6.1 Dashboard

Show: - Income for the selected period. - Consumption expenses. - Net
cash flow. - Cash and bank balances. - Investment contributions and
current investment value. - Assets, liabilities, and net worth. - Budget
usage and top spending categories. - Recent transactions. - Pending UPI
candidates.

Allow current month, previous month, year-to-date, and custom date
range. Define every metric and use the same definition everywhere.

### 6.2 Transactions

Each transaction should support: - Amount and currency. - Date and
timestamp. - Type and category. - Merchant or counterparty. - Source and
destination account where relevant. - Payment method and source of
record. - Optional note, tags, and receipt. - External transaction
reference where available. - Created/updated timestamps. - Confirmation
and reconciliation status.

Support manual creation, editing, deletion, filtering, sorting, search,
refunds, and split transactions.

### 6.3 Categories

Suggested expense categories: - Food and dining - Groceries - Rent and
housing - Utilities and bills - Transport - Shopping - Healthcare -
Entertainment - Education - Travel - Family - Loan interest and fees -
Other

Suggested income categories: - Salary - Freelance - Business - Rental
income - Interest - Dividends - Other income

Allow users to create, rename, reorder, archive, and nest categories.
Category changes must not corrupt old transactions.

### 6.4 Budgets

-   Overall monthly spending limit.
-   Per-category monthly limits.
-   Configurable warning thresholds.
-   Budget-versus-actual reports.
-   Optional rollover.
-   Month-on-month comparison.

### 6.5 Accounts and credit cards

-   Cash, bank accounts, wallets, credit cards, investment accounts, and
    loan accounts.
-   Opening balances.
-   Account-wise history.
-   Transfers between owned accounts.
-   Credit-card purchases and repayments.
-   Statement reconciliation where practical.

A credit-card purchase is recorded as spending. Paying the card bill
settles the liability and must not count the purchase as a second
expense.

### 6.6 Investments

Track: - Instrument and investment type. - Units or quantity. - Purchase
and sale transactions. - Purchase price, fees, and dates. -
Contributions, withdrawals, dividends, and interest. - Current valuation
and valuation date. - Realized and unrealized gains. - Asset allocation
and portfolio history.

Start with manual valuation. Add live prices only through a legitimate,
documented provider. Do not fabricate market prices.

### 6.7 Assets, loans, and net worth

Track assets such as cash, bank balances, investments, deposits, gold,
and user-defined assets. Track liabilities such as loan principal,
credit-card dues, and other debts.

`Net worth = Total assets - Total liabilities`

When loan payment breakdowns are known, separate principal from interest
and fees. Principal repayment reduces a liability; it is not
automatically a consumption expense.

### 6.8 Reports

-   Monthly income and expense summary.
-   Category breakdown.
-   Budget variance.
-   Top merchants.
-   Monthly cash flow.
-   Investment contributions and valuation changes.
-   Asset/liability changes.
-   Net-worth history.
-   CSV and PDF export.

Clearly distinguish income, consumption, transfers, investment
contributions, loan principal, interest, and investment returns.

### 6.9 Goals and insights

Later features may include: - Emergency fund and savings goals. - Target
dates and progress. - Spending changes compared with previous months. -
Budget overruns. - Recurring-payment insights. - Optional
natural-language questions over authorized financial data.

AI is optional and must never invent balances, transactions, or
investment values.

------------------------------------------------------------------------

## 7. UPI detection design

### Android flow

1.  User enables notification access voluntarily.
2.  The native Kotlin listener receives notification events.
3.  The parser filters supported package identifiers and relevant
    notification patterns.
4.  The parser creates a candidate with only the fields needed for
    review.
5.  A confidence/status rule determines whether to suggest, review, or
    ignore it.
6.  A notification action opens a compact categorization screen.
7.  The user reviews amount, merchant, account, date, and category.
8.  Confirmation creates a local transaction.
9.  A synchronization worker sends the record to Appwrite when online.

### Suggested candidate states

-   `detected`
-   `needs_review`
-   `confirmed`
-   `dismissed`
-   `duplicate`
-   `failed`
-   `ignored`

Keep candidate state separate from posted transaction state. A candidate
must not silently affect confirmed balances.

### Duplicate detection

Prefer an external transaction reference when available. Otherwise use a
cautious matching strategy based on source app, amount, direction,
merchant, and timestamp. Amount alone is not enough to identify a
duplicate.

### Platform constraints

-   Notification content and formats vary by app, device, and
    operating-system version.
-   A notification is not an authoritative bank ledger.
-   Some notifications may omit the amount, merchant, or transaction
    reference.
-   Notification access may be revoked or restricted.
-   iOS does not offer ordinary third-party apps general access to other
    apps' notifications.

The iOS app should support quick entry, file imports, and supported
financial-data integrations instead of promising unsupported background
UPI detection.

------------------------------------------------------------------------

## 8. Accounting rules

These are product invariants, not merely reporting preferences.

1.  **Income:** increases the relevant account balance and income total.
2.  **Consumption expense:** decreases the relevant account balance and
    increases expenses.
3.  **Internal transfer:** decreases one owned account and increases
    another; it is neither income nor expense.
4.  **Investment purchase:** decreases cash and increases the investment
    asset; do not count the purchase as consumption.
5.  **Investment sale:** reduces the investment holding and increases
    cash; calculate realized gain/loss separately where cost-basis data
    permits.
6.  **Refund:** links to the original expense when possible and reduces
    net spending.
7.  **Credit-card purchase:** increases the card liability and records
    the expense once.
8.  **Credit-card repayment:** reduces cash and card liability; do not
    record the purchase again.
9.  **Loan disbursement:** increases cash and loan liability; it is not
    income.
10. **Loan principal repayment:** reduces cash and liability; separate
    interest and fees.
11. **Dividends and interest:** classify consistently as income or
    investment return, without confusing them with contributions.
12. **Net worth:** assets minus liabilities, not monthly income minus
    expenses.

Store money as integer minor units (for example, paise for INR) or a
suitable exact decimal representation. Do not use binary floating-point
arithmetic for monetary totals.

Use an explicit timezone and well-defined month boundaries. Test
transactions around midnight and month/year transitions.

------------------------------------------------------------------------

## 9. Data model

Choose Appwrite TablesDB or DocumentsDB based on the current SDK, query
needs, and supported features. Avoid mixing both models without a clear
reason.

Recommended entities:

  ---------------------------------------------------------------------------
  Entity                     Purpose                 Example fields
  -------------------------- ----------------------- ------------------------
  `user_preferences`         User settings           `userId`, `currency`,
                                                     `timezone`,
                                                     `financialMonthStart`

  `accounts`                 Cash, bank, card, loan  `userId`, `name`,
                             accounts                `type`,
                                                     `openingBalanceMinor`,
                                                     `currency`, `isArchived`

  `categories`               Expense/income          `userId`, `name`,
                             categories              `type`, `parentId`,
                                                     `isArchived`

  `transactions`             Confirmed financial     `userId`, `type`,
                             entries                 `amountMinor`,
                                                     `currency`,
                                                     `occurredAt`,
                                                     `categoryId`,
                                                     `accountId`,
                                                     `counterparty`,
                                                     `source`,
                                                     `externalReference`,
                                                     `status`

  `transaction_splits`       Split one transaction   `transactionId`,
                             across categories       `categoryId`,
                                                     `amountMinor`

  `budgets`                  Period and category     `userId`, `categoryId`,
                             limits                  `period`, `limitMinor`

  `recurring_rules`          Recurring               `userId`, `frequency`,
                             income/expense          `nextDueAt`, `template`

  `upi_candidates`           Unconfirmed             `userId`, `sourceApp`,
                             notification events     `amountMinor`,
                                                     `counterparty`,
                                                     `detectedAt`, `status`,
                                                     `dedupeKey`

  `merchant_rules`           User-approved category  `userId`,
                             suggestions             `merchantPattern`,
                                                     `categoryId`

  `investment_instruments`   Security or asset       `userId`, `name`,
                             metadata                `type`, `symbol`

  `investment_entries`       Investment ledger       `userId`,
                                                     `instrumentId`, `type`,
                                                     `units`, `priceMinor`,
                                                     `feesMinor`,
                                                     `occurredAt`

  `assets_liabilities`       Non-transactional       `userId`, `type`,
                             assets/debts            `name`,
                                                     `valuationMinor`,
                                                     `valuationDate`

  `financial_goals`          Savings targets         `userId`, `name`,
                                                     `targetMinor`,
                                                     `targetDate`,
                                                     `currentMinor`

  `monthly_summaries`        Derived reporting cache `userId`, `period`,
                                                     totals, version,
                                                     `calculatedAt`

  `sync_operations`          Local sync queue        `entityType`,
                             metadata                `entityId`, `operation`,
                                                     `status`, `attemptCount`
  ---------------------------------------------------------------------------

These are logical entities, not a mandate to create every table in the
first sprint. Implement only entities needed for the current milestone.

### Schema and query rules

-   Include ownership identifiers and enforce access at the Appwrite
    permission layer.
-   Create indexes for real query patterns: user, date, account,
    category, type, and candidate status as applicable.
-   Use pagination for transaction history.
-   Avoid unbounded arrays and large documents.
-   Keep derived monthly summaries rebuildable from the underlying
    ledger.
-   Use stable IDs and idempotent sync operations.
-   Validate data on the server where trusted operations are required.
-   Do not assume multiple writes are atomic unless using the supported
    Appwrite transaction mechanism for the chosen database API and SDK
    version.

------------------------------------------------------------------------

## 10. Appwrite architecture

### Appwrite services

-   **Account:** authentication and sessions if cloud accounts are
    enabled.
-   **Databases:** financial records, settings, and derived summaries.
-   **Storage:** private receipt images and generated exports.
-   **Functions:** trusted server-side jobs, recurring processing,
    summary rebuilds, and reconciliation tasks.
-   **Realtime:** optional cross-device updates.

### Permissions

-   Default to private financial data.
-   Enable row/document-level permissions as appropriate.
-   Give each user access only to their own records.
-   Never rely solely on a client-provided `userId` to prove ownership.
-   Do not grant public read access to financial tables or receipt
    files.
-   Never include a privileged API key in a mobile bundle.

### Synchronization

1.  Commit the user action to SQLite.
2.  Update the local UI immediately.
3.  Add an operation to the durable sync queue.
4.  Retry safely when online.
5.  Use stable IDs and idempotency/deduplication rules.
6.  Detect conflicts instead of silently overwriting newer data.
7.  Keep local and cloud deletion/edit semantics consistent.
8.  Provide a recoverable error state when sync fails.

Keep notification processing local by default. Do not upload full
notification text unless there is a specific, consented, justified need.

------------------------------------------------------------------------

## 11. Application screens

### Initial release

1.  Onboarding and privacy explanation.
2.  Home dashboard.
3.  Transactions list.
4.  Add/edit transaction.
5.  Category picker.
6.  Account list and account details.
7.  Monthly summary.
8.  UPI detection settings on Android.
9.  Pending transaction review.
10. General settings and data export.

### Subsequent releases

11. Budgets and budget details.
12. Recurring transactions.
13. Investment portfolio and investment ledger.
14. Assets and liabilities.
15. Net-worth history.
16. Goals.
17. Advanced reports.
18. Backup and restore.
19. Cloud-sync status and conflict resolution.
20. Optional AI insights.

Every screen must implement meaningful loading, empty, error, and
success states. Avoid placeholder buttons and static production metrics.

------------------------------------------------------------------------

## 12. Security and privacy

-   Request only the permissions needed for a clearly explained feature.
-   Explain that Android notification access can expose notification
    content.
-   Let users turn detection off and choose supported apps.
-   Process notification content locally wherever possible.
-   Never collect OTPs, UPI PINs, banking passwords, or unrelated
    notification content for expense tracking.
-   Keep sensitive data out of logs and crash reports.
-   Use secure network communication and suitable local-data protection.
-   Protect Appwrite collections/tables and Storage buckets with
    least-privilege permissions.
-   Use server-side Functions for operations requiring privileged
    credentials.
-   Provide export, backup, restore, and data deletion.
-   Document retention and deletion behavior for local, cloud, and
    backup copies.
-   Ask for consent before sending financial data to third-party AI or
    analytics services.

------------------------------------------------------------------------

## 13. Testing and acceptance criteria

### Finance engine tests

-   Income and expense calculations.
-   Internal transfers.
-   Credit-card purchases and repayments.
-   Refunds and split transactions.
-   Investment purchases, sales, and gains.
-   Loan disbursements and principal/interest payments.
-   Month boundaries, timezones, and currency precision.
-   Category changes and archived categories.
-   Rebuilding monthly summaries from source records.

### UPI tests

-   Supported and unsupported notification sources.
-   Missing or malformed amount.
-   Pending, failed, request, and success notifications.
-   Repeated notification events.
-   Same amount paid to different merchants.
-   Duplicate candidate confirmation.
-   Listener disconnection and permission revocation.
-   Device restart and offline conditions.
-   Manual entry of a transaction already detected by notification.

### Sync and security tests

-   Offline creation, edit, and deletion.
-   Retry after a failed network request.
-   Conflicting edits across devices.
-   Duplicate sync operations.
-   Cross-user access attempts.
-   Receipt file permissions.
-   Backup restoration and deletion behavior.

### Performance tests

-   At least 50,000 synthetic transactions.
-   Indexed month/account/category queries.
-   Large transaction lists with pagination or virtualization.
-   Monthly summary calculations.
-   Notification parsing without blocking UI work.
-   Battery and background-execution behavior on physical Android
    devices.

### Release gate

A release is ready only when: - Financial totals are verified by
automated tests. - No known critical data-loss or cross-user access
issue remains. - The Android notification feature has been tested with
real supported apps and its limitations are documented. - iOS does not
claim unsupported automatic notification access. - Backup/export and
failure states are tested. - Type checks, linting, tests, and production
builds pass or exceptions are explicitly documented.

------------------------------------------------------------------------

## 14. Suggested repository structure

Adapt this to the existing repository rather than forcing a complete
rewrite.

``` text
src/
  app/
    navigation/
    providers/
  features/
    dashboard/
    transactions/
    categories/
    accounts/
    budgets/
    investments/
    liabilities/
    reports/
    goals/
    settings/
    upi-detection/
  domain/
    money/
    accounting/
    transactions/
    reports/
    validation/
  data/
    local/
      sqlite/
      migrations/
    appwrite/
    repositories/
    sync/
  services/
    backup/
    export/
    notifications/
  components/
  hooks/
  theme/
  types/
  utils/

native/
  android/
    notification-listener/
    parsers/
  ios/

tests/
  unit/
  integration/
  e2e/

docs/
  architecture.md
  accounting-rules.md
  appwrite-schema.md
  upi-detection.md
  privacy.md
  release-checklist.md
```

Keep platform-specific source in the structure supported by the selected
React Native setup. If the existing app is Capacitor-based, use its
native plugin structure instead.

------------------------------------------------------------------------

## 15. Definition of done

A feature is complete only when:

1.  Its user flow is implemented end to end.
2.  Its data model and validation are defined.
3.  Loading, empty, error, and success states exist.
4.  Relevant unit and integration tests pass.
5.  Permissions and sensitive data handling are reviewed.
6.  Offline behavior is defined where relevant.
7.  Performance is acceptable for expected data volume.
8.  Documentation explains setup and limitations.
9.  The implementation has been tested rather than merely generated.
10. Existing functionality has not regressed.

### First task for a coding agent

Start with **Milestone 0: audit the repository**. Return a concise
architecture report, list what can be reused, identify risks, propose
the first database schema, and provide the exact commands needed to run
the application and tests.

Then implement **Milestone 1: the local finance foundation**. Once
income, expenses, accounts, categories, and monthly calculations are
correct, build the Android UPI proof of concept.

Do not start with AI insights, live investment prices, or complex
integrations. Validate reliable bookkeeping and the distinctive UPI
workflow first.

------------------------------------------------------------------------

## 16. Official references

-   [Appwrite documentation](https://appwrite.io/docs)
-   [Appwrite Databases
    overview](https://appwrite.io/docs/products/databases)
-   [Appwrite TablesDB
    rows](https://appwrite.io/docs/products/databases/tablesdb/rows)
-   [Appwrite React Native
    SDK](https://github.com/appwrite/sdk-for-react-native)
-   [Appwrite database
    transactions](https://appwrite.io/docs/products/databases/tablesdb/transactions)
-   [Android NotificationListenerService
    reference](https://developer.android.com/reference/android/service/notification/NotificationListenerService)

Check the current Appwrite SDK and database API documentation before
implementation because APIs and capabilities may differ by version.
