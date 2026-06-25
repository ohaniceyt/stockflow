import { useState, type SyntheticEvent } from 'react'
import { UserCircle, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useCurrentUserProfile, useUpdateCurrentUserProfile } from '../hooks/useSettings'
import { SettingsTabs } from '../components/SettingsTabs'

export default function ProfilePage() {
  const { session, signOut } = useAuth()
  const { isLoading, error } = useCurrentUserProfile()
  const update = useUpdateCurrentUserProfile()

  const [name, setName] = useState(session?.user.name ?? '')
  const [phone, setPhone] = useState(session?.user.phone ?? '')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Le nom est requis.')
      return
    }
    update.mutate(
      { name: name.trim(), phone: phone.trim() || null },
      {
        onError: (err) => setFormError(err.message),
      }
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-muted-foreground">Gérez votre profil et vos préférences.</p>
      </div>

      <SettingsTabs />

      {error && <p className="text-destructive">{error.message}</p>}
      {formError && <p className="text-destructive">{formError}</p>}
      {update.isSuccess && <p className="text-sm text-green-600">Profil mis à jour.</p>}

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Informations personnelles</h2>
            <p className="text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Votre nom"
              disabled={isLoading || update.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+225 ..."
              disabled={isLoading || update.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={session?.user.email ?? ''} disabled />
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button type="submit" disabled={isLoading || update.isPending}>
              {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href="/change-pin">
                <KeyRound className="mr-2 h-4 w-4" />
                Changer mon PIN
              </a>
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6">
        <h2 className="font-semibold text-destructive">Zone dangereuse</h2>
        <p className="text-sm text-muted-foreground">
          Déconnectez-vous de StockFlow sur cet appareil.
        </p>
        <Button type="button" variant="destructive" className="mt-4" onClick={() => void signOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}
