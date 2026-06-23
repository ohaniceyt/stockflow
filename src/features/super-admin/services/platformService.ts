import { supabaseKey } from '@/services/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

async function platformFetch(path: string, options?: RequestInit) {
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

export async function listOrganizations(): Promise<unknown[]> {
  const data = (await platformFetch('/platform-list-organizations')) as {
    organizations?: unknown[]
  }
  return data.organizations ?? []
}

export async function suspendOrganization(
  orgId: string,
  isSuspended: boolean,
  reason?: string
): Promise<void> {
  await platformFetch('/platform-suspend-organization', {
    method: 'POST',
    body: JSON.stringify({ orgId, isSuspended, reason }),
  })
}

export async function setOrganizationPlan(orgId: string, planId: string): Promise<void> {
  await platformFetch('/platform-set-organization-plan', {
    method: 'POST',
    body: JSON.stringify({ orgId, planId }),
  })
}
