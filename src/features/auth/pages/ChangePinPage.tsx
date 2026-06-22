import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { PinPad } from '../components/PinPad'

export default function ChangePinPage() {
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { changePin, session } = useAuth()
  const navigate = useNavigate()

  const title = {
    current: 'Saisissez votre PIN temporaire',
    new: 'Choisissez votre nouveau PIN',
    confirm: 'Confirmez votre nouveau PIN',
  }[step]

  const handleSubmit = async (pin: string) => {
    setError(null)

    if (step === 'current') {
      setCurrentPin(pin)
      setStep('new')
      return
    }

    if (step === 'new') {
      if (session?.forcePinChange && pin === currentPin) {
        setError('Le nouveau PIN doit être différent du PIN temporaire')
        return
      }
      setNewPin(pin)
      setStep('confirm')
      return
    }

    if (step === 'confirm') {
      if (pin !== newPin) {
        setError('Les PIN ne correspondent pas')
        return
      }
      try {
        await changePin(currentPin, pin)
        navigate('/', { replace: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Échec du changement')
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold">Changement de PIN obligatoire</h1>
          <p className="text-sm text-muted-foreground">
            Votre compte utilise un PIN temporaire. Définissez-en un définitif pour continuer.
          </p>
        </div>

        <PinPad title={title} onSubmit={handleSubmit} error={error} />
      </div>
    </div>
  )
}
