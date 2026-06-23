import { edgeFetch } from '@/services/edgeFunctions'
import type { UserRole } from '@/types'

export interface Invitation {
  id: string
  orgId: string
  email: string
  role: UserRole
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  organizationName: string
}

export interface UserOrg {
  id: string
  orgId: string
  role: UserRole
  organizationName: string
  isSuspended: boolean
}

export async function createInvitation(input: {
  email: string
  role: UserRole
}): Promise<{ invitation: Invitation }> {
  return edgeFetch<{ invitation: Invitation }>('create-invitation', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

interface RawInvitation {
  id: string
  org_id: string
  email: string
  role: UserRole
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  organizations: { name: string } | null
}

export async function fetchInvitations(): Promise<Invitation[]> {
  const data = await edgeFetch<{ invitations: RawInvitation[] }>('list-invitations')
  return data.invitations.map((invitation) => ({
    id: invitation.id,
    orgId: invitation.org_id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    createdAt: invitation.created_at,
    organizationName: invitation.organizations?.name ?? '',
  }))
}

export async function acceptInvitation(invitationId: string): Promise<{ tempPin: string }> {
  const data = await edgeFetch<{ tempPin: string }>('accept-invitation', {
    method: 'POST',
    body: JSON.stringify({ invitationId }),
  })
  return data
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await edgeFetch('decline-invitation', {
    method: 'POST',
    body: JSON.stringify({ invitationId }),
  })
}

interface RawUserOrg {
  id: string
  org_id: string
  role: UserRole
  organizations: { id: string; name: string; is_suspended: boolean }
}

export async function fetchMyOrganizations(): Promise<UserOrg[]> {
  const data = await edgeFetch<{ organizations: RawUserOrg[] }>('list-my-organizations')
  return data.organizations.map((u) => ({
    id: u.id,
    orgId: u.org_id,
    role: u.role,
    organizationName: u.organizations.name,
    isSuspended: u.organizations.is_suspended,
  }))
}
