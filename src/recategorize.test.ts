import { describe, expect, it } from 'vitest'
import { applyDefaultDrag } from './recategorize.ts'
import type { MerchantMap, MonthFile } from './types.ts'

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

const merchantMap: MerchantMap = {
  CHIPOTLE: { category: 'Food + coffee', source: 'llm' },
  UBER: { category: 'Transit', source: 'llm' },
}

describe('applyDefaultDrag', () => {
  it('moves every matching merchant including refunds and sets map source human', () => {
    const result = applyDefaultDrag(monthFile, merchantMap, 'CHIPOTLE', 'Shopping')
    const chipotles = result.monthFile.transactions.filter(
      (tx) => tx.cleanedMerchant === 'CHIPOTLE',
    )
    expect(chipotles).toHaveLength(2)
    expect(chipotles.every((tx) => tx.category === 'Shopping')).toBe(true)
    expect(result.monthFile.transactions.find((tx) => tx.cleanedMerchant === 'UBER')?.category).toBe(
      'Transit',
    )
    expect(result.merchantMap.CHIPOTLE).toEqual({ category: 'Shopping', source: 'human' })
    expect(result.merchantMap.UBER).toEqual({ category: 'Transit', source: 'llm' })
    expect(result.monthFile.generatedAt).not.toBe(monthFile.generatedAt)
    expect(result.monthFile.issuers).toEqual(['amex', 'chase'])
    expect(monthFile.transactions[0]?.category).toBe('Food + coffee')
  })
})
