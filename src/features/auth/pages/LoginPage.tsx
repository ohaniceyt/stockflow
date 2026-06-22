import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PinPad } from '../components/PinPad'
import type { User } from '@/types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

async function fetchActiveUsers(): Promise<User[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/list-users`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    throw new Error('Could not load users')
  }

  const data = (await res.json()) as {
    users?: {
      id: string
      name: string
      email: string
      email_verified: boolean
      role: string
      org_id: string
      is_active: boolean
      last_login_at?: string | null
      created_at?: string
      updated_at?: string
    }[]
  }

  return (data.users ?? []).map((u) => ({
    id: u.id,
    orgId: u.org_id,
    name: u.name,
    email: u.email,
    emailVerified: u.email_verified,
    role: u.role as User['role'],
    isActive: u.is_active,
    lastLoginAt: u.last_login_at ?? null,
    createdAt: u.created_at ?? new Date().toISOString(),
    updatedAt: u.updated_at ?? new Date().toISOString(),
  }))
}

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const { login, isAuthenticated, isLoading, verifyMagicLinkSession } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    let cancelled = false
    void fetchActiveUsers()
      .then((data) => {
        if (!cancelled) setUsers(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setUsersError(err instanceof Error ? err.message : 'Erreur de chargement')
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePinSubmit = async (pin: string) => {
    if (!selectedUser) return
    setError(null)
    try {
      const result = await login(selectedUser.id, pin)
      setPendingEmail(result.email)
      setMagicLinkSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN incorrect')
    }
  }

  const handleVerify = async () => {
    setError(null)
    try {
      await verifyMagicLinkSession()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Session invalide')
    }
  }

  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@')
    if (!local || !domain) return email
    const maskedLocal = local.length > 2 ? `${local.slice(0, 2)}***` : '***'
    return `${maskedLocal}@${domain}`
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            S
          </div>
          <h1 className="text-2xl font-bold">StockFlow vNext</h1>
          <p className="text-sm text-muted-foreground">
            Sélectionnez votre profil puis saisissez votre PIN
          </p>
        </div>

        {magicLinkSent ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-primary/10 p-6">
              <h3 className="mb-2 text-lg font-semibold text-primary">Vérifiez votre email</h3>
              <p className="text-sm text-muted-foreground">
                Un lien de connexion sécurisé a été envoyé à{' '}
                <span className="font-medium text-foreground">
                  {pendingEmail ? maskEmail(pendingEmail) : 'votre adresse'}
                </span>
                .
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Cliquez sur le lien dans l'email, puis revenez ici et cliquez sur "Continuer".
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setMagicLinkSent(false)
                setPendingEmail(null)
                setSelectedUser(null)
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Changer de profil
            </button>
            <button
              type="button"
              onClick={handleVerify}
              disabled={isLoading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? 'Vérification…' : 'Continuer'}
            </button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : !selectedUser ? (
          <div className="space-y-3">
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
              Qui êtes-vous ?
            </p>
            {usersLoading ? (
              <p className="text-center text-sm text-muted-foreground">Chargement des profils…</p>
            ) : usersError ? (
              <p className="text-center text-sm text-destructive">{usersError}</p>
            ) : users.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">Aucun utilisateur actif</p>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-xs capitalize text-muted-foreground">{user.role}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setSelectedUser(null)
                setError(null)
              }}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Changer de profil
            </button>
            <PinPad
              title={`Bonjour, ${selectedUser.name.split(' ')[0]}`}
              onSubmit={handlePinSubmit}
              onCancel={() => setSelectedUser(null)}
              error={error}
              disabled={isLoading}
            />
          </div>
        )}
      </div>
    </div>
  )
}
