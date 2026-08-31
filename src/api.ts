import type { CategoriesFile, MerchantMap, MonthFile } from './types.ts'

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`)
  }
  return (await response.json()) as T
}

export async function fetchMonths(): Promise<string[]> {
  const data = await getJson<{ months: string[] }>('/api/months')
  return data.months
}

export async function fetchMonth(month: string): Promise<MonthFile> {
  return getJson<MonthFile>(`/api/months/${month}`)
}

export async function fetchMerchantMap(): Promise<MerchantMap> {
  return getJson<MerchantMap>('/api/merchant-map')
}

export async function fetchCategories(): Promise<CategoriesFile> {
  return getJson<CategoriesFile>('/api/categories')
}
