interface OptimizedImageProps {
  src: string
  alt: string
  width: number
  height: number
  loading?: 'eager' | 'lazy'
  fetchpriority?: 'high' | 'low' | 'auto'
  className?: string
  sizes?: string
}

/**
 * Serves a WebP version of a PNG asset with responsive srcsets.
 * Falls back to the original PNG for browsers without WebP support.
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  loading = 'lazy',
  fetchpriority = 'auto',
  className,
  sizes = '100vw',
}: OptimizedImageProps) {
  const webpSrcSet = `${src}-800.webp 800w, ${src}-1600.webp 1600w`
  return (
    <picture>
      <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />
      <img
        src={`${src}.png`}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        fetchPriority={fetchpriority}
        className={className}
        decoding="async"
      />
    </picture>
  )
}
