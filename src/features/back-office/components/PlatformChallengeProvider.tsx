import * as React from 'react'
import { createPlatformChallenge } from '../services/platformService'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PlatformChallengeContext } from '../context/platformChallengeContext'

interface ChallengeRequest {
  title: string
  resolve: (challengeId: string) => void
  reject: (err: Error) => void
}

export function PlatformChallengeProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = React.useState<ChallengeRequest | null>(null)
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (request) {
      passwordRef.current?.focus()
    }
  }, [request])

  const requestChallenge = React.useCallback((title = 'Confirmation requise') => {
    return new Promise<string>((resolve, reject) => {
      setPassword('')
      setError(null)
      setPending(false)
      setRequest({ title, resolve, reject })
    })
  }, [])

  const close = React.useCallback(() => {
    if (request) {
      request.reject(new Error('Confirmation annulée'))
    }
    setRequest(null)
    setPassword('')
    setError(null)
    setPending(false)
  }, [request])

  const submit = React.useCallback(async () => {
    if (!request || !password) return
    setPending(true)
    setError(null)
    try {
      const challengeId = await createPlatformChallenge(password)
      request.resolve(challengeId)
      setRequest(null)
      setPassword('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Échec de la confirmation'
      setError(message)
    } finally {
      setPending(false)
    }
  }, [request, password])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void submit()
      }
    },
    [submit]
  )

  return (
    <PlatformChallengeContext.Provider value={{ requestChallenge }}>
      {children}
      <Dialog open={!!request} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{request?.title ?? 'Confirmation requise'}</DialogTitle>
            <DialogDescription>
              Saisissez votre mot de passe plateforme pour valider cette action sensible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="platform-challenge-password">Mot de passe</Label>
              <Input
                id="platform-challenge-password"
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={pending}
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={close} disabled={pending}>
              Annuler
            </Button>
            <Button type="button" onClick={() => void submit()} disabled={pending || !password}>
              {pending ? 'Vérification…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformChallengeContext.Provider>
  )
}
