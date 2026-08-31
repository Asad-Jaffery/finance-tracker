// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CategoriesFile, MerchantMap, MonthFile, Transaction } from './types.ts'

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

describe('data/merchant-map.json', () => {
  it('seeds llm merchants plus one human example using closed categories', () => {
    const map = readJson<MerchantMap>('merchant-map.json')
    expect(Array.isArray(map)).toBe(false)
    expect(map).toMatchObject({
      CHIPOTLE: { category: 'Food + coffee', source: 'llm' },
      UBER: { category: 'Transit', source: 'llm' },
      'UBER EATS': { category: 'Food + coffee', source: 'llm' },
    })

    const entries = Object.entries(map)
    expect(entries.length).toBeGreaterThan(0)
    for (const [merchant, entry] of entries) {
      expect(merchant.length).toBeGreaterThan(0)
      expect(CLOSED_CATEGORIES).toContain(entry.category)
      expect(['human', 'llm']).toContain(entry.source)
    }
    expect(entries.some(([, entry]) => entry.source === 'human')).toBe(true)
    expect(entries.some(([, entry]) => entry.source === 'llm')).toBe(true)
  })
})

describe('committed mock months', () => {
  it('contains only 2026-07 and 2026-08, with 2026-08 as latest', () => {
    const names = readdirSync(path.join(dataDir, 'months'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.slice(0, -'.json'.length))
      .sort()
    expect(names).toEqual(['2026-07', '2026-08'])
    expect(names[names.length - 1]).toBe('2026-08')
  })

  it('uses MonthFile shape, closed categories, and sorted transactions', () => {
    for (const month of ['2026-07', '2026-08'] as const) {
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

  it('gives July about 10 overlapping transactions with different totals than August', () => {
    const july = readJson<MonthFile>('months/2026-07.json')
    const august = readJson<MonthFile>('months/2026-08.json')
    expect(july.transactions.length).toBeGreaterThanOrEqual(8)
    expect(july.transactions.length).toBeLessThanOrEqual(12)

    const julyTotal = july.transactions.reduce((sum, tx) => sum + tx.amount, 0)
    const augustTotal = august.transactions.reduce((sum, tx) => sum + tx.amount, 0)
    expect(julyTotal).not.toBe(augustTotal)

    const julyCategories = new Set(july.transactions.map((tx) => tx.category))
    const augustCategories = new Set(august.transactions.map((tx) => tx.category))
    const overlap = [...julyCategories].filter((category) => augustCategories.has(category))
    expect(overlap.length).toBeGreaterThan(0)
  })

  it('covers August board fixtures: 18–25 txs, all nine categories, CHIPOTLE, UBER split, gym, refund, issuers', () => {
    const august = readJson<MonthFile>('months/2026-08.json')
    expect(august.transactions.length).toBeGreaterThanOrEqual(18)
    expect(august.transactions.length).toBeLessThanOrEqual(25)

    const presentCategories = new Set(august.transactions.map((tx) => tx.category))
    expect([...CLOSED_CATEGORIES].every((category) => presentCategories.has(category))).toBe(
      true,
    )

    const chipotles = august.transactions.filter(
      (tx) => tx.cleanedMerchant === 'CHIPOTLE' && tx.category === 'Food + coffee',
    )
    expect(chipotles.length).toBeGreaterThanOrEqual(3)

    const uber = august.transactions.filter((tx) => tx.cleanedMerchant === 'UBER')
    const uberEats = august.transactions.filter((tx) => tx.cleanedMerchant === 'UBER EATS')
    expect(uber.length).toBeGreaterThanOrEqual(1)
    expect(uberEats.length).toBeGreaterThanOrEqual(1)
    expect(uber.every((tx) => tx.category === 'Transit')).toBe(true)
    expect(uberEats.every((tx) => tx.category === 'Food + coffee')).toBe(true)

    const coffee = august.transactions.filter(
      (tx) =>
        tx.category === 'Food + coffee' &&
        (tx.cleanedMerchant.includes('COFFEE') || tx.cleanedMerchant === 'STARBUCKS'),
    )
    expect(coffee.length).toBeGreaterThanOrEqual(1)

    const gym = august.transactions.filter((tx) =>
      /gym|fitness/i.test(`${tx.cleanedMerchant} ${tx.rawMerchant}`),
    )
    expect(gym.length).toBeGreaterThanOrEqual(1)
    expect(gym.every((tx) => tx.category === 'Subscriptions')).toBe(true)

    const refunds = august.transactions.filter((tx) => tx.kind === 'refund')
    expect(refunds.length).toBeGreaterThanOrEqual(1)
    expect(refunds.every((tx) => tx.amount < 0)).toBe(true)
    for (const refund of refunds) {
      expect(
        august.transactions.some(
          (tx) =>
            tx.kind === 'purchase' &&
            tx.cleanedMerchant === refund.cleanedMerchant &&
            tx.category === refund.category,
        ),
      ).toBe(true)
    }

    const issuers = new Set(august.transactions.map((tx) => tx.issuer))
    expect(issuers.has('amex')).toBe(true)
    expect(issuers.has('chase')).toBe(true)
    expect(august.issuers).toEqual(['amex', 'chase'])
  })
})
