// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Transaction } from './types.ts'
import { filterByMerchantSearch } from './search.ts'

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'cleanedMerchant' | 'rawMerchant'>,
): Transaction {
  return {
    date: '2026-08-02',
    amount: 12.45,
    issuer: 'amex',
    kind: 'purchase',
    category: 'Food + coffee',
    ...partial,
  }
}

const chipotle = tx({
  cleanedMerchant: 'CHIPOTLE',
  rawMerchant: 'CHIPOTLE #1823 SF',
  amount: 12.45,
})
const uber = tx({
  cleanedMerchant: 'UBER',
  rawMerchant: 'UBER *TRIP',
  amount: 18.4,
  category: 'Transit',
})
const fitness = tx({
  cleanedMerchant: '24 HOUR FITNESS',
  rawMerchant: '24 HOUR FITNESS #123',
  amount: 49.99,
  category: 'Subscriptions',
})

const all = [chipotle, uber, fitness]

describe('filterByMerchantSearch', () => {
  it('returns every transaction when the query is empty or whitespace', () => {
    expect(filterByMerchantSearch(all, '')).toEqual(all)
    expect(filterByMerchantSearch(all, '   ')).toEqual(all)
  })

  it('matches cleanedMerchant case-insensitively as a substring', () => {
    expect(filterByMerchantSearch(all, 'chipotle')).toEqual([chipotle])
    expect(filterByMerchantSearch(all, 'CHIPOTLE')).toEqual([chipotle])
    expect(filterByMerchantSearch(all, 'Chipotle')).toEqual([chipotle])
  })

  it('matches rawMerchant even when cleanedMerchant does not contain the substring', () => {
    expect(filterByMerchantSearch(all, '1823')).toEqual([chipotle])
    expect(filterByMerchantSearch(all, '#123')).toEqual([fitness])
  })

  it('returns an empty list when nothing matches', () => {
    expect(filterByMerchantSearch(all, 'zzzz-no-such-merchant')).toEqual([])
  })
})
