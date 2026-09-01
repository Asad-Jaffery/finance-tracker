import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { groupByClosedCategories } from '../totals.ts'
import type { Transaction } from '../types.ts'
import { Column } from './Column.tsx'

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
