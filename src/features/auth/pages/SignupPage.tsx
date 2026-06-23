import { useState, type SyntheticEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { supabaseKey } from '@/services/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface SignupPayload {
  orgName: string
  name: string
  email: string
  planId: 'free' | 'starter' | 'pro'
}

async function signup(payload: SignupPayload): Promise<{ tempPin: string; emailSent: boolean }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = (await res.json()) as {
    success?: boolean
    tempPin?: string
    emailSent?: boolean
    error?: { message: string }
    message?: string
  }

  if (!res.ok || !data.success || !data.tempPin) {
    throw new Error(data.error?.message ?? data.message ?? 'Signup failed')
  }

  return { tempPin: data.tempPin, emailSent: data.emailSent ?? false }
}

export default function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<SignupPayload>({
    orgName: '',
    name: '',
    email: '',
    planId: 'free',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ tempPin: string; emailSent: boolean } | null>(null)

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const data = await signup(form)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’inscription')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-3xl font-bold text-primary-foreground">
            S
          </div>
          <h1 className="text-2xl font-bold">Créer votre compte StockFlow</h1>
          <p className="text-sm text-muted-foreground">
            Commencez gratuitement, sans carte bancaire.
          </p>
        </div>

        {result ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl bg-green-50 p-6">
              <p className="text-sm text-green-700">Votre compte a été créé avec succès.</p>
              <p className="mt-2 text-xs text-muted-foreground">PIN temporaire :</p>
              <p className="text-2xl font-bold tracking-widest text-green-700">{result.tempPin}</p>
              {!result.emailSent && (
                <p className="mt-2 text-xs text-destructive">
                  L’email n’a pas pu être envoyé, notez ce PIN.
                </p>
              )}
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate('/login', { replace: true })}
            >
              Se connecter
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Nom de l’organisation</Label>
              <Input
                id="org-name"
                value={form.orgName}
                onChange={(e) => setForm((prev) => ({ ...prev, orgName: e.target.value }))}
                placeholder="Ex: Ma Boutique"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Votre nom</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Alice"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="vous@exemple.com"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plan</Label>
              <Select
                id="plan"
                value={form.planId}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    planId: e.target.value as SignupPayload['planId'],
                  }))
                }
              >
                <option value="free">Gratuit — 2 utilisateurs, 50 produits</option>
                <option value="starter">Starter — 5 utilisateurs, 500 produits</option>
                <option value="pro">Pro — 20 utilisateurs, 5000 produits</option>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Création…' : 'Créer mon compte'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Déjà un compte ?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
