import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
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
import { listUsers } from '../services/platformService'
import type { BackOfficeUser, Paginated } from '../types'

const ROLES = ['super_admin', 'admin', 'operator', 'cashier', 'reader']
const USERS_QUERY_KEY = ['back-office', 'users']

export default function BackOfficeUsersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [isActive, setIsActive] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const filters = {
    search: search || undefined,
    role: role || undefined,
    isActive: isActive === '' ? undefined : isActive === 'true',
    limit,
    offset,
  }

  const { data, isLoading, error } = useQuery<Paginated<BackOfficeUser>>({
    queryKey: [...USERS_QUERY_KEY, filters],
    queryFn: () => listUsers(filters),
  })

  const users = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground">Rechercher et assister les utilisateurs.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Rechercher par nom ou email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
        />
        <Select
          value={role}
          onChange={(e) => {
            setRole(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">Tous les rôles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select
          value={isActive}
          onChange={(e) => {
            setIsActive(e.target.value)
            setOffset(0)
          }}
        >
          <option value="">Tous les statuts</option>
          <option value="true">Actif</option>
          <option value="false">Inactif</option>
        </Select>
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
                  <TableHead>Nom</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const membership = user.organization_memberships.at(0)
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <p className="font-medium">{user.name || user.email}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </TableCell>
                      <TableCell>{membership?.organizations?.name ?? '—'}</TableCell>
                      <TableCell>{membership?.role ?? '—'}</TableCell>
                      <TableCell>
                        {membership?.is_active ? (
                          <Badge variant="default">Actif</Badge>
                        ) : (
                          <Badge variant="secondary">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/back-office/users/${user.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
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
              {offset + 1} – {Math.min(offset + users.length, total)} sur {total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={offset + users.length >= total}
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
