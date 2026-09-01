# Finance tracker

Local-only spending tracker. Drop a statement PDF into a Droid session in this repo; the agent follows `AGENTS.md` → `playbooks/ingest-statement.md` and writes `data/months/YYYY-MM.json`. The React app never parses PDFs. Review charges on a nine-column kanban, drag mistakes, and look at month-over-month graphs. JSON on disk is the source of truth.

## Stack

Vite 8, React 19, TypeScript, @dnd-kit, Recharts. Use npm (not pnpm).

## Setup

Node 23+.

```bash
npm install
```

## Run

```bash
npm run dev
```

Opens at http://127.0.0.1:5173 (binds `127.0.0.1` only, port 5173).

- Board: `/`
- Dashboard: `/dashboard`

## Recategorize

Dragging a card or using **Move only this charge** moves that transaction only. Each transaction retains its own category, so the same merchant can appear in different categories. Months are independent.

## Ingest

Drop a PDF in a Droid session. Follow `AGENTS.md` / `playbooks/ingest-statement.md`. Never commit PDFs.

Synthetic generator:

```bash
node --experimental-strip-types fixtures/generate-synthetic-statement.ts
```

Writes gitignored `fixtures/synthetic-statement.pdf`. Golden file: `golden/synthetic-statement-2026-08.json`.

## Data

- `data/categories.json`
- `data/months/YYYY-MM.json`

Dev writes (serve-only Vite plugin): `PUT /api/months/:yyyy-mm`.

## Scripts

| Script | Command |
| --- | --- |
| `dev` | Vite on 127.0.0.1:5173 |
| `build` | Typecheck + Vite build |
| `test` | Vitest |
| `lint` | oxlint |
| `typecheck` | `tsc -b` |

No auth, no database, no deploy.
