import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listAuditLogs } from '../services/platformService'
import type { Paginated, PlatformAuditLogRow } from '../types'

const ACTIONS = [
  'sudo_enter',
  'sudo_exit',
  'user_pin_reset',
  'user_password_reset_sent',
  'user_status_changed',
  'org_suspended',
  'org_reactivated',
  'org_plan_changed',
]
const TARGET_TYPES = ['organization', 'membership', 'user']
const AUDIT_QUERY_KEY = ['back-office', 'audit-logs']

export default function BackOfficeAuditLogsPage() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [targetId, setTargetId] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 50

  const filters = {
    action: action || undefined,
    targetType: targetType || undefined,
    targetId: targetId || undefined,
    limit,
    offset,
  }

  const { data, isLoading, error } = useQuery<Paginated<PlatformAuditLogRow>>({
    queryKey: [...AUDIT_QUERY_KEY, filters],
    queryFn: () => listAuditLogs(filters),
  })

  const logs = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Journal d'audit</h1>
        <p className="text-muted-foreground">Historique des actions des admins plateforme.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
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
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
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
        </select>
        <Input
          placeholder="ID cible"
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value)
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
                  <TableHead>Métadonnées</TableHead>
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
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.actorRole ?? '—'}</Badge>
                      <p className="mt-1 max-w-[120px] truncate text-sm text-muted-foreground">
                        {log.actorId ?? '—'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.targetType ?? '—'}:{log.targetId ?? '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
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
    </div>
  )
}
