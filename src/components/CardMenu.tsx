export function CardMenu({
  categories,
  currentCategory,
  onMoveOnlyThisCharge,
}: {
  categories: string[]
  currentCategory: string
  onMoveOnlyThisCharge: (toCategory: string) => void
}) {
  const others = categories.filter((category) => category !== currentCategory)

  return (
    <details className="card-menu" data-testid="card-menu">
      <summary className="card-menu-summary">Menu</summary>
      <div className="card-menu-panel">
        <p className="card-menu-heading">Move only this charge to…</p>
        <ul className="card-menu-list">
          {others.map((category) => (
            <li key={category}>
              <button
                type="button"
                className="card-menu-item"
                data-testid={`move-only-to-${category}`}
                onClick={() => onMoveOnlyThisCharge(category)}
              >
                {category}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
