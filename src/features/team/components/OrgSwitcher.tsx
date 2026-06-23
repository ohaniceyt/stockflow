import { Building2, Check } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { UserOrg } from '../services/invitationService'

interface OrgSwitcherProps {
  organizations: UserOrg[]
  onSwitch: (orgId: string) => void
}

export function OrgSwitcher({ organizations, onSwitch }: OrgSwitcherProps) {
  const { session } = useAuth()
  const currentOrgId = session?.user.orgId

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Mes organisations
      </p>
      <div className="space-y-1">
        {organizations.map((org) => (
          <button
            key={org.orgId}
            type="button"
            disabled={org.orgId === currentOrgId || org.isSuspended}
            onClick={() => onSwitch(org.orgId)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              org.orgId === currentOrgId
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            } ${org.isSuspended ? 'opacity-50' : ''}`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {org.organizationName}
            </span>
            {org.orgId === currentOrgId && <Check className="h-4 w-4" />}
          </button>
        ))}
      </div>
    </div>
  )
}
