import { useEffect, useState, type SyntheticEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  acceptInvitationByToken,
  validateInvitationToken,
} from '@/features/team/services/invitationService'
import { USER_ROLE_LABELS } from '../constants'
import type { UserRole } from '@/types'

interface InvitationDetails {
  orgName: string
  email: string
  role: UserRole
  name?: string
}

export default function InvitePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const { session, signIn, switchMembership, signOut } = useAuth()
  const [isLoading, setIsLoading] = useState(!!token)
  const [isAccepting, setIsAccepting] = useState(false)
  const [error, setError] = useState<string | null>(
    token ? null : 'Lien d’invitation invalide ou manquant.'
  )
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (!token) return

    validateInvitationToken(token)
      .then((data) => {
        setInvitation(data)
        if (data.name) setName(data.name)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Invitation invalide ou expirée.')
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const handleAuthenticatedAccept = async () => {
    if (!token || !invitation) return
    setIsAccepting(true)
    setError(null)
    try {
      const { membershipId } = await acceptInvitationByToken({ token })
      try {
        await switchMembership(membershipId)
        void navigate('/dashboard', { replace: true })
      } catch (switchErr) {
        setError(
          switchErr instanceof Error
            ? switchErr.message
            : 'Échec du basculement vers la nouvelle organisation'
        )
        setIsAccepting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’acceptation')
      setIsAccepting(false)
    }
  }

  const handleNewUserSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!token || !invitation) return
    setError(null)

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setIsAccepting(true)
    try {
      await acceptInvitationByToken({ token, name: name.trim(), password })
      await signIn(invitation.email, password)
      void navigate('/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de l’acceptation'
      if (message.toLowerCase().includes('already exists')) {
        setError(
          'Un compte existe déjà pour cet email. Veuillez vous connecter pour accepter l’invitation.'
        )
      } else {
        setError(message)
      }
    } finally {
      setIsAccepting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Chargement de l’invitation…</p>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl text-center space-y-4">
          <h1 className="text-2xl font-bold">Invitation invalide</h1>
          <p className="text-sm text-destructive">{error}</p>
          <Button asChild className="w-full">
            <Link to="/login">Se connecter</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!invitation) return null

  const normalizedInviteEmail = invitation.email.toLowerCase()
  const currentEmail = session?.user.email.toLowerCase()
  const emailMatches = !!currentEmail && currentEmail === normalizedInviteEmail

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Invitation à rejoindre Flowbill</h1>
          <p className="text-sm text-muted-foreground">
            Vous avez été invité(e) à rejoindre{' '}
            <span className="font-medium text-foreground">{invitation.orgName}</span> en tant que{' '}
            <span className="font-medium text-foreground">{USER_ROLE_LABELS[invitation.role]}</span>
            .
          </p>
        </div>

        {session ? (
          emailMatches ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Vous êtes connecté(e) en tant que{' '}
                <span className="font-medium text-foreground">{session.user.email}</span>.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="button"
                className="w-full"
                onClick={handleAuthenticatedAccept}
                disabled={isAccepting}
              >
                {isAccepting ? 'Acceptation…' : 'Rejoindre l’organisation'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Cette invitation a été envoyée à{' '}
                <span className="font-medium text-foreground">{invitation.email}</span>, mais vous
                êtes connecté(e) en tant que{' '}
                <span className="font-medium text-foreground">{session.user.email}</span>.
              </p>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  void signOut()
                  void navigate(`/login?email=${encodeURIComponent(invitation.email)}`)
                }}
              >
                Se déconnecter et utiliser le bon compte
              </Button>
            </div>
          )
        ) : (
          <form onSubmit={handleNewUserSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email de l’invitation</Label>
              <Input id="email" type="email" value={invitation.email} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Votre nom complet</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Alice Kone"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Choisissez un mot de passe (min. 8 caractères)</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
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
                minLength={8}
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isAccepting}>
              {isAccepting ? 'Création…' : 'Créer mon compte et rejoindre'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link
                to={`/login?email=${encodeURIComponent(invitation.email)}`}
                className="text-primary hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
