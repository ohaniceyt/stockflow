import { supabaseKey } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

function getAccessToken(): string | null {
  const raw = localStorage.getItem('stockflow-session')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { accessToken?: string }
    return parsed.accessToken ?? null
  } catch {
    return null
  }
}

export async function edgeFetch<T = unknown>(
  functionName: string,
  options?: RequestInit
): Promise<T> {
  const token = getAccessToken()

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

  const data = (await res.json().catch(() => ({}))) as T & { error?: { message: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Request failed: ${String(res.status)}`)
  }
  return data
}
