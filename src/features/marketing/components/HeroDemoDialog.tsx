import { useEffect, useRef } from 'react'
import { Play, X } from 'lucide-react'

interface HeroDemoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function HeroDemoDialog({ open, onOpenChange }: HeroDemoDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }

    const handleClose = () => onOpenChange(false)
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [open, onOpenChange])

  return (
    <dialog
      ref={ref}
      className="m-auto max-w-3xl rounded-2xl border bg-card p-0 shadow-2xl backdrop:bg-black/50"
    >
      <div className="flex items-center justify-between px-6 pt-6">
        <h3 className="text-lg font-semibold">Découvrez StockFlow en 2 minutes</h3>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="rounded-full p-1 hover:bg-accent"
          aria-label="Fermer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="aspect-video bg-muted">
        <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
          <Play className="h-12 w-12" />
          <p className="text-sm">Vidéo de démo à intégrer (YouTube, Loom ou Vimeo)</p>
          <p className="text-xs">Remplacez ce bloc par une balise &lt;iframe&gt;.</p>
        </div>
      </div>
    </dialog>
  )
}
