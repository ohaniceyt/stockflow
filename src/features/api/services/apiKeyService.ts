import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { Database } from '@/types/database'

export interface ApiKey {
  id: string
  orgId: string
  name: string
  scopes: string[]
  allowedLocationIds: string[] | null
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

export interface CreateApiKeyInput {
  name: string
  scopes: string[]
  allowedLocationIds?: string[] | null
}

export interface CreateApiKeyResult {
  key: string
  apiKey: ApiKey
}

export async function listApiKeys(orgId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from('organization_api_keys')
    .select('id, org_id, name, scopes, allowed_location_ids, last_used_at, created_at, revoked_at')
    .eq('org_id', orgId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const rows = data as {
    id: string
    org_id: string
    name: string
    scopes: string[]
    allowed_location_ids: string[] | null
    last_used_at: string | null
    created_at: string
    revoked_at: string | null
  }[]
  return rows.map((row) => ({
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    scopes: row.scopes,
    allowedLocationIds: row.allowed_location_ids,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
  }))
}

export async function createApiKey(
  orgId: string,
  input: CreateApiKeyInput
): Promise<CreateApiKeyResult> {
  const result = (await edgeFetch('create-api-key', {
    method: 'POST',
    body: JSON.stringify({
      org_id: orgId,
      name: input.name,
      scopes: input.scopes,
      allowed_location_ids: input.allowedLocationIds ?? null,
    }),
  })) as { key: string; api_key: ApiKey }

  return {
    key: result.key,
    apiKey: result.api_key,
  }
}

export async function revokeApiKey(keyId: string): Promise<void> {
  const updateData: Database['public']['Tables']['organization_api_keys']['Update'] = {
    revoked_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('organization_api_keys')
    .update(updateData)
    .eq('id', keyId)

  if (error) throw new Error(error.message)
}
