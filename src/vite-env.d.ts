/// <reference types="vite/client" />

declare module '@fontsource-variable/geist' {
  const content: string
  export default content
}

interface BarcodeDetectorOptions {
  formats?: string[]
}

interface DetectedBarcode {
  boundingBox: DOMRectReadOnly
  cornerPoints: { x: number; y: number }[]
  format: string
  rawValue: string
}

interface BarcodeDetector {
  detect(source: HTMLVideoElement | ImageBitmap | Blob | ImageData): Promise<DetectedBarcode[]>
}

declare const BarcodeDetector: {
  prototype: BarcodeDetector
  new (options?: BarcodeDetectorOptions): BarcodeDetector
}

interface Window {
  BarcodeDetector: typeof BarcodeDetector
}
