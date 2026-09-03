/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import type { MonthFile, Transaction } from './types.ts'

const CATEGORIES = [
  'Food + coffee',
  'Groceries',
  'Gas',
  'Transit',
  'Travel',
  'Shopping',
  'Subscriptions',
  'Entertainment',
  'Other / uncategorized',
]

function tx(partial: Partial<Transaction> & Pick<Transaction, 'cleanedMerchant' | 'amount' | 'date'>): Transaction {
  return {
    rawMerchant: partial.rawMerchant ?? partial.cleanedMerchant,
    issuer: partial.issuer ?? 'amex',
    kind: partial.kind ?? (partial.amount < 0 ? 'refund' : 'purchase'),
    category: partial.category ?? 'Food + coffee',
    ...partial,
  }
}

const july: MonthFile = {
  month: '2026-07',
  generatedAt: '2026-07-31T00:00:00.000Z',
  issuers: ['amex'],
  transactions: [
    tx({
      date: '2026-07-08',
      amount: 5.75,
      cleanedMerchant: 'STARBUCKS',
      category: 'Food + coffee',
    }),
    tx({
      date: '2026-07-03',
      amount: 13.1,
      cleanedMerchant: 'CHIPOTLE',
      category: 'Food + coffee',
    }),
  ],
}

const august: MonthFile = {
  month: '2026-08',
  generatedAt: '2026-08-31T00:00:00.000Z',
  issuers: ['amex', 'chase'],
  transactions: [
    tx({
      date: '2026-08-01',
      amount: 49.99,
      cleanedMerchant: '24 HOUR FITNESS',
      category: 'Subscriptions',
    }),
    tx({
      date: '2026-08-02',
      amount: 12.45,
      cleanedMerchant: 'CHIPOTLE',
      category: 'Food + coffee',
    }),
    tx({
      date: '2026-08-03',
      amount: 6.5,
      cleanedMerchant: 'BLUE BOTTLE COFFEE',
      category: 'Food + coffee',
    }),
  ],
}

function mockFetch(options?: { delayJulyMs?: number; delayAugustMs?: number }) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method !== 'GET') {
      return new Response('method not allowed', { status: 405 })
    }
    if (url === '/api/months') {
      return new Response(JSON.stringify({ months: ['2026-07', '2026-08'] }), {
        status: 200,
      })
    }
    if (url === '/api/categories') {
      return new Response(JSON.stringify({ version: 1, categories: CATEGORIES }), {
        status: 200,
      })
    }
    if (url === '/api/months/2026-07') {
      const delay = options?.delayJulyMs ?? 0
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      return new Response(JSON.stringify(july), { status: 200 })
    }
    if (url === '/api/months/2026-08') {
      const delay = options?.delayAugustMs ?? 0
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
      return new Response(JSON.stringify(august), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function merchantsOnBoard(): string[] {
  return screen
    .queryAllByTestId('transaction-card')
    .map((card) => within(card).getByRole('heading').textContent ?? '')
}

function columnNames(): string[] {
  return screen.getAllByTestId(/column-/).map((el) => el.getAttribute('data-category') ?? '')
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('App month switcher', () => {
  it('defaults to the latest listed month and fetches that MonthFile', async () => {
    const fetchMock = mockFetch()
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Month' })).toHaveProperty('value', '2026-08')
    })
    await waitFor(() => {
      expect(merchantsOnBoard()).toEqual(expect.arrayContaining(['CHIPOTLE', '24 HOUR FITNESS', 'BLUE BOTTLE COFFEE']))
    })
    expect(merchantsOnBoard()).not.toContain('STARBUCKS')

    const urls = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase(),
    }))
    expect(urls).toEqual(
      expect.arrayContaining([
        { url: '/api/months', method: 'GET' },
        { url: '/api/months/2026-08', method: 'GET' },
      ]),
    )
    expect(urls.some((call) => call.method === 'PUT')).toBe(false)
  })

  it('replaces August cards with only July transactions and does not PUT', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch()
    render(<App />)

    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('24 HOUR FITNESS')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')

    await waitFor(() => {
      expect(merchantsOnBoard()).toEqual(expect.arrayContaining(['STARBUCKS', 'CHIPOTLE']))
    })
    expect(merchantsOnBoard()).not.toContain('24 HOUR FITNESS')
    expect(merchantsOnBoard()).not.toContain('BLUE BOTTLE COFFEE')
    expect(merchantsOnBoard()).toHaveLength(2)
    expect(screen.getByTestId('selected-month').textContent).toBe('2026-07')

    const food = screen.getByTestId('column-Food + coffee')
    expect(within(food).getByText('2')).toBeTruthy()
    expect(within(food).getByText('$18.85')).toBeTruthy()

    const urls = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase(),
    }))
    expect(urls).toEqual(expect.arrayContaining([{ url: '/api/months/2026-07', method: 'GET' }]))
    expect(urls.some((call) => call.method === 'PUT')).toBe(false)
  })

  it('restores the exclusive August set after switching back', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)

    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('24 HOUR FITNESS')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('STARBUCKS')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-08')
    await waitFor(() => {
      expect(merchantsOnBoard()).toEqual(
        expect.arrayContaining(['24 HOUR FITNESS', 'CHIPOTLE', 'BLUE BOTTLE COFFEE']),
      )
    })
    expect(merchantsOnBoard()).not.toContain('STARBUCKS')
    expect(merchantsOnBoard()).toHaveLength(3)
    expect(screen.getByTestId('selected-month').textContent).toBe('2026-08')
  })

  it('keeps the nine closed category columns in order after a month switch', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)

    await waitFor(() => {
      expect(columnNames()).toEqual(CATEGORIES)
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('STARBUCKS')
    })
    expect(columnNames()).toEqual(CATEGORIES)
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)
  })

  it('does not mix a slower previous-month fetch into the newly selected month', async () => {
    const user = userEvent.setup()
    mockFetch({ delayAugustMs: 80 })
    render(<App />)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Month' })).toHaveProperty('value', '2026-08')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')
    await waitFor(() => {
      expect(merchantsOnBoard()).toEqual(expect.arrayContaining(['STARBUCKS', 'CHIPOTLE']))
    })

    await new Promise((resolve) => setTimeout(resolve, 120))
    expect(merchantsOnBoard()).not.toContain('24 HOUR FITNESS')
    expect(merchantsOnBoard()).not.toContain('BLUE BOTTLE COFFEE')
    expect(merchantsOnBoard()).toHaveLength(2)
  })
})
