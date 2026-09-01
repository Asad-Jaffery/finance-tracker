import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { categoryTotals, formatUsd } from '../totals.ts'
import type { Transaction } from '../types.ts'

export function Dashboard({
  categories,
  transactions,
}: {
  categories: string[]
  transactions: Transaction[]
}) {
  const totals = categoryTotals(categories, transactions)
  const isEmpty = transactions.length === 0

  return (
    <main className="dashboard" data-testid="dashboard">
      <h2>Dashboard</h2>
      <section data-testid="dashboard-category-totals">
        <h3>Category totals</h3>
        {isEmpty ? <p>no transactions</p> : null}
        <div className="dashboard-chart" data-testid="category-totals-chart">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={totals}
              layout="vertical"
              margin={{ top: 8, right: 72, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value: number) => formatUsd(value)}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={168}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatUsd(Number(value ?? 0))}
                labelFormatter={(label) => String(label)}
              />
              <Bar dataKey="total" name="Total" fill="#6b4ea0" maxBarSize={28}>
                <LabelList
                  dataKey="total"
                  position="right"
                  formatter={(value) => formatUsd(Number(value ?? 0))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="category-total-list" data-testid="category-total-list">
          {totals.map((row) => (
            <li
              key={row.category}
              data-category={row.category}
              data-total={String(row.total)}
            >
              {row.category}: {formatUsd(row.total)}
            </li>
          ))}
        </ul>
      </section>
      <section data-testid="dashboard-vs-last-month">
        <h3>Vs last month</h3>
        <p>Comparison placeholder.</p>
      </section>
      <section data-testid="dashboard-trend">
        <h3>Trend</h3>
        <p>No transactions</p>
      </section>
    </main>
  )
}
