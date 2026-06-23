import { edgeFetch } from '@/services/edgeFunctions'
import type { OrgLimits } from '@/types'

export async function getOrgLimits(): Promise<OrgLimits> {
  return await edgeFetch<OrgLimits>('org-limits')
}
