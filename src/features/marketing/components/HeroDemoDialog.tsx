import { useEffect, useRef } from 'react'
import { Play, X } from 'lucide-react'

interface HeroDemoDialogProps {
  open: boolean
  onClose: () => void
}

export default function HeroDemoDialog({ open, onClose }: HeroDemoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    const handleCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [open, onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="demo-title"
      className="m-auto max-w-3xl rounded-2xl border bg-card p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between px-6 pt-6">
        <h3 id="demo-title" className="text-lg font-semibold">
          Découvrez StockFlow en 2 minutes
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Fermer la vidéo de démo"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="aspect-video bg-muted">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
          <Play className="h-12 w-12" aria-hidden="true" />
          <p className="text-base">Vidéo de démo à intégrer (YouTube, Loom ou Vimeo)</p>
          <p className="text-base">Remplacez ce bloc par une balise &lt;iframe&gt;.</p>
        </div>
      </div>
    </dialog>
  )
}
