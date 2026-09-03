import { describe, expect, it } from 'vitest'
import { applyOnlyThisCharge, transactionIdentity } from './recategorize.ts'
import type { MonthFile } from './types.ts'

const monthFile: MonthFile = {
  month: '2026-08',
  generatedAt: '2026-08-31T12:00:00.000Z',
  issuers: ['amex', 'chase'],
  transactions: [
    {
      date: '2026-08-02',
      amount: 12.45,
      rawMerchant: 'CHIPOTLE #1823 SF',
      cleanedMerchant: 'CHIPOTLE',
      issuer: 'amex',
      kind: 'purchase',
      category: 'Food + coffee',
    },
    {
      date: '2026-08-13',
      amount: -5.4,
      rawMerchant: 'CHIPOTLE #1823 SF',
      cleanedMerchant: 'CHIPOTLE',
      issuer: 'amex',
      kind: 'refund',
      category: 'Food + coffee',
    },
    {
      date: '2026-08-07',
      amount: 18.4,
      rawMerchant: 'UBER *TRIP',
      cleanedMerchant: 'UBER',
      issuer: 'chase',
      kind: 'purchase',
      category: 'Transit',
    },
  ],
}

describe('applyOnlyThisCharge', () => {
  it('moves one identity while leaving same-merchant transactions unchanged', () => {
    const identity = transactionIdentity(monthFile.transactions[0]!)
    const result = applyOnlyThisCharge(monthFile, identity, 'Groceries')
    expect(result.transactions[0]?.category).toBe('Groceries')
    expect(result.transactions[1]?.category).toBe('Food + coffee')
    expect(result.transactions[2]?.category).toBe('Transit')
    expect(result.generatedAt).not.toBe(monthFile.generatedAt)
  })
})
