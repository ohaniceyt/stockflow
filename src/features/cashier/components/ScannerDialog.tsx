import { useEffect } from 'react'
import { ScanBarcode, Upload, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ScannerDialogProps {
  open: boolean
  onClose: () => void
  starting: boolean
  error: string | null
  containerId: string
  containerRef: React.RefObject<HTMLDivElement | null>
  onRetryCamera: () => void
  onFileSelect: () => void
}

export function ScannerDialog({
  open,
  onClose,
  starting,
  error,
  containerId,
  containerRef,
  onRetryCamera,
  onFileSelect,
}: ScannerDialogProps) {
  // Ensure scanner cleanup if the dialog closes via Escape/backdrop.
  useEffect(() => {
    if (!open) return
    return () => {
      onClose()
    }
  }, [open, onClose])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Scanner un code-barre</DialogTitle>
          <DialogDescription>
            Placez le code-barre devant la caméra ou sélectionnez une image.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {error ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p className="text-sm">{error}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRetryCamera}
                  disabled={starting}
                >
                  <ScanBarcode className="mr-2 h-4 w-4" />
                  Réessayer la caméra
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={onFileSelect}>
                  <Upload className="mr-2 h-4 w-4" />
                  Utiliser une image
                </Button>
              </div>
            </div>
          ) : (
            <div id={containerId} ref={containerRef} className="w-full rounded" />
          )}
          {starting && !error && (
            <p className="text-sm text-muted-foreground">Démarrage de la caméra…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
