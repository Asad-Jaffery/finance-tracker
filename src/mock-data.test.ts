// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CategoriesFile, MonthFile, Transaction } from './types.ts'

const CLOSED_CATEGORIES = [
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

const dataDir = fileURLToPath(new URL('../data', import.meta.url))

function readJson<T>(relative: string): T {
  return JSON.parse(readFileSync(path.join(dataDir, relative), 'utf8')) as T
}

function sortKey(tx: Transaction): [string, string, number] {
  return [tx.date, tx.rawMerchant, tx.amount]
}

function isSorted(transactions: Transaction[]): boolean {
  for (let i = 1; i < transactions.length; i += 1) {
    const prev = sortKey(transactions[i - 1]!)
    const next = sortKey(transactions[i]!)
    const cmp =
      prev[0].localeCompare(next[0]) ||
      prev[1].localeCompare(next[1]) ||
      prev[2] - next[2]
    if (cmp > 0) return false
  }
  return true
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort()
}

describe('data/categories.json', () => {
  it('is the exact nine closed labels in architecture order, including + and /', () => {
    const file = readJson<CategoriesFile>('categories.json')
    expect(file.version).toBe(1)
    expect(file.categories).toEqual([...CLOSED_CATEGORIES])
    expect(file.categories).toHaveLength(9)
    expect(file.categories[0]).toBe('Food + coffee')
    expect(file.categories[8]).toBe('Other / uncategorized')
    expect(file.categories.join('\n')).toContain('+')
    expect(file.categories.join('\n')).toContain('/')
    expect(file.categories).not.toContain('Gym')
    expect(file.categories).not.toContain('Fitness')
  })
})

describe('committed mock months', () => {
  it('contains the July 2026 ledger', () => {
    const names = readdirSync(path.join(dataDir, 'months'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort()
    expect(names).toEqual(['2026-07'])
  })

  it('uses MonthFile shape, closed categories, and sorted transactions', () => {
    for (const month of ['2026-07'] as const) {
      const file = readJson<MonthFile>(`months/${month}.json`)
      expect(file.month).toBe(month)
      expect(file.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
      expect(Number.isNaN(Date.parse(file.generatedAt))).toBe(false)
      expect(file.issuers).toEqual(
        uniqueSorted(file.transactions.map((tx) => tx.issuer)),
      )
      expect(isSorted(file.transactions)).toBe(true)

      const seen = new Set<string>()
      for (const tx of file.transactions) {
        expect(tx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(typeof tx.amount).toBe('number')
        expect(Number.isInteger(Math.round(tx.amount * 100))).toBe(true)
        expect(tx.rawMerchant.length).toBeGreaterThan(0)
        expect(tx.cleanedMerchant.length).toBeGreaterThan(0)
        expect(tx.issuer.length).toBeGreaterThan(0)
        expect(CLOSED_CATEGORIES).toContain(tx.category)
        if (tx.amount > 0) expect(tx.kind).toBe('purchase')
        else if (tx.amount < 0) expect(tx.kind).toBe('refund')
        else throw new Error('zero-amount lines must not be stored')
        expect(tx).not.toHaveProperty('id')
        expect(tx).not.toHaveProperty('source')
        expect(tx).not.toHaveProperty('locked')
        const identity = `${tx.date}|${tx.amount}|${tx.rawMerchant}`
        expect(seen.has(identity)).toBe(false)
        seen.add(identity)
      }
    }
  })

  it('includes the Robinhood July statement transactions', () => {
    const july = readJson<MonthFile>('months/2026-07.json')
    expect(july.transactions).toHaveLength(33)
    const julyTotal = july.transactions.reduce((sum, tx) => sum + tx.amount, 0)
    expect(julyTotal).toBeCloseTo(1010.08, 2)
    expect(july.issuers).toEqual(['robinhood'])
  })
})
