import { Play, X } from 'lucide-react'

export default function HeroDemoDialog() {
  return (
    <dialog
      id="demo-dialog"
      className="m-auto max-w-3xl rounded-2xl border bg-card p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between px-6 pt-6">
        <h3 className="text-lg font-semibold">Découvrez StockFlow en 2 minutes</h3>
        <button
          id="demo-close"
          type="button"
          className="rounded-full p-1 hover:bg-accent"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="aspect-video bg-muted">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
          <Play className="h-12 w-12" />
          <p className="text-base">Vidéo de démo à intégrer (YouTube, Loom ou Vimeo)</p>
          <p className="text-base">Remplacez ce bloc par une balise &lt;iframe&gt;.</p>
        </div>
      </div>
    </dialog>
  )
}
