import { useState, useEffect, useMemo, type SyntheticEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/context/AuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, isAuthenticated, isLoading, session } = useAuth()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    if (session?.needsOrganization) {
      void navigate('/onboarding', { replace: true })
      return
    }
    void navigate('/dashboard', { replace: true })
  }, [isAuthenticated, session?.needsOrganization, navigate])

  const banner = useMemo(() => {
    if (searchParams.get('verified')) {
      return 'Votre email est vérifié. Connectez-vous pour continuer.'
    }
    if (searchParams.get('passwordReset')) {
      return 'Votre mot de passe a été réinitialisé. Connectez-vous pour continuer.'
    }
    return null
  }, [searchParams])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      await signIn(email.trim().toLowerCase(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            S
          </div>
          <h1 className="text-2xl font-bold">StockFlow</h1>
          <p className="text-sm text-muted-foreground">Connectez-vous à votre compte</p>
        </div>

        {banner && (
          <div className="mb-4 rounded-xl bg-primary/10 p-4 text-sm text-primary">{banner}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex justify-end">
            <Link
              to="/auth/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Mot de passe oublié ?
            </Link>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </Button>

          <div className="flex items-center justify-center gap-2 text-sm">
            <Link to="/auth/back-office" className="text-muted-foreground hover:text-foreground">
              Accès Back Office
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/signup" className="text-primary hover:underline">
              Créer un compte
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
