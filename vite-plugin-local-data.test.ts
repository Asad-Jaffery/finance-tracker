// @vitest-environment node
import { createServer, request as httpRequest } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createLocalDataMiddleware,
  isValidMonthId,
  localDataPlugin,
} from './vite-plugin-local-data.ts'

const SAMPLE_MONTH = {
  month: '2026-08',
  generatedAt: '2026-08-31T00:00:00.000Z',
  issuers: ['amex'],
  transactions: [],
}

async function withDataRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(path.join(tmpdir(), 'local-data-plugin-'))
  await mkdir(path.join(root, 'data', 'months'), { recursive: true })
  return {
    root,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true })
    },
  }
}

function rawGet(origin: URL, pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: origin.hostname,
        port: origin.port,
        path: pathname,
        method: 'GET',
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

async function listen(root: string): Promise<{ url: string; close: () => Promise<void> }> {
  const middleware = createLocalDataMiddleware(root)
  const server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('not handled')
    })
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      }),
  }
}

describe('localDataPlugin', () => {
  it('applies only during vite serve', () => {
    expect(localDataPlugin().apply).toBe('serve')
  })
})

describe('isValidMonthId', () => {
  it('accepts YYYY-MM calendar months', () => {
    expect(isValidMonthId('2026-01')).toBe(true)
    expect(isValidMonthId('2026-12')).toBe(true)
  })

  it('rejects traversal, separators, and impossible months', () => {
    expect(isValidMonthId('2026-13')).toBe(false)
    expect(isValidMonthId('2026-00')).toBe(false)
    expect(isValidMonthId('not-a-month')).toBe(false)
    expect(isValidMonthId('../merchant-map')).toBe(false)
    expect(isValidMonthId('2026-08.json')).toBe(false)
    expect(isValidMonthId('foo/bar')).toBe(false)
  })
})

describe('local data read API', () => {
  let cleanup: (() => Promise<void>) | undefined
  let close: (() => Promise<void>) | undefined

  afterEach(async () => {
    if (close) await close()
    if (cleanup) await cleanup()
    close = undefined
    cleanup = undefined
  })

  it('lists months from live readdir, sorted, not a snapshot', async () => {
    const data = await withDataRoot()
    cleanup = data.cleanup
    const server = await listen(data.root)
    close = server.close

    const empty = await fetch(`${server.url}/api/months`)
    expect(empty.status).toBe(200)
    expect(empty.headers.get('content-type')).toMatch(/application\/json/)
    expect(await empty.json()).toEqual({ months: [] })

    await writeFile(
      path.join(data.root, 'data', 'months', '2026-08.json'),
      JSON.stringify(SAMPLE_MONTH),
    )
    await writeFile(
      path.join(data.root, 'data', 'months', '2026-07.json'),
      JSON.stringify({ ...SAMPLE_MONTH, month: '2026-07' }),
    )
    await writeFile(path.join(data.root, 'data', 'months', 'notes.txt'), 'ignore me')
    await writeFile(path.join(data.root, 'data', 'months', '2026-13.json'), '{}')

    const listed = await fetch(`${server.url}/api/months`)
    expect(await listed.json()).toEqual({ months: ['2026-07', '2026-08'] })

    await writeFile(
      path.join(data.root, 'data', 'months', '2026-09.json'),
      JSON.stringify({ ...SAMPLE_MONTH, month: '2026-09' }),
    )
    const afterAdd = await fetch(`${server.url}/api/months`)
    expect(await afterAdd.json()).toEqual({ months: ['2026-07', '2026-08', '2026-09'] })

    await rm(path.join(data.root, 'data', 'months', '2026-09.json'))
    const afterRemove = await fetch(`${server.url}/api/months`)
    expect(await afterRemove.json()).toEqual({ months: ['2026-07', '2026-08'] })
  })

  it('returns a month file and 404s when it is missing', async () => {
    const data = await withDataRoot()
    cleanup = data.cleanup
    await writeFile(
      path.join(data.root, 'data', 'months', '2026-08.json'),
      JSON.stringify(SAMPLE_MONTH),
    )
    const server = await listen(data.root)
    close = server.close

    const found = await fetch(`${server.url}/api/months/2026-08`)
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual(SAMPLE_MONTH)

    const missing = await fetch(`${server.url}/api/months/1999-01`)
    expect(missing.status).toBe(404)
  })

  it('rejects invalid month paths on GET', async () => {
    const data = await withDataRoot()
    cleanup = data.cleanup
    const server = await listen(data.root)
    close = server.close

    const badMonth = await fetch(`${server.url}/api/months/2026-13`)
    expect(badMonth.status).toBe(400)

    const origin = new URL(server.url)
    const encoded = await rawGet(origin, '/api/months/%2e%2e/merchant-map')
    expect(encoded.status).toBe(400)

    const traversal = await rawGet(origin, '/api/months/../merchant-map')
    expect(traversal.status).toBe(400)
  })

  it('returns {} when merchant-map.json is missing', async () => {
    const data = await withDataRoot()
    cleanup = data.cleanup
    const server = await listen(data.root)
    close = server.close

    const missing = await fetch(`${server.url}/api/merchant-map`)
    expect(missing.status).toBe(200)
    expect(await missing.json()).toEqual({})

    const map = { CHIPOTLE: { category: 'Food + coffee', source: 'llm' } }
    await writeFile(path.join(data.root, 'data', 'merchant-map.json'), JSON.stringify(map))
    const found = await fetch(`${server.url}/api/merchant-map`)
    expect(await found.json()).toEqual(map)
  })

  it('returns categories.json when the file exists', async () => {
    const data = await withDataRoot()
    cleanup = data.cleanup
    const server = await listen(data.root)
    close = server.close

    const missing = await fetch(`${server.url}/api/categories`)
    expect(missing.status).toBe(404)

    const categories = {
      version: 1,
      categories: [
        'Food + coffee',
        'Groceries',
        'Gas',
        'Transit',
        'Travel',
        'Shopping',
        'Subscriptions',
        'Entertainment',
        'Other / uncategorized',
      ],
    }
    await writeFile(path.join(data.root, 'data', 'categories.json'), JSON.stringify(categories))
    const found = await fetch(`${server.url}/api/categories`)
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual(categories)
  })
})
