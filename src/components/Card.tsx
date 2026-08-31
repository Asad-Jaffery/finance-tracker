import { formatUsd } from '../totals.ts'
import type { Transaction } from '../types.ts'

export function Card({ transaction }: { transaction: Transaction }) {
  const refund = transaction.kind === 'refund' || transaction.amount < 0
  const identity = `${transaction.date}|${transaction.amount}|${transaction.rawMerchant}`
  return (
    <article
      className={refund ? 'card card-refund' : 'card'}
      data-testid="transaction-card"
      data-identity={identity}
    >
      <h3 className="card-merchant">{transaction.cleanedMerchant}</h3>
      <p className="card-amount">{formatUsd(transaction.amount)}</p>
      <p className="card-date">{transaction.date}</p>
      <span className="card-issuer">{transaction.issuer}</span>
    </article>
  )
}
