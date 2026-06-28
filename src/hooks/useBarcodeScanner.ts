import { useEffect, useRef, useState, useCallback } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export interface ScannerCamera {
  id: string
  label: string
}

interface UseBarcodeScannerOptions {
  containerId: string
  containerRef: React.RefObject<HTMLDivElement | null>
  availableProducts: { barcode?: string | null }[]
  onMatch: (barcode: string) => void
  onNoMatch?: (barcode: string) => void
}

export function useBarcodeScanner({
  containerId,
  containerRef,
  availableProducts,
  onMatch,
  onNoMatch,
}: UseBarcodeScannerOptions) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [open, setOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameras, setCameras] = useState<ScannerCamera[]>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null)
  const stopPromiseRef = useRef<Promise<void> | null>(null)

  const stop = useCallback(async () => {
    if (stopPromiseRef.current) {
      await stopPromiseRef.current
      return
    }
    stopPromiseRef.current = (async () => {
      try {
        if (scannerRef.current?.isScanning) {
          await scannerRef.current.stop()
        }
      } catch {
        // ignore cleanup errors
      }
      scannerRef.current = null
    })()
    await stopPromiseRef.current
    stopPromiseRef.current = null
  }, [])

  const reset = useCallback(() => {
    setOpen(false)
    setStarting(false)
    setError(null)
    setCameras([])
    setSelectedCameraId(null)
  }, [])

  const close = useCallback(async () => {
    await stop()
    reset()
  }, [stop, reset])

  const listCameras = useCallback(async () => {
    try {
      const list = await Html5Qrcode.getCameras()
      return list.map((c) => ({ id: c.id, label: c.label }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Impossible d'accéder aux caméras"
      throw new Error(message)
    }
  }, [])

  const pickBestCamera = useCallback((list: ScannerCamera[]) => {
    if (list.length === 0) return null
    if (list.length === 1) return list[0].id

    const label = (c: ScannerCamera) => c.label.toLowerCase()

    // Prefer back-facing / environment cameras on phones/tablets.
    const back = list.find((c) => {
      const l = label(c)
      return (
        l.includes('back') ||
        l.includes('rear') ||
        l.includes('environment') ||
        l.includes('arrière') ||
        l.includes('世界') // fallback for some Android labels
      )
    })

    // Avoid front/selfie/user-facing when possible.
    const notFront = list.find((c) => {
      const l = label(c)
      return !l.includes('front') && !l.includes('selfie') && !l.includes('user')
    })

    return (back ?? notFront ?? list[0]).id
  }, [])

  const start = useCallback(async () => {
    setOpen(true)
    setError(null)
    setStarting(true)
    try {
      const list = await listCameras()
      if (list.length === 0) {
        throw new Error('Aucune caméra détectée sur cet appareil.')
      }
      setCameras(list)
      const best = pickBestCamera(list)
      setSelectedCameraId(best)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'accéder à la caméra")
      setStarting(false)
    }
  }, [listCameras, pickBestCamera])

  const retry = useCallback(async () => {
    await close()
    await start()
  }, [close, start])

  const handleDecoded = useCallback(
    (decodedText: string) => {
      const matched = availableProducts.find((p) => p.barcode === decodedText)
      if (matched) {
        onMatch(decodedText)
        void close()
      } else {
        onNoMatch?.(decodedText)
      }
    },
    [availableProducts, onMatch, onNoMatch, close]
  )

  useEffect(() => {
    if (!open || !containerRef.current || cameras.length === 0 || !selectedCameraId) return
    if (scannerRef.current) return

    let cancelled = false
    const cameraId = selectedCameraId

    scannerRef.current = new Html5Qrcode(containerId)
    scannerRef.current
      .start(
        cameraId,
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          handleDecoded(decodedText)
        },
        () => {
          // ignore per-frame scan errors
        }
      )
      .then(() => {
        if (!cancelled) setStarting(false)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Impossible de démarrer la caméra.')
          setStarting(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, cameras, selectedCameraId, containerId, containerRef, handleDecoded])

  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  const scanFile = useCallback(
    async (file: File) => {
      setError(null)
      const reader = new Html5Qrcode('file-scanner-temp')
      try {
        const decodedText = await reader.scanFile(file, true)
        handleDecoded(decodedText)
      } catch {
        setError('Aucun code-barre détecté sur cette image.')
      } finally {
        try {
          await reader.stop()
        } catch {
          // cleanup
        }
      }
    },
    [handleDecoded]
  )

  return {
    open,
    starting,
    error,
    cameras,
    selectedCameraId,
    start,
    close,
    retry,
    scanFile,
    setSelectedCameraId,
  }
}
