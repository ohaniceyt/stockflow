/**
 * Structured JSON logger for Edge Functions.
 *
 * Emits one JSON line per log entry so that log aggregation tools
 * (Supabase Logs Explorer, Vercel logs, external Loki/Vector) can
 * filter on level, function name, trace_id, and structured fields.
 *
 * Usage:
 *   const log = getLogger('complete-sale', req.headers.get('x-trace-id'))
 *   log.info('sale_completed', { receipt_id: receiptId, total })
 *   log.error('sale_failed', { error: error.message }, error)
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  function: string
  trace_id: string | null
  event: string
  message?: string
  fields?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    name?: string
  }
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const SENSITIVE_KEYS = new Set([
  'password',
  'pin',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'authorization',
  'secret',
  'service_role_key',
  'email',
  'ip_address',
])

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEYS.has(lower) || lower.endsWith('_secret') || lower.endsWith('_token')
}

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    // Mask likely JWTs (three base64 segments separated by dots).
    return value.replace(
      /(^|\s|=)(eyJ[\w-]*\.[\w-]*\.[\w-]*)/g,
      '$1[REDACTED_JWT]'
    ) as unknown as typeof value
  }
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (typeof value === 'object') return sanitizeFields(value as Record<string, unknown>)
  return value
}

function sanitizeFields(fields?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!fields) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeValue(value)
    }
  }
  return sanitized
}

function getLogLevel(): LogLevel {
  const envLevel = Deno.env.get('LOG_LEVEL')?.toLowerCase()
  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel as LogLevel
  }
  return 'info'
}

function isLevelEnabled(target: LogLevel): boolean {
  return LEVEL_ORDER[target] >= LEVEL_ORDER[getLogLevel()]
}

function writeLog(entry: LogEntry): void {
  try {
    const line = JSON.stringify(entry)
    if (entry.level === 'error') {
      console.error(line)
    } else if (entry.level === 'warn') {
      console.warn(line)
    } else {
      console.log(line)
    }
  } catch {
    // Fallback to plain console if JSON serialization fails (e.g. circular refs).
    console.log('[logger-fallback]', entry.event, entry.fields)
  }
}

export interface Logger {
  debug(event: string, fields?: Record<string, unknown>): void
  info(event: string, fields?: Record<string, unknown>): void
  warn(event: string, fields?: Record<string, unknown>): void
  error(event: string, fields?: Record<string, unknown>, err?: unknown): void
  child(fields: Record<string, unknown>): Logger
}

function createLogger(functionName: string, traceId: string | null, baseFields?: Record<string, unknown>): Logger {
  function log(level: LogLevel, event: string, fields?: Record<string, unknown>, err?: unknown) {
    if (!isLevelEnabled(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      function: functionName,
      trace_id: traceId,
      event,
      fields: sanitizeFields({ ...baseFields, ...fields }),
    }

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: sanitizeValue(err.message) as string,
        stack: typeof err.stack === 'string' ? (sanitizeValue(err.stack) as string) : undefined,
      }
    } else if (err !== undefined && err !== null) {
      entry.error = {
        message: sanitizeValue(String(err)) as string,
      }
    }

    writeLog(entry)
  }

  return {
    debug: (event, fields) => log('debug', event, fields),
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields, err) => log('error', event, fields, err),
    child: (fields) => createLogger(functionName, traceId, { ...baseFields, ...sanitizeFields(fields) }),
  }
}

export function getLogger(functionName: string, traceId?: string | null): Logger {
  return createLogger(functionName, traceId ?? null)
}

export function getTraceId(req: Request): string {
  const header = req.headers.get('x-trace-id')
  if (header) return header
  return crypto.randomUUID()
}
