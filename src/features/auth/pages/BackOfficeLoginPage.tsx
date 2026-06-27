import { useState, useEffect, type SyntheticEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'

export default function BackOfficeLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signIn, isAuthenticated, isLoading, isPlatformAdmin, signOut } = useAuth()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && isPlatformAdmin) {
      void navigate('/back-office', { replace: true })
    }
  }, [isAuthenticated, isPlatformAdmin, navigate])

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    try {
      const next = await signIn(email.trim().toLowerCase(), password)
      if (!next.isPlatformAdmin) {
        await signOut()
        setError('Ce compte ne dispose pas des droits Back Office.')
        return
      }
      void navigate('/back-office', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de la connexion')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">Back Office Flowbill</h1>
          <p className="text-sm text-muted-foreground">
            Accès réservé aux administrateurs plateforme
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@exemple.com"
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Connexion…' : 'Accéder au Back Office'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            <Link to="/login" className="text-primary hover:underline">
              Connexion utilisateur standard
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
