import { groupByClosedCategories } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { Column } from './Column.tsx'

export function Board({
  categories,
  transactions,
}: {
  categories: string[]
  transactions: Transaction[]
}) {
  const columns = groupByClosedCategories(categories, transactions)
  return (
    <div className="board" data-testid="board">
      {columns.map((column) => (
        <Column
          key={column.category}
          category={column.category}
          transactions={column.transactions}
        />
      ))}
    </div>
  )
}
