/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === '/api/months') {
        return new Response(JSON.stringify({ months: [] }), { status: 200 })
      }
      if (url === '/api/categories') {
        return new Response(JSON.stringify({ version: 1, categories: [] }), {
          status: 200,
        })
      }
      return new Response('not found', { status: 404 })
    }),
  )
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('renders the finance tracker title', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Finance tracker' })).toBeTruthy()
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })
  })

  it('fetches months and categories from same-origin /api', async () => {
    render(<App />)
    await waitFor(() => {
      const calls = vi.mocked(globalThis.fetch).mock.calls.map(([url]) => String(url))
      expect(calls).toEqual(expect.arrayContaining([
        '/api/months',
        '/api/categories',
      ]))
      expect(calls).not.toContain('/api/merchant-map')
    })
  })
})
