import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { formatUsd } from '../totals.ts'
import type { Transaction } from '../types.ts'

export function Card({ transaction }: { transaction: Transaction }) {
  const refund = transaction.kind === 'refund' || transaction.amount < 0
  const identity = `${transaction.date}|${transaction.amount}|${transaction.rawMerchant}`
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: identity,
    data: {
      cleanedMerchant: transaction.cleanedMerchant,
      category: transaction.category,
    },
  })

  return (
    <article
      ref={setNodeRef}
      className={[
        'card',
        refund ? 'card-refund' : '',
        isDragging ? 'card-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="transaction-card"
      data-identity={identity}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      {...listeners}
      {...attributes}
    >
      <h3 className="card-merchant">{transaction.cleanedMerchant}</h3>
      <p className="card-amount">{formatUsd(transaction.amount)}</p>
      <p className="card-date">{transaction.date}</p>
      <span className="card-issuer">{transaction.issuer}</span>
    </article>
  )
}
