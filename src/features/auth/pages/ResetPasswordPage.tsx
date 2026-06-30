import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/services/supabase'
import { StatusBadge } from '@/components/design-system'

const TOKEN_TIMEOUT_MS = 10_000

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    })

    // Fallback: if the hash was already processed before the listener attached.
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setReady(true)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    })()

    timeoutRef.current = setTimeout(() => {
      setReady(true)
      setError('Le lien de réinitialisation est invalide ou a expiré.')
    }, TOKEN_TIMEOUT_MS)

    return () => {
      subscription.unsubscribe()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setIsLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw new Error(updateError.message)
      }
      await supabase.auth.signOut()
      void navigate('/login?passwordReset=1', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la réinitialisation')
    } finally {
      setIsLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl text-center">
          <StatusBadge variant="info">Vérification du lien de réinitialisation…</StatusBadge>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Nouveau mot de passe</h1>
          <p className="text-sm text-muted-foreground">
            Choisissez un mot de passe fort pour sécuriser votre compte.
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <StatusBadge variant="danger">{error}</StatusBadge>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmez le mot de passe</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </Button>
        </form>
      </div>
    </div>
  )
}
