# Ingest a credit-card statement PDF

Dropping a statement PDF is the entire prompt. Follow this playbook exactly. Do not ask for the category list, JSON shape, or cleaning rules. Do not read `architecture.md`. Do not start the SPA, Vite, or any `/api/*` endpoint unless the user asked. Do not call recategorize helpers, `applyDrag`, or “only this charge”. Those belong to the review loop in the React app.

**One loop, one disk.** This ingest loop is: PDF → this playbook → `data/months/YYYY-MM.json`. The SPA never parses PDFs and has no upload widget. You write JSON files with normal file tools so the board can consume them later. JSON on disk is the source of truth.

`pdf-lib` is for the synthetic fixture generator only. Do not add PDF parsers to `src/`. Do not implement ingest inside the app.

---

## 1. Read these files first

Before extracting or writing anything, read:

1. `data/categories.json`

`data/categories.json` is the **only** allowed category source. Do not rewrite it.

Do not read month files first. Do not categorize from memory. Do not rewrite `data/categories.json`.

---

## 2. Closed category list

Copy strings including `+` and `/`. Never invent a tenth label (no Gym, Cafe, Fees, Uncategorized, Food, …).

Exact nine labels, in this order (same as `data/categories.json`):

1. `Food + coffee`
2. `Groceries`
3. `Gas`
4. `Transit`
5. `Travel`
6. `Shopping`
7. `Subscriptions`
8. `Entertainment`
9. `Other / uncategorized`

Every transaction `category` you write must be one of these nine strings.

---

## 3. Extract every purchase and refund

Read the PDF. Extract **every** purchase and refund line. Do not summarize, roll up, skip “small” charges, or emit “top merchants only”. Multiple issuers stay as per-transaction `issuer` labels; do not collapse issuers.

`rawMerchant` is the exact PDF descriptor with trim only (do not pre-clean it). `cleanedMerchant` is the uppercase stable merchant label from the pipeline below.

---

## 4. Drop card payments; keep merchant refunds, fees, and interest

**Drop** (do not store, do not summarize):

- `AUTOPAY`
- `PAYMENT THANK YOU`
- `ONLINE PAYMENT`
- `MOBILE PAYMENT`
- statement credits that are *paying the card*
- balance-transfer principals

**Keep** merchant refunds. They are not card-pay credits. Clean the refund descriptor with the same pipeline. Do not turn them into `AUTOPAY` / `REFUND` keys.

**Keep** fees and interest as `kind: "purchase"` with category `Other / uncategorized`.

Drop zero-amount lines (`amount == 0`). Never store them.

---

## 5. Amounts, kinds, dates, issuer

- `amount` is a JSON **number** (not a string), dollars, two decimal places (e.g. `12.34`, not `"12.34"` and not cents integers).
- Purchases: `amount > 0` and `kind: "purchase"`. `kind` is `"purchase"` iff `amount > 0`.
- Refunds: `amount < 0` and `kind: "refund"`. Same `cleanedMerchant` as the purchase counterpart when applicable. Never store a positive amount with `kind: "refund"`.
- `kind` must match the amount sign. Zero lines are already dropped.
- `date` is `YYYY-MM-DD`. Prefer **posting date** over transaction date when both exist.
- `issuer` is a free-form short label read off the PDF (`amex`, `chase`, …). Not a closed enum. Do not invent a fixed issuer list. Copy a short label from the statement.

---

## 6. Merchant cleaning pipeline (deterministic, in this order)

`cleanedMerchant` values are **uppercase ASCII**, never title-case.

1. Trim; uppercase ASCII.
2. Strip leading `SQ *`, `TST*`, `PAYPAL *`, `PP*`, `SP *`, `APPLE PAY`, `GOOGLE PAY`, `CASH APP*`.
3. Strip store numbers: `#1234`, trailing `1234` after the name, `STORE 123`.
4. Strip trailing city/state (`AUSTIN TX`, `SAN FRANCISCO CA`), phones, ZIP codes.
5. Collapse internal whitespace.
6. **Do not** collapse `UBER` / `UBER EATS` / `UBER ONE`. Keep `STARBUCKS` and `CHIPOTLE` as those tokens (do not rename to `RESTAURANT` / `FOOD`).

