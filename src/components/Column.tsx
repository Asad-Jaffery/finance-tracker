import { useDroppable } from '@dnd-kit/core'
import { columnTotal, formatUsd } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { Card } from './Card.tsx'

export function Column({
  category,
  transactions,
}: {
  category: string
  transactions: Transaction[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: category })

  return (
    <section
      ref={setNodeRef}
      className={isOver ? 'column column-over' : 'column'}
      data-testid={`column-${category}`}
      data-category={category}
    >
      <header className="column-header">
        <h2 className="column-name">{category}</h2>
        <p className="column-count">{transactions.length}</p>
        <p className="column-total">{formatUsd(columnTotal(transactions))}</p>
      </header>
      <div className="column-cards">
        {transactions.map((tx) => (
          <Card key={`${tx.date}|${tx.amount}|${tx.rawMerchant}`} transaction={tx} />
        ))}
      </div>
    </section>
  )
}
