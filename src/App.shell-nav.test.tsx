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
    if (url === '/api/months/2026-07') {
      return new Response(JSON.stringify(july), { status: 200 })
    }
    if (url === '/api/months/2026-08') {
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('App shell navigation', () => {
  it('shows title, month switcher, and Board/Dashboard nav on the board', async () => {
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeTruthy()
    })
    expect(screen.getByRole('heading', { name: 'Finance tracker' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Month' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Board' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull()
  })

  it('has no login, password, or PDF ingest controls on the board', async () => {
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeTruthy()
    })
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByRole('textbox', { name: /login|email|password|api key/i })).toBeNull()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByText(/upload statement/i)).toBeNull()
    expect(screen.queryByText(/ingest/i)).toBeNull()
  })

  it('keeps the kanban when Board is clicked from /', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('CHIPOTLE')
    })
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)

    await user.click(screen.getByRole('link', { name: 'Board' }))

    expect(window.location.pathname).toBe('/')
    expect(screen.getByTestId('board')).toBeTruthy()
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)
    expect(screen.queryByTestId('dashboard')).toBeNull()
  })

  it('leaves the kanban when Dashboard is clicked and hides merchant search', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeTruthy()
    })

    await user.click(screen.getByRole('link', { name: 'Dashboard' }))

    expect(window.location.pathname).toBe('/dashboard')
    expect(screen.getByTestId('dashboard')).toBeTruthy()
    expect(screen.queryByTestId('board')).toBeNull()
    expect(screen.queryAllByTestId(/column-/)).toHaveLength(0)
    expect(screen.queryByRole('searchbox', { name: 'Search merchants' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(screen.getByRole('link', { name: 'Board' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByTestId('dashboard-category-totals')).toBeTruthy()
    expect(screen.getByTestId('dashboard-vs-last-month')).toBeTruthy()
    expect(screen.getByTestId('dashboard-trend')).toBeTruthy()
  })

  it('does not render nine kanban columns on a direct /dashboard load', async () => {
    window.history.replaceState({}, '', '/dashboard')
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeTruthy()
    })
    expect(screen.queryByTestId('board')).toBeNull()
    expect(screen.queryAllByTestId(/column-/)).toHaveLength(0)
    expect(screen.getByRole('heading', { name: 'Finance tracker' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Month' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Board' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.queryByRole('searchbox', { name: 'Search merchants' })).toBeNull()
    expect(document.querySelector('input[type="file"]')).toBeNull()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    expect(screen.queryByText(/upload statement/i)).toBeNull()
  })

  it('restores the kanban from Dashboard via the Board link and keeps the month', async () => {
    const user = userEvent.setup()
    mockFetch()
    render(<App />)
    await waitFor(() => {
      expect(merchantsOnBoard()).toContain('CHIPOTLE')
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2026-07')
    await waitFor(() => {
      expect(merchantsOnBoard()).toEqual(['STARBUCKS'])
    })

    await user.click(screen.getByRole('link', { name: 'Dashboard' }))
    expect(screen.getByTestId('dashboard')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveProperty('value', '2026-07')

    await user.click(screen.getByRole('link', { name: 'Board' }))
    expect(window.location.pathname).toBe('/')
    await waitFor(() => {
      expect(screen.getByTestId('board')).toBeTruthy()
    })
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)
    expect(screen.queryByTestId('dashboard')).toBeNull()
    expect(screen.getByRole('combobox', { name: 'Month' })).toHaveProperty('value', '2026-07')
    expect(merchantsOnBoard()).toEqual(['STARBUCKS'])
  })
})
