import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

const MONTH_ID = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_BODY_BYTES = 1024 * 1024

export type NextFunction = (err?: unknown) => void

export type LocalDataMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void

type Route =
  | { kind: 'months-index' }
  | { kind: 'month'; id: string }
  | { kind: 'categories' }
  | { kind: 'invalid' }

export function isValidMonthId(value: string): boolean {
  return MONTH_ID.test(value)
}

export function localDataPlugin(): Plugin {
  return {
    name: 'local-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(createLocalDataMiddleware(server.config.root))
    },
  }
}

export function createLocalDataMiddleware(root: string): LocalDataMiddleware {
  const dataRoot = path.resolve(root, 'data')

  return (req, res, next) => {
    void handle(req, res, next, dataRoot).catch(() => {
      if (!res.writableEnded) {
        sendJson(res, 500, { error: 'internal' })
      }
    })
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
  dataRoot: string,
): Promise<void> {
  const rawUrl = req.url ?? '/'
  if (hasUnsafePath(rawUrl)) {
    sendJson(res, 400, { error: 'bad path' })
    return
  }

  const pathname = decodePathname(rawUrl)
  if (pathname === null || hasUnsafePath(pathname)) {
    sendJson(res, 400, { error: 'bad path' })
    return
  }

  const route = matchRoute(pathname)
  if (!route) {
    next()
    return
  }

  if (route.kind === 'invalid') {
    sendJson(res, 400, { error: 'bad path' })
    return
  }

  if (req.method === 'GET') {
    await handleGet(route, res, dataRoot)
    return
  }

  if (req.method === 'PUT') {
    await handlePut(req, res, route, dataRoot)
    return
  }

  const allow = writableRoute(route) ? 'GET, PUT' : 'GET'
  res.statusCode = 405
  res.setHeader('Allow', allow)
  res.end()
}

function writableRoute(route: Exclude<Route, { kind: 'invalid' }>): boolean {
  return route.kind === 'month'
}

async function handleGet(
  route: Exclude<Route, { kind: 'invalid' }>,
  res: ServerResponse,
  dataRoot: string,
): Promise<void> {
  switch (route.kind) {
    case 'months-index': {
      sendJson(res, 200, { months: await listMonths(dataRoot) })
      return
    }
    case 'month': {
      const filePath = resolveUnderData(dataRoot, path.join('months', `${route.id}.json`))
      if (!filePath) {
        sendJson(res, 400, { error: 'bad path' })
        return
      }
      const body = await readJsonFile(filePath)
      if (body === null) {
        sendJson(res, 404, { error: 'not found' })
        return
      }
      sendJson(res, 200, body)
      return
    }
    case 'categories': {
      const filePath = resolveUnderData(dataRoot, 'categories.json')
      if (!filePath) {
        sendJson(res, 400, { error: 'bad path' })
        return
      }
      const body = await readJsonFile(filePath)
      if (body === null) {
        sendJson(res, 404, { error: 'not found' })
        return
      }
      sendJson(res, 200, body)
    }
  }
}

async function handlePut(
  req: IncomingMessage,
  res: ServerResponse,
  route: Exclude<Route, { kind: 'invalid' }>,
  dataRoot: string,
): Promise<void> {
  if (!writableRoute(route)) {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end()
    return
  }

  const parsed = await readJsonObjectBody(req)
  if (!parsed.ok) {
    sendJson(res, parsed.status, { error: parsed.error })
    return
  }

  if (route.kind === 'month') {
    if (parsed.value.month !== route.id) {
      sendJson(res, 400, { error: 'month mismatch' })
      return
    }
    const filePath = resolveUnderData(dataRoot, path.join('months', `${route.id}.json`))
    if (!filePath) {
      sendJson(res, 400, { error: 'bad path' })
      return
    }
    await atomicWriteJson(filePath, parsed.value)
    sendJson(res, 200, parsed.value)
    return
  }

}

async function readJsonObjectBody(
  req: IncomingMessage,
): Promise<
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const raw = await readLimitedBody(req)
  if (!raw.ok) {
    return { ok: false, status: raw.status, error: raw.error }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw.text) as unknown
  } catch {
    return { ok: false, status: 400, error: 'invalid json' }
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, status: 400, error: 'json object required' }
  }

  return { ok: true, value: parsed }
}

async function readLimitedBody(
  req: IncomingMessage,
): Promise<{ ok: true; text: string } | { ok: false; status: number; error: string }> {
  const chunks: Buffer[] = []
  let size = 0
  let overflow = false

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > MAX_BODY_BYTES) {
      overflow = true
      continue
    }
    chunks.push(buf)
  }

  if (overflow) {
    return { ok: false, status: 413, error: 'payload too large' }
  }

  return { ok: true, text: Buffer.concat(chunks).toString('utf8') }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  const payload = `${JSON.stringify(value, null, 2)}\n`
  try {
    await writeFile(tmpPath, payload, 'utf8')
    await rename(tmpPath, filePath)
  } catch (error) {
    await unlink(tmpPath).catch(() => {})
    throw error
  }
}

function matchRoute(pathname: string): Route | null {
  if (pathname === '/api/months') return { kind: 'months-index' }
  if (pathname === '/api/categories') return { kind: 'categories' }

  if (pathname.startsWith('/api/months/')) {
    const rest = pathname.slice('/api/months/'.length)
    if (isValidMonthId(rest)) return { kind: 'month', id: rest }
    return { kind: 'invalid' }
  }

  if (pathname.startsWith('/api/categories/')) {
    return { kind: 'invalid' }
  }

  return null
}

async function listMonths(dataRoot: string): Promise<string[]> {
  const monthsDir = path.join(dataRoot, 'months')
  let names: string[]
  try {
    names = await readdir(monthsDir)
  } catch (error) {
    if (isEnoent(error)) return []
    throw error
  }

  return names
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .filter(isValidMonthId)
    .sort()
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  let text: string
  try {
    text = await readFile(filePath, 'utf8')
  } catch (error) {
    if (isEnoent(error)) return null
    throw error
  }
  return JSON.parse(text) as unknown
}

function resolveUnderData(dataRoot: string, relative: string): string | null {
  const resolved = path.resolve(dataRoot, relative)
  const prefix = dataRoot.endsWith(path.sep) ? dataRoot : dataRoot + path.sep
  if (resolved !== dataRoot && !resolved.startsWith(prefix)) return null
  return resolved
}

function hasUnsafePath(value: string): boolean {
  const pathOnly = value.split('?')[0] ?? value
  const lowered = pathOnly.toLowerCase()
  return (
    pathOnly.includes('\0') ||
    pathOnly.includes('..') ||
    pathOnly.includes('\\') ||
    lowered.includes('%2e') ||
    lowered.includes('%00')
  )
}

function decodePathname(reqUrl: string): string | null {
  const pathOnly = reqUrl.split('?')[0] ?? '/'
  try {
    return decodeURIComponent(pathOnly)
  } catch {
    return null
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'ENOENT'
  )
}
