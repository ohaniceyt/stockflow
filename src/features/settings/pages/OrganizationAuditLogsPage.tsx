import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { PageHeader, PageSection } from '@/components/design-system'
import { listOrgAuditLogs } from '../services/orgAuditService'
import type { ActivityLogRow } from '@/features/back-office/types'

const ACTIONS = [
  'movements_insert',
  'movements_update',
  'products_insert',
  'products_update',
  'products_delete',
  'contacts_insert',
  'contacts_update',
  'contacts_delete',
  'locations_insert',
  'locations_update',
  'locations_delete',
  'categories_insert',
  'categories_update',
  'categories_delete',
  'organization_memberships_insert',
  'organization_memberships_update',
  'organization_memberships_delete',
  'organizations_update',
  'inventory_sessions_insert',
  'inventory_sessions_update',
]

const TARGET_TYPES = [
  'movements',
  'products',
  'contacts',
  'locations',
  'categories',
  'organization_memberships',
  'organizations',
  'inventory_sessions',
]

const AUDIT_QUERY_KEY = ['settings', 'org-audit-logs']

export default function OrganizationAuditLogsPage() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const filters = {
    action: action || undefined,
    targetType: targetType || undefined,
    targetId: targetId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    limit,
    offset,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: [...AUDIT_QUERY_KEY, filters],
    queryFn: () => listOrgAuditLogs(filters),
  })

  const logs = data?.logs ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal d’audit"
        description="Historique des actions effectuées dans cette organisation."
      />

      <PageSection>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">Toutes les actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
          <Select
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value)
              setOffset(0)
            }}
          >
            <option value="">Tous les types cibles</option>
            {TARGET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            placeholder="ID cible"
            value={targetId}
            onChange={(e) => {
              setTargetId(e.target.value)
              setOffset(0)
            }}
          />
          <Input
            type="date"
            placeholder="Du"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value)
              setOffset(0)
            }}
          />
          <Input
            type="date"
            placeholder="Au"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value)
              setOffset(0)
            }}
          />
        </div>

        {error && <p className="text-destructive">{error.message}</p>}

        {isLoading ? (
          <p className="text-muted-foreground">Chargement…</p>
        ) : (
          <>
            <div className="rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Horodatage</TableHead>
                    <TableHead>Acteur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Cible</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucune entrée.
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((log: ActivityLogRow) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[160px] truncate text-sm text-muted-foreground">
                          {log.actor_id ?? '—'}
                        </p>
                      </TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        {log.target_type ?? '—'}:{log.target_id ?? '—'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {log.details ? JSON.stringify(log.details) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
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
                {offset + 1} – {Math.min(offset + logs.length, total)} sur {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + logs.length >= total}
                onClick={() => setOffset((o) => o + limit)}
              >
                Suivant
              </Button>
            </div>
          </>
        )}
      </PageSection>
    </div>
  )
}
