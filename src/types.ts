export type Kind = 'purchase' | 'refund'

export type MerchantSource = 'human' | 'llm'

export interface Transaction {
  date: string
  amount: number
  rawMerchant: string
  cleanedMerchant: string
  issuer: string
  kind: Kind
  category: string
}

export interface MonthFile {
  month: string
  generatedAt: string
  issuers: string[]
  transactions: Transaction[]
}

export interface MerchantMapEntry {
  category: string
  source: MerchantSource
}

export type MerchantMap = Record<string, MerchantMapEntry>

export interface CategoriesFile {
  version: number
  categories: string[]
}
