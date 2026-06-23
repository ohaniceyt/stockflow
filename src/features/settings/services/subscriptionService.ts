import { edgeFetch } from '@/services/edgeFunctions'
import type { OrgLimits } from '@/types'

export async function getOrgLimits(): Promise<OrgLimits> {
  return await edgeFetch<OrgLimits>('org-limits')
}

export async function changeOrganizationPlan(planId: string): Promise<void> {
  await edgeFetch('change-org-plan', {
    method: 'POST',
    body: JSON.stringify({ planId }),
  })
}
