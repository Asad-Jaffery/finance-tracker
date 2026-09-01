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
