import { Link } from 'react-router-dom'

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="mb-2 text-4xl font-bold">403</h1>
      <p className="mb-6 text-lg text-muted-foreground">
        Vous n'avez pas l'autorisation d'accéder à cette page.
      </p>
      <Link to="/" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90">
        Retour au tableau de bord
      </Link>
    </div>
  )
}
