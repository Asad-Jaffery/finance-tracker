import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { transactionIdentity } from '../recategorize.ts'
import { formatUsd } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { CardMenu } from './CardMenu.tsx'

export function Card({
  transaction,
  categories,
  onOnlyThisCharge,
}: {
  transaction: Transaction
  categories: string[]
  onOnlyThisCharge?: (identity: string, toCategory: string) => void
}) {
  const refund = transaction.kind === 'refund' || transaction.amount < 0
  const identity = transactionIdentity(transaction)
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
        transform: isDragging ? undefined : CSS.Translate.toString(transform),
      }}
      {...listeners}
      {...attributes}
    >
      <div className="card-top">
        <h3 className="card-merchant">{transaction.cleanedMerchant}</h3>
        <div
          className="card-menu-wrap"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <CardMenu
            categories={categories}
            currentCategory={transaction.category}
            onMoveOnlyThisCharge={(toCategory) =>
              onOnlyThisCharge?.(identity, toCategory)
            }
          />
        </div>
      </div>
      <p className="card-amount">{formatUsd(transaction.amount)}</p>
      <p className="card-date">{transaction.date}</p>
      <span className="card-issuer">{transaction.issuer}</span>
    </article>
  )
}
