import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  categoryTotals,
  formatMonth,
  formatSignedDelta,
  formatUsd,
  vsLastMonth,
  type TrendPoint,
} from '../totals.ts'
import type { Transaction } from '../types.ts'

export function Dashboard({
  month,
  categories,
  transactions,
  previousTransactions,
  previousKnown,
  trend,
}: {
  month: string
  categories: string[]
  transactions: Transaction[]
  previousTransactions: Transaction[] | null
  previousKnown: boolean
  trend: TrendPoint[]
}) {
  const totals = categoryTotals(categories, transactions)
  const comparison = previousKnown
    ? vsLastMonth(categories, transactions, previousTransactions)
    : []
  const isEmpty = transactions.length === 0

  return (
    <main className="dashboard" data-testid="dashboard" data-month={month}>
      <h2>Dashboard</h2>
      {month ? (
        <p data-testid="dashboard-month" hidden>
          {month}
        </p>
      ) : null}
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
        <table className="vs-last-month-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>This month</th>
              <th>Previous month</th>
              <th>Delta</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr
                key={row.category}
                data-testid="vs-last-month-row"
                data-category={row.category}
                data-this={String(row.thisTotal)}
                data-previous={
                  row.hasPrevious
                    ? String(row.previousTotal)
                    : 'no previous month'
                }
                data-delta={row.hasPrevious ? String(row.delta) : ''}
              >
                <td>{row.category}</td>
                <td>{formatUsd(row.thisTotal)}</td>
                <td>
                  {row.hasPrevious
                    ? formatUsd(row.previousTotal ?? 0)
                    : 'no previous month'}
                </td>
                <td>
                  {row.hasPrevious
                    ? formatSignedDelta(row.delta ?? 0)
                    : 'no previous month'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section data-testid="dashboard-trend">
        <h3>Trend</h3>
        <div className="dashboard-chart" data-testid="trend-chart">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={trend}
              margin={{ top: 8, right: 24, bottom: 8, left: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" interval={0} tickFormatter={formatMonth} />
              <YAxis tickFormatter={(value: number) => formatUsd(value)} />
              <Tooltip
                formatter={(value) => formatUsd(Number(value ?? 0))}
                labelFormatter={(label) => formatMonth(String(label))}
              />
              <Line
                type="linear"
                dataKey="total"
                name="Total spend"
                stroke="#6b4ea0"
                strokeWidth={2}
                dot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ul className="category-total-list" data-testid="trend-point-list">
          {trend.map((row) => (
            <li
              key={row.month}
              data-month={row.month}
              data-total={String(row.total)}
            >
              {formatMonth(row.month)}: {formatUsd(row.total)}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
