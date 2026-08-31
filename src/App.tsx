import { useEffect, useState, type MouseEvent } from 'react'
import { fetchCategories, fetchMerchantMap, fetchMonth, fetchMonths } from './api.ts'
import { Board } from './components/Board.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { MerchantSearch } from './components/MerchantSearch.tsx'
import { MonthSwitcher } from './components/MonthSwitcher.tsx'
import type { MerchantMap, MonthFile } from './types.ts'

function currentPath(): string {
  return window.location.pathname
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  const [months, setMonths] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [merchantMap, setMerchantMap] = useState<MerchantMap>({})
  const [selectedMonthId, setSelectedMonthId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<MonthFile | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const onPopState = () => {
      setPath(currentPath())
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchMonths()
        setMonths(list)
        const latest = list.at(-1)
        if (latest) {
          setSelectedMonthId((current) => current || latest)
        }
      } catch {
        setMonths([])
      }

      try {
        const file = await fetchCategories()
        setCategories(file.categories)
      } catch {
        setCategories([])
      }

      try {
        setMerchantMap(await fetchMerchantMap())
      } catch {
        setMerchantMap({})
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedMonthId) return
    const requested = selectedMonthId
    let cancelled = false
    void (async () => {
      try {
        const file = await fetchMonth(requested)
        if (!cancelled) {
          setSelectedMonth(file)
        }
      } catch {
        if (!cancelled) {
          setSelectedMonth(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedMonthId])

  function navigate(event: MouseEvent<HTMLAnchorElement>, to: string) {
    event.preventDefault()
    if (currentPath() !== to) {
      window.history.pushState({}, '', to)
    }
    setPath(to)
  }

  const isDashboard = path === '/dashboard'
  const query = search.trim().toLowerCase()
  const visibleMonth =
    selectedMonth?.month === selectedMonthId ? selectedMonth : null
  const transactions = (visibleMonth?.transactions ?? []).filter((tx) => {
    if (!query) return true
    return (
      tx.cleanedMerchant.toLowerCase().includes(query) ||
      tx.rawMerchant.toLowerCase().includes(query)
    )
  })

  return (
    <div className="app">
      <header className="app-header">
        <h1>Finance tracker</h1>
        <MonthSwitcher
          months={months}
          value={selectedMonthId}
          onChange={setSelectedMonthId}
        />
        <nav className="app-nav" aria-label="Primary">
          <a href="/" onClick={(event) => navigate(event, '/')}>
            Board
          </a>
          <a href="/dashboard" onClick={(event) => navigate(event, '/dashboard')}>
            Dashboard
          </a>
        </nav>
      </header>
      {isDashboard ? (
        <Dashboard />
      ) : (
        <main>
          <MerchantSearch value={search} onChange={setSearch} />
          <Board categories={categories} transactions={transactions} />
          <p data-testid="months-list" hidden>
            {months.join(',')}
          </p>
          <p data-testid="categories-list" hidden>
            {categories.join(',')}
          </p>
          <p data-testid="merchant-map-count" hidden>
            {Object.keys(merchantMap).length}
          </p>
          {visibleMonth ? (
            <p data-testid="selected-month" hidden>
              {visibleMonth.month}
            </p>
          ) : null}
        </main>
      )}
    </div>
  )
}
