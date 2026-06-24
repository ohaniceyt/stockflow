import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, ShieldAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  listOrganizations,
  setOrganizationPlan,
  suspendOrganization,
} from '../services/platformService'
import type { BackOfficeOrganization, Paginated } from '../types'

const PLANS = ['free', 'starter', 'pro', 'enterprise']
const ORGS_QUERY_KEY = ['back-office', 'organizations']

export default function BackOfficeOrganizationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { platformAdminRole, enterSudo } = useAuth()
  const isSuperAdmin = platformAdminRole === 'super_admin'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'active' | 'suspended' | 'all'>('all')
  const [planId, setPlanId] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const filters = {
    search: search || undefined,
    status,
    planId: planId || undefined,
    limit,
    offset,
  }

  const { data, isLoading, error } = useQuery<Paginated<BackOfficeOrganization>>({
    queryKey: [...ORGS_QUERY_KEY, filters],
    queryFn: () => listOrganizations(filters),
  })

  const suspendMutation = useMutation({
    mutationFn: async (org: BackOfficeOrganization) => {
      await suspendOrganization(
        org.id,
        !org.is_suspended,
        org.is_suspended ? undefined : 'Manual suspension'
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY }),
  })

  const planMutation = useMutation({
    mutationFn: ({ orgId, plan }: { orgId: string; plan: string }) =>
      setOrganizationPlan(orgId, plan),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGS_QUERY_KEY }),
  })

  const handleSudo = async (org: BackOfficeOrganization) => {
    await enterSudo({ type: 'organization', id: org.id, name: org.name })
    void navigate('/dashboard')
  }

  const organizations = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Organisations</h1>
          <p className="text-muted-foreground">Gérer et surveiller les organisations.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Rechercher par nom"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
        />
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as 'active' | 'suspended' | 'all')
            setOffset(0)
          }}
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="suspended">Suspendu</option>
        </Select>
        <Select
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">Tous les plans</option>
          {PLANS.map((plan) => (
            <option key={plan} value={plan}>
              {plan}
            </option>
          ))}
        </Select>
      </div>

      {(error ?? planMutation.error ?? suspendMutation.error) && (
        <p className="text-destructive">
          {(error ?? planMutation.error ?? suspendMutation.error)?.message}
        </p>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Utilisateurs</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => {
                  const subscription = Array.isArray(org.subscriptions)
                    ? org.subscriptions[0]
                    : org.subscriptions
                  return (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline"
                          onClick={() => navigate(`/back-office/organizations/${org.id}`)}
                        >
                          {org.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Select
                            value={subscription?.plan_id ?? 'free'}
                            onChange={(e) =>
                              planMutation.mutate({ orgId: org.id, plan: e.target.value })
                            }
                          >
                            {PLANS.map((plan) => (
                              <option key={plan} value={plan}>
                                {plan}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          (subscription?.plan_id ?? '—')
                        )}
                      </TableCell>
                      <TableCell>{org.users_count ?? 0}</TableCell>
                      <TableCell>
                        {org.is_suspended ? (
                          <Badge variant="destructive">Suspendue</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/back-office/organizations/${org.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isSuperAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleSudo(org)}
                              title="Entrer en sudo"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant={org.is_suspended ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => suspendMutation.mutate(org)}
                              disabled={suspendMutation.isPending}
                            >
                              {org.is_suspended ? 'Réactiver' : 'Suspendre'}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => setOffset((o) => Math.max(0, o - limit))}
            >
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground">
              {offset + 1} – {Math.min(offset + organizations.length, total)} sur {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + organizations.length >= total}
              onClick={() => setOffset((o) => o + limit)}
            >
              Suivant
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
