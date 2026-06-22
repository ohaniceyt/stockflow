import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PinPad } from '../components/PinPad'
import type { User } from '@/types'

// TODO: replace with actual user list query
const MOCK_USERS: User[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    orgId: '00000000-0000-0000-0000-000000000000',
    name: 'Alice Admin',
    role: 'admin',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    orgId: '00000000-0000-0000-0000-000000000000',
    name: 'Bob Opérateur',
    role: 'operator',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export default function LoginPage() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { login, isAuthenticated, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handlePinSubmit = async (pin: string) => {
    if (!selectedUser) return
    setError(null)
    try {
      await login(selectedUser.id, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN incorrect')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            S
          </div>
          <h1 className="text-2xl font-bold">StockFlow vNext</h1>
          <p className="text-sm text-muted-foreground">Sélectionnez votre profil puis saisissez votre PIN</p>
        </div>

        {!selectedUser ? (
          <div className="space-y-3">
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">Qui êtes-vous ?</p>
            {MOCK_USERS.map((user) => (
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
            ))}
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
