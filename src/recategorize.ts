import type { MonthFile, Transaction } from './types.ts'

function uniqueSortedIssuers(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((tx) => tx.issuer))].sort()
}

export function transactionIdentity(tx: Transaction): string {
  return `${tx.date}|${tx.amount}|${tx.rawMerchant}`
}

export function applyOnlyThisCharge(
  monthFile: MonthFile,
  identity: string,
  toCategory: string,
): MonthFile {
  const transactions = monthFile.transactions.map((tx) =>
    transactionIdentity(tx) === identity ? { ...tx, category: toCategory } : tx,
  )

  return {
    ...monthFile,
    generatedAt: new Date().toISOString(),
    issuers: uniqueSortedIssuers(transactions),
    transactions,
  }
}
