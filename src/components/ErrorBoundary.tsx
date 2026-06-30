import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '@/lib/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    void captureException(error).catch(() => {
      // Sentry is best-effort; ignore reporting failures.
    })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md rounded-2xl border bg-card p-8 shadow-lg">
            <h1 className="text-2xl font-bold">Une erreur est survenue</h1>
            <p className="mt-3 text-muted-foreground">
              L&apos;application a rencontré un problème inattendu. Vous pouvez réessayer ou
              contacter le support si le problème persiste.
            </p>
            {this.state.error ? (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-muted p-3 text-left text-xs">
                {this.state.error.message}
              </pre>
            ) : null}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Recharger l&apos;application
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