### Required examples (input → cleaned)

- `CHIPOTLE #1823 SF` → `CHIPOTLE`
- `CHIPOTLE 0472 OAKLAND` → `CHIPOTLE`
- `UBER *TRIP` → `UBER`
- `UBER EATS` → `UBER EATS`
- `SQ *BLUE BOTTLE COFFEE` → `BLUE BOTTLE COFFEE`
- `AMAZON.COM*AMZN.COM/BILL` → `AMAZON.COM`
- `24 HOUR FITNESS #123` → `24 HOUR FITNESS`
- `SHELL OIL 12345678` → `SHELL OIL`

Always use `SHELL OIL` (not `SHELL`) when the descriptor is Shell oil / Shell station in that form.

Lookup against the merchant map is **exact** on `cleanedMerchant`. No fuzzy match, substring match, Levenshtein, embeddings, or “closest merchant”.

---

## 7. Categorize every transaction

Categorize each transaction independently from its descriptor and the default hints below. The same cleaned merchant can have different categories in the same or different months, for example Costco groceries and Costco food. Do not use or create merchant-level category mappings.

### Default mapping hints (new merchants only)

| Signal | Category |
|---|---|
| Restaurants, cafes, coffee, Chipotle, Starbucks, Uber Eats, DoorDash | Food + coffee |
| Grocery, Whole Foods, Trader Joe’s, Safeway | Groceries |
| Gas stations, COSTCO GAS | Gas |
| Uber (rides), Lyft, transit, parking, tolls | Transit |
| Airlines, hotels, Airbnb, rental cars | Travel |
| Amazon, Target (default), Apple hardware, clothing | Shopping |
| Netflix, Spotify, gyms, iCloud, Uber One, SaaS | Subscriptions |
| Movies, concerts, Steam, tickets, nightlife venues | Entertainment |
| Fees, ATM, unknown, medical | Other / uncategorized |

- Gym → `Subscriptions`. Coffee → `Food + coffee`.
- Costco / Target / Amazon default **Shopping** unless the descriptor is unambiguously gas (`COSTCO GAS` → `Gas`).
- `UBER` → `Transit`. `UBER EATS` → `Food + coffee`. `UBER ONE` → `Subscriptions`. Keep the merchant labels distinct; do not collapse all Uber* to Transit.

---

## 8. Infer the book month

Infer book month from the PDF. Prefer the statement **closing-date** month. Book month is the statement’s chosen `YYYY-MM`, **not** necessarily every posting date’s calendar month.

Transactions can have dates in adjacent calendar months; they still belong to the chosen statement `YYYY-MM` file. Do **not** split one PDF across multiple month files by posting date.

Filename `data/months/YYYY-MM.json` must match field `month`.

If the window is `07/12–08/11` style and **still ambiguous after the closing-date rule**, **ask once** which `YYYY-MM` to use. Do not keep asking. Do not invent a month when still ambiguous. Do **not** ask when the closing-date uniquely selects a month (that non-interactive path is how a golden run should work).

---

## 9. Transaction object (no extra fields)

Each kept line becomes a transaction with **exactly these seven fields** (no `id`, no `locked`, no `source` on the row). Human vs LLM lives only on the merchant map. “Only this charge” is a review-loop concept, not an ingest field.

```ts
{
  date: string;              // YYYY-MM-DD, posting date preferred
  amount: number;            // dollars, 2-decimal. Purchases > 0, refunds < 0
  rawMerchant: string;       // exact PDF descriptor, trim only
  cleanedMerchant: string;   // uppercase stable merchant label
  issuer: string;            // free-form short label from PDF: "amex", "chase", ...
  kind: "purchase" | "refund"; // purchase iff amount > 0; refund iff amount < 0
  category: string;          // one of the nine labels
}
```

