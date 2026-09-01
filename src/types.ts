export type Kind = 'purchase' | 'refund'

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

export interface CategoriesFile {
  version: number
  categories: string[]
}
