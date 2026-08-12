import { supabase, supabaseKey } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export class EdgeFunctionError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown, message: string) {
    super(message)
    this.status = status
    this.data = data
    this.name = 'EdgeFunctionError'
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export async function edgeFetch<T = unknown>(
  functionName: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAccessToken()

  const baseHeaders: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${token ?? supabaseKey}`,
    'Content-Type': 'application/json',
  }
  const extraHeaders = options?.headers as Record<string, string> | undefined
  const headers = extraHeaders ? { ...baseHeaders, ...extraHeaders } : baseHeaders

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    ...options,
    headers,
  })

  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message: string } | string
  }
  if (!res.ok) {
    const rawError = data.error
    const errorMessage =
      typeof rawError === 'string'
        ? rawError
        : (rawError?.message ?? `Request failed: ${String(res.status)}`)
    throw new EdgeFunctionError(res.status, data, errorMessage)
  }
  return data
}
