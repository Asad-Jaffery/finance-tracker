import { useEffect, useState } from 'react'
import { fetchCategories, fetchMerchantMap, fetchMonth, fetchMonths } from './api.ts'
import type { MerchantMap, MonthFile } from './types.ts'

export default function App() {
  const [months, setMonths] = useState<string[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [merchantMap, setMerchantMap] = useState<MerchantMap>({})
  const [selectedMonth, setSelectedMonth] = useState<MonthFile | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchMonths()
        setMonths(list)
        const latest = list.at(-1)
        if (latest) {
          setSelectedMonth(await fetchMonth(latest))
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

  return (
    <main>
      <h1>Finance tracker</h1>
      <p>Local spending tracker</p>
      <p data-testid="months-list">{months.join(',')}</p>
      <p data-testid="categories-list">{categories.join(',')}</p>
      <p data-testid="merchant-map-count">{Object.keys(merchantMap).length}</p>
      {selectedMonth ? (
        <p data-testid="selected-month">{selectedMonth.month}</p>
      ) : null}
    </main>
  )
}
