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

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'cleanedMerchant' | 'amount' | 'date'>,
): Transaction {
  return {
    rawMerchant: partial.rawMerchant ?? partial.cleanedMerchant,
    issuer: partial.issuer ?? 'amex',
    kind: partial.kind ?? (partial.amount < 0 ? 'refund' : 'purchase'),
    category: partial.category ?? 'Food + coffee',
    ...partial,
  }
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
      rawMerchant: '24 HOUR FITNESS #123',
      category: 'Subscriptions',
    }),
    tx({
      date: '2026-08-02',
      amount: 12.45,
      cleanedMerchant: 'CHIPOTLE',
      rawMerchant: 'CHIPOTLE #1823 SF',
      category: 'Food + coffee',
    }),
    tx({
      date: '2026-08-03',
      amount: 6.5,
      cleanedMerchant: 'BLUE BOTTLE COFFEE',
      rawMerchant: 'SQ *BLUE BOTTLE COFFEE',
      category: 'Food + coffee',
    }),
    tx({
      date: '2026-08-13',
      amount: -5.4,
      cleanedMerchant: 'CHIPOTLE',
      rawMerchant: 'CHIPOTLE #1823 SF',
      kind: 'refund',
      category: 'Food + coffee',
    }),
  ],
}

function mockFetch() {
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
    if (url === '/api/merchant-map') {
      return new Response(JSON.stringify({}), { status: 200 })
    }
    if (url === '/api/months/2026-08') {
      return new Response(JSON.stringify(august), { status: 200 })
    }
    if (url === '/api/months/2026-07') {
      return new Response(
        JSON.stringify({
          month: '2026-07',
          generatedAt: '2026-07-31T00:00:00.000Z',
          issuers: ['amex'],
          transactions: [],
        }),
        { status: 200 },
      )
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

function searchInput() {
  return screen.getByRole('searchbox', { name: 'Search merchants' })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('App merchant search', () => {
  it('shows a focusable merchant search on the board', async () => {
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('CHIPOTLE')
    })
    const input = searchInput()
    expect(input).toBeTruthy()
    input.focus()
    expect(document.activeElement).toBe(input)
  })

  it('filters cards by cleanedMerchant substring and updates column headers', async () => {
    const user = userEvent.setup()
    const fetchMock = mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toHaveLength(4)
    })

    await user.type(searchInput(), 'chipotle')

    expect(merchantsOnBoard()).toEqual(['CHIPOTLE', 'CHIPOTLE'])
    const food = screen.getByTestId('column-Food + coffee')
    expect(food.querySelector('.column-count')?.textContent).toBe('2')
    expect(food.querySelector('.column-total')?.textContent).toBe('$7.05')
    const subscriptions = screen.getByTestId('column-Subscriptions')
    expect(subscriptions.querySelector('.column-count')?.textContent).toBe('0')
    expect(subscriptions.querySelector('.column-total')?.textContent).toBe('$0.00')
    expect(columnNames()).toEqual(CATEGORIES)

    const methods = fetchMock.mock.calls.map(([, init]) =>
      ((init as RequestInit | undefined)?.method ?? 'GET').toUpperCase(),
    )
    expect(methods.some((method) => method === 'PUT')).toBe(false)
  })

  it('treats CHIPOTLE and Chipotle the same as chipotle', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('CHIPOTLE')
    })

    await user.type(searchInput(), 'CHIPOTLE')
    const upper = merchantsOnBoard()
    await user.clear(searchInput())
    await user.type(searchInput(), 'Chipotle')
    expect(merchantsOnBoard()).toEqual(upper)
    expect(upper).toEqual(['CHIPOTLE', 'CHIPOTLE'])
  })

  it('matches a rawMerchant substring that is not in cleanedMerchant', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('CHIPOTLE')
    })

    await user.type(searchInput(), '1823')
    expect(merchantsOnBoard()).toEqual(['CHIPOTLE', 'CHIPOTLE'])
  })

  it('restores the full month when the search is cleared', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toHaveLength(4)
    })

    await user.type(searchInput(), 'chipotle')
    expect(merchantsOnBoard()).toHaveLength(2)

    await user.clear(searchInput())
    expect(merchantsOnBoard()).toHaveLength(4)
    expect(merchantsOnBoard()).toEqual(
      expect.arrayContaining(['CHIPOTLE', '24 HOUR FITNESS', 'BLUE BOTTLE COFFEE']),
    )
    const food = screen.getByTestId('column-Food + coffee')
    expect(food.querySelector('.column-count')?.textContent).toBe('3')
    expect(food.querySelector('.column-total')?.textContent).toBe('$13.55')
    const subscriptions = screen.getByTestId('column-Subscriptions')
    expect(subscriptions.querySelector('.column-count')?.textContent).toBe('1')
    expect(subscriptions.querySelector('.column-total')?.textContent).toBe('$49.99')
  })

  it('keeps nine empty columns when nothing matches', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toHaveLength(4)
    })

    await user.type(searchInput(), 'zzzz-no-such-merchant')
    expect(screen.queryAllByTestId('transaction-card')).toHaveLength(0)
    expect(columnNames()).toEqual(CATEGORIES)
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)
    for (const name of CATEGORIES) {
      const col = screen.getByTestId(`column-${name}`)
      expect(col.querySelector('.column-count')?.textContent).toBe('0')
      expect(col.querySelector('.column-total')?.textContent).toBe('$0.00')
    }
  })

  it('does not require merchant search on the dashboard', async () => {
    window.history.replaceState({}, '', '/dashboard')
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeTruthy()
    })
    expect(screen.queryByRole('searchbox', { name: 'Search merchants' })).toBeNull()
    expect(screen.queryByTestId('board')).toBeNull()
  })
})
