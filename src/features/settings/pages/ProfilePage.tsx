import { useState, type SyntheticEvent } from 'react'
import { KeyRound, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/use-theme'
import type { Theme } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useCurrentUserProfile, useUpdateCurrentUserProfile } from '../hooks/useSettings'
import { SettingsTabs } from '../components/SettingsTabs'
import { PageHeader, PageSection, StatusBadge } from '@/components/design-system'

export default function ProfilePage() {
  const { session, signOut } = useAuth()
  const { isLoading, error } = useCurrentUserProfile()
  const update = useUpdateCurrentUserProfile()
  const { theme, setTheme } = useTheme()

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
      <PageHeader title="Paramètres" description="Gérez votre profil et vos préférences." />

      <SettingsTabs />

      {error && <p className="text-destructive">{error.message}</p>}
      {formError && <p className="text-destructive">{formError}</p>}
      {update.isSuccess && <StatusBadge variant="success">Profil mis à jour.</StatusBadge>}

      <PageSection title="Informations personnelles" description={session?.user.email}>
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
      </PageSection>

      <PageSection title="Apparence" description="Choisissez le thème de l'interface.">
        <div className="flex flex-wrap gap-2">
          {[
            { mode: 'light' as Theme, label: 'Clair', icon: Sun },
            { mode: 'dark' as Theme, label: 'Sombre', icon: Moon },
            { mode: 'system' as Theme, label: 'Système', icon: Monitor },
          ].map(({ mode, label, icon: Icon }) => (
            <Button
              key={mode}
              type="button"
              variant={theme === mode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme(mode)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </PageSection>

      <PageSection
        title="Session"
        description="Déconnectez-vous de StockFlow sur cet appareil."
        contentClassName="border-destructive/20 bg-destructive/5"
      >
        <Button type="button" variant="destructive" onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </Button>
      </PageSection>
    </div>
  )
}
