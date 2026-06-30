import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/services/supabase'
import { EmptyState } from '@/components/design-system'

export default function AuthVerificationPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Vérification de votre email en cours…')

  useEffect(() => {
    let processed = false

    const finalize = async (sessionExists: boolean) => {
      if (processed) return
      processed = true

      if (sessionExists) {
        // Sign the user out so they re-enter their password on the login page.
        await supabase.auth.signOut()
        setStatus('success')
        setMessage('Votre email est vérifié. Vous pouvez maintenant vous connecter.')
        setTimeout(() => {
          void navigate('/login?verified=1', { replace: true })
        }, 1500)
      } else {
        setStatus('error')
        setMessage('Le lien de vérification est invalide ou a expiré. Veuillez réessayer.')
      }
    }

    // Supabase client automatically processes the hash token and creates a session.
    // We listen for SIGNED_IN, then sign out and redirect to /login.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (event === 'SIGNED_IN' && authSession) {
        await finalize(true)
      }
    })

    // Fallback: if the event already fired before the listener was attached.
    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        await finalize(true)
      }
      // Give the listener a short window to fire for invalid links.
      setTimeout(() => {
        if (!processed) void finalize(false)
      }, 2500)
    })()

    return () => {
      subscription.unsubscribe()
    }
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        {status === 'loading' && (
          <EmptyState
            icon={Loader2}
            title="Vérification en cours"
            description={message}
            className="border-0 bg-transparent shadow-none"
          />
        )}
        {status === 'success' && (
          <EmptyState
            icon={CheckCircle2}
            title="Email vérifié"
            description={message}
            className="border-0 bg-transparent shadow-none"
          />
        )}
        {status === 'error' && (
          <div className="text-center">
            <EmptyState
              icon={XCircle}
              title="Échec de la vérification"
              description={message}
              className="border-0 bg-transparent shadow-none"
              action={
                <Button asChild className="w-full">
                  <a href="/login">Retour à la connexion</a>
                </Button>
              }
            />
          </div>
        )}
      </div>
    </div>
  )
}
