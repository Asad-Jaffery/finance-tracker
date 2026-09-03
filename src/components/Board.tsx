import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type ClientRect,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useState } from 'react'
import { formatUsd } from '../totals.ts'
import { groupByClosedCategories } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { Column } from './Column.tsx'
import { transactionIdentity } from '../recategorize.ts'

const keyboardCoordinateGetter: KeyboardCoordinateGetter = (
  event,
  { context, currentCoordinates },
) => {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') {
    return
  }

  const { collisionRect, droppableContainers, droppableRects } = context
  if (!collisionRect) return

  const columns = droppableContainers
    .getEnabled()
    .map((container) => {
      const rect = droppableRects.get(container.id)
      if (!rect) return null
      return { id: container.id as UniqueIdentifier, rect }
    })
    .filter((column): column is { id: UniqueIdentifier; rect: ClientRect } => column !== null)
    .sort((a, b) => a.rect.left - b.rect.left)

  if (columns.length === 0) return

  const currentCenterX = collisionRect.left + collisionRect.width / 2
  let currentIndex = columns.findIndex(
    (column) =>
      currentCenterX >= column.rect.left && currentCenterX <= column.rect.right,
  )
  if (currentIndex === -1) {
    currentIndex = columns.reduce((best, column, index) => {
      const dist = Math.abs(column.rect.left + column.rect.width / 2 - currentCenterX)
      const bestDist = Math.abs(
        columns[best]!.rect.left + columns[best]!.rect.width / 2 - currentCenterX,
      )
      return dist < bestDist ? index : best
    }, 0)
  }

  const next =
    columns[event.code === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1]
  if (!next) return

  const nextCenterX = next.rect.left + next.rect.width / 2
  return {
    ...currentCoordinates,
    x: currentCoordinates.x + (nextCenterX - currentCenterX),
  }
}

export function Board({
  categories,
  transactions,
  onOnlyThisCharge,
}: {
  categories: string[]
  transactions: Transaction[]
  onOnlyThisCharge?: (identity: string, toCategory: string) => void
}) {
  const columns = groupByClosedCategories(categories, transactions)
  const [activeTransaction, setActiveTransaction] = useState<Transaction | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinateGetter }),
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveTransaction(
      transactions.find((tx) => transactionIdentity(tx) === String(event.active.id)) ?? null,
    )
  }

  function handleDragCancel(_event: DragCancelEvent) {
    setActiveTransaction(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTransaction(null)
    if (!over) return

    const toCategory = String(over.id)
    if (!categories.includes(toCategory)) return

    const fromCategory = active.data.current?.category
    if (fromCategory === toCategory) return

    onOnlyThisCharge?.(String(active.id), toCategory)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="board" data-testid="board">
        {columns.map((column) => (
          <Column
            key={column.category}
            category={column.category}
            categories={categories}
            transactions={column.transactions}
            onOnlyThisCharge={onOnlyThisCharge}
          />
        ))}
      </div>
      <DragOverlay zIndex={10}>
        {activeTransaction ? (
          <article className="card card-drag-overlay" aria-hidden="true">
            <div className="card-top">
              <h3 className="card-merchant">{activeTransaction.cleanedMerchant}</h3>
            </div>
            <p className="card-amount">{formatUsd(activeTransaction.amount)}</p>
            <p className="card-date">{activeTransaction.date}</p>
            <span className="card-issuer">{activeTransaction.issuer}</span>
          </article>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