Identity for merge/dedupe is `date + amount + rawMerchant` (equivalently `date|amount|rawMerchant`). After ingest, two rows must not share that key.

---

## 10. Write the month file

Write `data/months/YYYY-MM.json` (not `public/`, not `src/`, not CSV, not per-issuer files like `2026-08-amex.json`). Several cards / PDFs for the same book month merge into **the same** file.

Do not put writable JSON in `public/`. Do not import month files via `import.meta.glob`. Write files directly with normal file tools. The Vite plugin PUT is for the SPA review loop only; ingest does not require the dev server.

### Month file schema

```ts
{
  month: string;                 // YYYY-MM, must match filename
  generatedAt: string;           // ISO-8601 UTC with Z, last write (use now)
  issuers: string[];             // unique, sorted, derived from transactions
  transactions: Transaction[];   // sorted: date ASC, rawMerchant ASC, amount ASC
}
```

- Set `generatedAt` to the current ISO-8601 UTC timestamp on write (e.g. `2026-08-31T12:00:00.000Z`). Not local time without `Z`.
- `issuers` is unique, sorted, **derived** from `transaction.issuer` values (not independently typed; do not include issuers only present on dropped payments).
- Sort `transactions`: date ASC, then `rawMerchant` ASC, then `amount` ASC (a refund with the same date/merchant sorts before a purchase if its amount is more negative).

If the file already exists, **merge**: concatenate incoming transactions with existing ones, then dedupe on `date + amount + rawMerchant`. **Existing row wins** on duplicate, so a prior human one-off (“only this charge”) category on that exact row is preserved. Do not overwrite the whole file. Do not let the incoming PDF category replace that one-off. Do not dedupe on `cleanedMerchant` only.

If every line was a dropped payment, still write a valid file:

```json
{
  "month": "YYYY-MM",
  "generatedAt": "<now ISO-8601 UTC>",
  "issuers": [],
  "transactions": []
}
```

Do not skip the write when no purchases remain.

### Months are independent

Only write the inferred month file. Do not rewrite other `data/months/*.json`. Recategorizing a transaction in 2026-08 does not rewrite 2026-07.json; ingest of one statement must not backfill or “normalize” other months. Do not reorder or write `data/categories.json`.

---

## 12. Never commit or copy the PDF

- Never commit the PDF. Never `git add` a PDF.
- Never copy the PDF into `data/` (JSON only under `data/`). No `data/statements/` dump.
- Never save the statement binary under another extension in git (`.PDF`, `.bin`, or under `golden/`). Golden files are JSON only.
- `.gitignore` already includes `*.pdf`. Leave the PDF untracked / gitignored.

Do not run the SPA as part of ingest unless asked.

---

## Checklist (dropping a PDF is enough)

1. Read `data/categories.json` first.
2. Extract every purchase and refund. Do not summarize.
3. Drop card payments (AUTOPAY / PAYMENT THANK YOU / ONLINE PAYMENT / MOBILE PAYMENT / paying-the-card credits / balance-transfer principals). Keep merchant refunds. Keep fees/interest as purchase + Other / uncategorized.
4. Refunds negative + `kind: "refund"`; purchases positive + `kind: "purchase"`; drop zeros.
5. Clean merchants with the pipeline in §6 (including every required example).
6. Categorize each transaction independently from its descriptor, using only the closed category list.
7. Never invent categories.
8. Infer book month from closing date; ask once only if still ambiguous.
9. Write/merge `data/months/YYYY-MM.json`; dedupe `date+amount+rawMerchant`; existing row wins.
10. Never commit the PDF. Never copy it into `data/`.
11. Do not run the SPA unless asked.
