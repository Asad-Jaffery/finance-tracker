/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Transaction } from '../types.ts'
import { Board } from './Board.tsx'

afterEach(() => {
  cleanup()
})

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

const transactions: Transaction[] = [
  {
    date: '2026-08-02',
    amount: 12.45,
    rawMerchant: 'CHIPOTLE #1823 SF',
    cleanedMerchant: 'CHIPOTLE',
    issuer: 'amex',
    kind: 'purchase',
    category: 'Food + coffee',
  },
  {
    date: '2026-08-13',
    amount: -5.4,
    rawMerchant: 'CHIPOTLE #1823 SF',
    cleanedMerchant: 'CHIPOTLE',
    issuer: 'amex',
    kind: 'refund',
    category: 'Food + coffee',
  },
  {
    date: '2026-08-07',
    amount: 18.4,
    rawMerchant: 'UBER *TRIP',
    cleanedMerchant: 'UBER',
    issuer: 'chase',
    kind: 'purchase',
    category: 'Transit',
  },
]

function column(name: string) {
  return screen.getByTestId(`column-${name}`)
}

describe('Board', () => {
  it('renders exactly nine columns in locked category order including empties', () => {
    render(<Board categories={CATEGORIES} transactions={transactions} />)
    const columns = screen.getAllByTestId(/column-/)
    expect(columns).toHaveLength(9)
    expect(columns.map((el) => el.getAttribute('data-category'))).toEqual(CATEGORIES)
    expect(within(column('Gas')).getByText('Gas')).toBeTruthy()
    expect(within(column('Gas')).getByText('0')).toBeTruthy()
    expect(within(column('Gas')).getByText('$0.00')).toBeTruthy()
  })

  it('renders one card per transaction with cleanedMerchant, amount, date, and issuer', () => {
    render(<Board categories={CATEGORIES} transactions={transactions} />)
    const cards = screen.getAllByTestId('transaction-card')
    expect(cards).toHaveLength(3)

    const chipotlePurchase = cards[0]!
    expect(within(chipotlePurchase).getByText('CHIPOTLE')).toBeTruthy()
    expect(within(chipotlePurchase).queryByText('CHIPOTLE #1823 SF')).toBeNull()
    expect(within(chipotlePurchase).getByText('$12.45')).toBeTruthy()
    expect(within(chipotlePurchase).getByText('2026-08-02')).toBeTruthy()
    expect(within(chipotlePurchase).getByText('amex')).toBeTruthy()
  })

  it('shows purchases as positive and refunds as negative in the same category column', () => {
    render(<Board categories={CATEGORIES} transactions={transactions} />)
    const food = column('Food + coffee')
    const cards = within(food).getAllByTestId('transaction-card')
    expect(cards).toHaveLength(2)
    expect(within(food).getByText('$12.45')).toBeTruthy()
    expect(within(food).getByText('-$5.40')).toBeTruthy()
    expect(screen.queryByText('Refunds')).toBeNull()
    expect(within(food).getByText('2')).toBeTruthy()
    expect(within(food).getByText('$7.05')).toBeTruthy()
  })

  it('shows distinct issuer badges', () => {
    render(<Board categories={CATEGORIES} transactions={transactions} />)
    expect(screen.getAllByText('amex').length).toBeGreaterThan(0)
    expect(screen.getAllByText('chase').length).toBeGreaterThan(0)
  })

  it('does not grow extra columns from unknown categories', () => {
    render(
      <Board
        categories={CATEGORIES}
        transactions={[
          {
            date: '2026-08-01',
            amount: 10,
            rawMerchant: 'WEIRD',
            cleanedMerchant: 'WEIRD',
            issuer: 'amex',
            kind: 'purchase',
            category: 'Gym',
          },
        ]}
      />,
    )
    expect(screen.getAllByTestId(/column-/)).toHaveLength(9)
    expect(screen.queryByTestId('column-Gym')).toBeNull()
    expect(screen.queryAllByTestId('transaction-card')).toHaveLength(0)
  })

  it('still shows nine empty columns when the month has no transactions', () => {
    render(<Board categories={CATEGORIES} transactions={[]} />)
    const columns = screen.getAllByTestId(/column-/)
    expect(columns).toHaveLength(9)
    expect(screen.queryByTestId('transaction-card')).toBeNull()
    expect(within(column('Food + coffee')).getByText('$0.00')).toBeTruthy()
  })
})
