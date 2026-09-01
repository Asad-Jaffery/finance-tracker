// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Transaction } from './types.ts'
import { categoryTotals, columnTotal, formatUsd, groupByClosedCategories } from './totals.ts'

const CATEGORIES = [
  'Food + coffee',
  'Groceries',
  'Gas',
  'Transit',
  'Travel',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Other / uncategorized',
] as const

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'category'>): Transaction {
  return {
    date: '2026-08-02',
    rawMerchant: 'CHIPOTLE #1823 SF',
    cleanedMerchant: 'CHIPOTLE',
    issuer: 'amex',
    kind: partial.amount < 0 ? 'refund' : 'purchase',
    ...partial,
  }
}

describe('formatUsd', () => {
  it('formats with dollar sign, thousands separators, and two decimals', () => {
    expect(formatUsd(1234.56)).toBe('$1,234.56')
    expect(formatUsd(12.45)).toBe('$12.45')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(12)).toBe('$12.00')
  })

  it('uses a minus sign for negatives, not parentheses-only', () => {
    expect(formatUsd(-5.4)).toBe('-$5.40')
    expect(formatUsd(-12.34)).toBe('-$12.34')
  })
})

describe('columnTotal', () => {
  it('sums signed amounts so refunds reduce the total', () => {
    const cards = [
      tx({ amount: 50, category: 'Food + coffee' }),
      tx({ amount: -10, category: 'Food + coffee', kind: 'refund' }),
    ]
    expect(columnTotal(cards)).toBe(40)
  })

  it('is zero for an empty column', () => {
    expect(columnTotal([])).toBe(0)
  })
})

describe('groupByClosedCategories', () => {
  it('keeps locked order and still includes empty columns', () => {
    const grouped = groupByClosedCategories(
      [...CATEGORIES],
      [tx({ amount: 12.45, category: 'Food + coffee' })],
    )
    expect(grouped.map((column) => column.category)).toEqual([...CATEGORIES])
    expect(grouped).toHaveLength(9)
    expect(grouped[0]?.transactions).toHaveLength(1)
    expect(grouped[1]?.transactions).toHaveLength(0)
    expect(grouped[8]?.transactions).toHaveLength(0)
  })

  it('does not grow extra columns from unknown categories', () => {
    const grouped = groupByClosedCategories(
      [...CATEGORIES],
      [tx({ amount: 9, category: 'Gym' })],
    )
    expect(grouped).toHaveLength(9)
    expect(grouped.every((column) => column.category !== 'Gym')).toBe(true)
    expect(grouped.every((column) => column.transactions.length === 0)).toBe(true)
  })
})

describe('categoryTotals', () => {
  it('returns nine signed totals including zeros and refunds', () => {
    const totals = categoryTotals(
      [...CATEGORIES],
      [
        tx({ amount: 50, category: 'Food + coffee' }),
        tx({ amount: -10, category: 'Food + coffee', kind: 'refund' }),
      ],
    )
    expect(totals).toHaveLength(9)
    expect(totals.map((row) => row.category)).toEqual([...CATEGORIES])
    expect(totals[0]).toEqual({ category: 'Food + coffee', total: 40 })
    expect(totals[1]).toEqual({ category: 'Groceries', total: 0 })
    expect(totals[8]).toEqual({ category: 'Other / uncategorized', total: 0 })
  })
})
