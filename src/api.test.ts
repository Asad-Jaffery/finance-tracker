// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCategories, fetchMerchantMap, fetchMonth, fetchMonths } from './api.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api fetch wrappers', () => {
  it('loads months from GET /api/months', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('/api/months')
      return new Response(JSON.stringify({ months: ['2026-07', '2026-08'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchMonths()).resolves.toEqual(['2026-07', '2026-08'])
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('loads a month file from GET /api/months/:yyyy-mm', async () => {
    const month = {
      month: '2026-08',
      generatedAt: '2026-08-31T00:00:00.000Z',
      issuers: ['amex'],
      transactions: [],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe('/api/months/2026-08')
        return new Response(JSON.stringify(month), { status: 200 })
      }),
    )

    await expect(fetchMonth('2026-08')).resolves.toEqual(month)
  })

  it('throws when a month GET is 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    )
    await expect(fetchMonth('1999-01')).rejects.toThrow(/404/)
  })

  it('loads merchant map and categories from same-origin /api paths', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/merchant-map') {
        return new Response(JSON.stringify({}), { status: 200 })
      }
      if (url === '/api/categories') {
        return new Response(
          JSON.stringify({ version: 1, categories: ['Food + coffee'] }),
          { status: 200 },
        )
      }
      return new Response('nope', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchMerchantMap()).resolves.toEqual({})
    await expect(fetchCategories()).resolves.toEqual({
      version: 1,
      categories: ['Food + coffee'],
    })
  })

  it('does not load ledger files via import.meta.glob or public/', () => {
    const apiSource = readFileSync(fileURLToPath(new URL('./api.ts', import.meta.url)), 'utf8')
    expect(apiSource).not.toMatch(/import\.meta\.glob/)
    expect(apiSource).not.toMatch(/from ['"][^'"]*public\//)
    expect(apiSource).toContain("'/api/months'")
    expect(apiSource).toContain('`/api/months/${month}`')
    expect(apiSource).toContain("'/api/merchant-map'")
    expect(apiSource).toContain("'/api/categories'")
  })
})
