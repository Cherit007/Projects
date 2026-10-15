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

### Swapping the backend

Appwrite is an adapter, not a dependency of the app. The sync engine
(`src/services/cloud/sync.ts`), the sign-in UI and the local database only
use the interfaces in `src/services/cloud/backend.ts`; all Appwrite code
lives in `src/services/cloud/appwrite/`. To move to another backend (for
example Postgres on AWS behind an API):

1. Add a folder such as `src/services/cloud/rest/` that implements
   `CloudBackend` (`auth` + `sync`), and return it from `cloudBackend()`
   in `src/services/cloud/index.ts`. Nothing else in the app changes.
2. The server must provide, per user and per table
   (`accounts`, `categories`, `transactions`, `budgets`; columns in
   `src/services/cloud/schema.json`):
   - **Pull:** rows whose server-assigned update time is at or after a
     cursor, oldest first, including tombstones (`deleted = true`). In
     Postgres: an `updated_at_server timestamptz` set by a trigger
     (`clock_timestamp()`), indexed with `(user_id, updated_at_server, id)`.
   - **Push:** upsert by `id`, storing the client's values as given
     (including the client's `updated_at`), and never deleting rows,
     only marking them `deleted`.
   - **Isolation:** every row belongs to one user, and the API only
     returns or changes that user's rows (e.g. Postgres row-level
     security, or `WHERE user_id = <authenticated user>`).
   - **Auth:** Google sign-in that yields a session; return a 401 for an
     expired session (the adapter turns it into `SessionExpiredError`).
3. To move existing users' data, copy the rows across with their ids and
   `updated_at` values unchanged; devices then continue syncing normally.

The app never talks to a database directly: a direct connection would
need database credentials in the app, which anyone could extract.
- **Secrets:** the app only contains the public endpoint and project ID.
  The server API key is used once, from the shell, by
  `scripts/setup-appwrite.mjs`.

## Bank SMS capture (iOS)

iOS has no API for reading notifications or SMS, so detection there relies
on the user's own Shortcuts automation, triggered by a message containing
"debited" (or another keyword). Installed builds contain the
**Capture bank SMS** App Intent (`modules/bank-sms/ios-app`, copied into
the app target by `app.plugin.js`, since Shortcuts only discovers intents
compiled into the app). It runs without opening the app, keeps only
messages with a transaction word and amount (OTPs are dropped), appends them
to a queue in `UserDefaults` and posts a local notification. The `BankSms`
Expo module exposes that queue; `syncBankSms` drains it whenever
`UpiProvider` syncs (on launch and on returning to the foreground), so the
text lives only until the app next opens. Expo Go has no native action, so
the automation opens `financetracker://capture?text=…` instead. `parseBankSms` turns
the message into the same candidate shape as an app notification
(`package_name = 'sms'`), so it shares the review list, the duplicate key
(UPI reference) and the rule that failed payments and requests are never
suggested. Only the extracted fields are stored, never the message text.
Confirmed transactions get `source = 'bank_sms'`. The capture link works
on Android too.

## Adding detected payments automatically

`autoAddCandidates` runs after every detection sync (Android notifications
and iOS bank SMS) unless the user turns off **Add payments automatically**
(`settings.auto_add_payments`). Each waiting candidate, including ones
detected earlier, is confirmed without review when it is a successful
payment with an amount and direction and nothing similar was already
recorded (`findPossibleDuplicate`).

- A payee matching the user's own name (`settings.owner_name`, `isOwnName`)
  is recorded as a transfer to their other bank or wallet account, when there
  is exactly one; otherwise it waits for review.
- Otherwise the category is the payee's last category (`lastCategory`), else
  the category the user gives other payees ending in the same word
  (`learnedCategoryId`: at least two payees, 80% agreement), else
  `predictCategoryName`: a well-known merchant, **Friends** for a person, the
  classifier's shop category, else **Other** / **Other income**.
- The payment message's own hint (`payeeKind`: "P2M"/"P2A", merchant QR or
  mobile-number UPI IDs, see `detectPayeeKind`) overrides what the name
  suggests about person vs business.
- A payment to a person of ₹3,000 or more, repeating an amount (±5%) paid to
  them 25–35 days earlier, is filed as **Rent and housing**, unless the user
  edited that payee's last transaction.

The review form pre-fills the same way. Payments go to the first non-cash
account.

### Friends

`Friends` and `Family` are default categories (migrations 4 and 5 add them
to existing databases). `listPeople` groups every payee that has at least one
Friends or Family transaction by name (case-insensitive) with sent and
received totals; `movePerson` moves a person's transactions between the two,
and later payments follow because the payee's last category is reused.
The Dashboard shows the top three; `/people` lists everyone and
`/people/[name]` shows one person's transactions (`counterparty` filter on
`listTransactions`) and the net balance.

### Payee classifier

A naive Bayes model over words, their 3–4 letter fragments and the last word
of the payee name (`payeeFeatures.ts`), with classes for each shop category,
people (`__person__`) and vague businesses, banks and payment gateways
(`__unknown__`). Likelihoods are the share of each class's examples that
have a feature, smoothed towards its overall share, so the large person class
stays comparable to small shop classes. A known word counts once; an unknown
word counts as the known words it ends with (run-together UPI IDs like
`maharajarestaurant@oksbi`), else the average of its fragments.
`decidePayee` treats the payee as a person at probability ≥ 0.55
(mobile-number UPI IDs always), otherwise gives the best shop category when
it holds ≥ 0.5 of the business probability, else none (Other).

Training data:

- generated names from hand-made lists (brands, shop keywords, banks,
  gateways, Indian first names and surnames) in `train-payee-classifier.mts`
- real names, when downloaded with `node scripts/fetch-payee-data.mts` into
  `scripts/data/` (not committed): Indian businesses with their type from
  OpenStreetMap (© OpenStreetMap contributors, ODbL; credited in the app) and
  people's names from Wikidata (CC0)

`node scripts/train-payee-classifier.mts [--verbose]` evaluates on names left
out of training, then trains on everything and writes
`src/domain/categories/payeeModel.json` (about 0.8 MB, runs in milliseconds,
fully offline). On real held-out names: about 88% of people recognised, 5% of
businesses taken for people (mostly shops named like a person), 69% of shops
categorised with 87% correct; the rest go to Other.

## Platform constraints

- Android can read payment-app notifications only after the user grants
  notification access; formats vary and detection is best-effort.
- iOS apps cannot read other apps' notifications. iOS relies on quick manual
  entry and bank SMS handed over by a Shortcuts automation, which the user
  must create once (apps cannot create automations).
