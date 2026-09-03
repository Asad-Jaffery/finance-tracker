import type { Transaction } from './types.ts'

export interface CategoryColumn {
  category: string
  transactions: Transaction[]
}

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatMonth(month: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!match) return month

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)))
}

export function columnTotal(transactions: Transaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0)
}

export function groupByClosedCategories(
  categories: string[],
  transactions: Transaction[],
): CategoryColumn[] {
  const allowed = new Set(categories)
  const buckets = new Map<string, Transaction[]>()
  for (const category of categories) {
    buckets.set(category, [])
  }
  for (const tx of transactions) {
    if (!allowed.has(tx.category)) continue
    buckets.get(tx.category)!.push(tx)
  }
  return categories.map((category) => ({
    category,
    transactions: buckets.get(category) ?? [],
  }))
}

export interface CategoryTotal {
  category: string
  total: number
}

/** One signed total per closed category, including $0 categories. Refunds reduce the sum. */
export function categoryTotals(
  categories: string[],
  transactions: Transaction[],
): CategoryTotal[] {
  return groupByClosedCategories(categories, transactions).map((column) => ({
    category: column.category,
    total: columnTotal(column.transactions),
  }))
}

/** Prior calendar YYYY-MM, not the previous item in the on-disk months list. */
export function previousCalendarMonth(month: string): string {
  const year = Number(month.slice(0, 4))
  const mon = Number(month.slice(5, 7))
  if (mon === 1) return `${year - 1}-12`
  return `${year}-${String(mon - 1).padStart(2, '0')}`
}

export interface VsLastMonthRow {
  category: string
  thisTotal: number
  previousTotal: number | null
  delta: number | null
  hasPrevious: boolean
}

/**
 * Per-category this / previous / signed delta.
 * `previousTransactions === null` means the previous calendar-month file is missing
 * (never treat that as $0).
 */
export function vsLastMonth(
  categories: string[],
  thisTransactions: Transaction[],
  previousTransactions: Transaction[] | null,
): VsLastMonthRow[] {
  const thisTotals = categoryTotals(categories, thisTransactions)
  if (previousTransactions === null) {
    return thisTotals.map((row) => ({
      category: row.category,
      thisTotal: row.total,
      previousTotal: null,
      delta: null,
      hasPrevious: false,
    }))
  }
  const previousTotals = categoryTotals(categories, previousTransactions)
  return thisTotals.map((row, index) => {
    const previousTotal = previousTotals[index]?.total ?? 0
    return {
      category: row.category,
      thisTotal: row.total,
      previousTotal,
      delta: row.total - previousTotal,
      hasPrevious: true,
    }
  })
}

/** Sign on nonzero deltas (`+$1.00` / `-$1.00`). Zero stays `$0.00`. */
export function formatSignedDelta(delta: number): string {
  if (delta === 0) return formatUsd(0)
  if (delta > 0) return `+${formatUsd(delta)}`
  return formatUsd(delta)
}

export interface TrendPoint {
  month: string
  total: number
}

/**
 * One total-spend point per on-disk month (API order).
 * y = signed grand total of that month’s transactions, including refunds and $0 empty files.
 */
export function trendPoints(
  months: string[],
  transactionsByMonth: Record<string, Transaction[] | undefined>,
): TrendPoint[] {
  return months.map((month) => ({
    month,
    total: columnTotal(transactionsByMonth[month] ?? []),
  }))
}
