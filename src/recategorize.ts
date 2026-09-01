import type { MerchantMap, MonthFile, Transaction } from './types.ts'

function uniqueSortedIssuers(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((tx) => tx.issuer))].sort()
}

export function applyDefaultDrag(
  monthFile: MonthFile,
  merchantMap: MerchantMap,
  cleanedMerchant: string,
  toCategory: string,
): { monthFile: MonthFile; merchantMap: MerchantMap } {
  const transactions = monthFile.transactions.map((tx) =>
    tx.cleanedMerchant === cleanedMerchant ? { ...tx, category: toCategory } : tx,
  )

  return {
    monthFile: {
      ...monthFile,
      generatedAt: new Date().toISOString(),
      issuers: uniqueSortedIssuers(transactions),
      transactions,
    },
    merchantMap: {
      ...merchantMap,
      [cleanedMerchant]: { category: toCategory, source: 'human' },
    },
  }
}
