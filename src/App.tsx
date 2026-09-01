import { useEffect, useState, type MouseEvent } from 'react'
import {
  fetchCategories,
  fetchMonth,
  fetchMonths,
  putMonth,
} from './api.ts'
import { applyOnlyThisCharge } from './recategorize.ts'
import { Board } from './components/Board.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { MerchantSearch } from './components/MerchantSearch.tsx'
import { MonthSwitcher } from './components/MonthSwitcher.tsx'
import { filterByMerchantSearch } from './search.ts'
import { previousCalendarMonth, trendPoints } from './totals.ts'
import type { MonthFile, Transaction } from './types.ts'

function currentPath(): string {
  return window.location.pathname
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  const [months, setMonths] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedMonthId, setSelectedMonthId] = useState('')
  const [selectedMonth, setSelectedMonth] = useState<MonthFile | null>(null)
  const [previousMonth, setPreviousMonth] = useState<MonthFile | null>(null)
  const [hasPreviousMonth, setHasPreviousMonth] = useState<boolean | null>(
    null,
  )
  const [monthTransactions, setMonthTransactions] = useState<
    Record<string, Transaction[]>
  >({})
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

  useEffect(() => {
    if (months.length === 0) return
    const requested = months
    let cancelled = false
    void (async () => {
      const entries = await Promise.all(
        requested.map(async (month) => {
          try {
            const file = await fetchMonth(month)
            return [month, file.transactions] as const
          } catch {
            return [month, [] as Transaction[]] as const
          }
        }),
      )
      if (cancelled) return
      setMonthTransactions(Object.fromEntries(entries))
    })()
    return () => {
      cancelled = true
    }
  }, [months])

  useEffect(() => {
    if (!selectedMonthId) return
    const previousId = previousCalendarMonth(selectedMonthId)
    let cancelled = false
    setHasPreviousMonth(null)
    setPreviousMonth(null)
    void (async () => {
      try {
        const file = await fetchMonth(previousId)
        if (!cancelled) {
          setPreviousMonth(file)
          setHasPreviousMonth(true)
        }
      } catch {
        if (!cancelled) {
          setPreviousMonth(null)
          setHasPreviousMonth(false)
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
  const visibleMonth =
    selectedMonth?.month === selectedMonthId ? selectedMonth : null
  const transactions = filterByMerchantSearch(
    visibleMonth?.transactions ?? [],
    search,
  )

  function handleOnlyThisCharge(identity: string, toCategory: string) {
    if (!visibleMonth) return
    if (!categories.includes(toCategory)) return

    const result = applyOnlyThisCharge(
      visibleMonth,
      identity,
      toCategory,
    )
    setSelectedMonth(result)
    setMonthTransactions((current) => ({
      ...current,
      [result.month]: result.transactions,
    }))
    void putMonth(result.month, result)
  }

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
          <a
            href="/"
            aria-current={!isDashboard ? 'page' : undefined}
            onClick={(event) => navigate(event, '/')}
          >
            Board
          </a>
          <a
            href="/dashboard"
            aria-current={isDashboard ? 'page' : undefined}
            onClick={(event) => navigate(event, '/dashboard')}
          >
            Dashboard
          </a>
        </nav>
        {selectedMonthId ? (
          <p data-testid="selected-month" hidden>
            {selectedMonthId}
          </p>
        ) : null}
      </header>
      {isDashboard ? (
        <Dashboard
          month={selectedMonthId}
          categories={categories}
          transactions={visibleMonth?.transactions ?? []}
          previousKnown={hasPreviousMonth !== null}
          previousTransactions={
            hasPreviousMonth === true
              ? (previousMonth?.transactions ?? [])
              : null
          }
          trend={trendPoints(months, {
            ...monthTransactions,
            ...(visibleMonth
              ? { [visibleMonth.month]: visibleMonth.transactions }
              : {}),
          })}
        />
      ) : (
        <main>
          <MerchantSearch value={search} onChange={setSearch} />
          <Board
            categories={categories}
            transactions={transactions}
            onOnlyThisCharge={handleOnlyThisCharge}
          />
          <p data-testid="months-list" hidden>
            {months.join(',')}
          </p>
          <p data-testid="categories-list" hidden>
            {categories.join(',')}
          </p>
        </main>
      )}
    </div>
  )
}
