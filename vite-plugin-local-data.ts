import { readFile, readdir } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin } from 'vite'

const MONTH_ID = /^\d{4}-(0[1-9]|1[0-2])$/

export type NextFunction = (err?: unknown) => void

export type LocalDataMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: NextFunction,
) => void

type Route =
  | { kind: 'months-index' }
  | { kind: 'month'; id: string }
  | { kind: 'merchant-map' }
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

  if (req.method !== 'GET') {
    res.statusCode = 405
    res.setHeader('Allow', 'GET')
    res.end()
    return
  }

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
    case 'merchant-map': {
      const filePath = resolveUnderData(dataRoot, 'merchant-map.json')
      if (!filePath) {
        sendJson(res, 400, { error: 'bad path' })
        return
      }
      const body = await readJsonFile(filePath)
      sendJson(res, 200, body === null ? {} : body)
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

function matchRoute(pathname: string): Route | null {
  if (pathname === '/api/months') return { kind: 'months-index' }
  if (pathname === '/api/merchant-map') return { kind: 'merchant-map' }
  if (pathname === '/api/categories') return { kind: 'categories' }

  if (pathname.startsWith('/api/months/')) {
    const rest = pathname.slice('/api/months/'.length)
    if (isValidMonthId(rest)) return { kind: 'month', id: rest }
    return { kind: 'invalid' }
  }

  if (pathname.startsWith('/api/merchant-map/') || pathname.startsWith('/api/categories/')) {
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
