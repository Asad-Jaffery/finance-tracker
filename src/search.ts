import type { Transaction } from './types.ts'

export function filterByMerchantSearch(
  transactions: Transaction[],
  query: string,
): Transaction[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return transactions
  return transactions.filter(
    (tx) =>
      tx.cleanedMerchant.toLowerCase().includes(needle) ||
      tx.rawMerchant.toLowerCase().includes(needle),
  )
}
