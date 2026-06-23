import { supabaseKey } from '@/services/supabase'
import type { OrgLimits } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function authedFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem('stockflow-session')
    ? (JSON.parse(localStorage.getItem('stockflow-session') ?? '{}') as { accessToken?: string })
        .accessToken
    : null

  const baseHeaders: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${token ?? supabaseKey}`,
    'Content-Type': 'application/json',
  }
  const extraHeaders = options?.headers as Record<string, string> | undefined
  const headers = extraHeaders ? { ...baseHeaders, ...extraHeaders } : baseHeaders

  const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
    ...options,
    headers,
  })

  const data = (await res.json()) as { error?: { message: string } }
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Request failed: ${String(res.status)}`)
  }
  return data
}

export async function getOrgLimits(): Promise<OrgLimits> {
  const data = (await authedFetch('/org-limits')) as { limits?: OrgLimits }
  if (!data.limits) {
    throw new Error('Limits not returned')
  }
  return data.limits
}
