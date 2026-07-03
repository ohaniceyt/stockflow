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
      fields: { ...baseFields, ...fields },
    }

    if (err instanceof Error) {
      entry.error = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      }
    } else if (err !== undefined && err !== null) {
      entry.error = {
        message: String(err),
      }
    }

    writeLog(entry)
  }

  return {
    debug: (event, fields) => log('debug', event, fields),
    info: (event, fields) => log('info', event, fields),
    warn: (event, fields) => log('warn', event, fields),
    error: (event, fields, err) => log('error', event, fields, err),
    child: (fields) => createLogger(functionName, traceId, { ...baseFields, ...fields }),
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
