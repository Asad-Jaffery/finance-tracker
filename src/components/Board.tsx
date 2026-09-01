import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type ClientRect,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { groupByClosedCategories } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { Column } from './Column.tsx'

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
  onDefaultDrag,
  onOnlyThisCharge,
}: {
  categories: string[]
  transactions: Transaction[]
  onDefaultDrag?: (cleanedMerchant: string, toCategory: string) => void
  onOnlyThisCharge?: (identity: string, toCategory: string) => void
}) {
  const columns = groupByClosedCategories(categories, transactions)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinateGetter }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const toCategory = String(over.id)
    if (!categories.includes(toCategory)) return

    const cleanedMerchant = active.data.current?.cleanedMerchant
    const fromCategory = active.data.current?.category
    if (typeof cleanedMerchant !== 'string' || cleanedMerchant.length === 0) {
      return
    }
    if (fromCategory === toCategory) return

    onDefaultDrag?.(cleanedMerchant, toCategory)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
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
    </DndContext>
  )
}
