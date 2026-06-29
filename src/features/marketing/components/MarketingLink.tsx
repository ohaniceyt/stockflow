import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from 'react'

interface MarketingLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
}

const LANDING_ROUTES = new Set([
  '/',
  '/pricing',
  '/features/inventory',
  '/features/pos-cashier',
  '/features/offline',
  '/features/analytics',
])

export const MarketingLink = forwardRef<HTMLAnchorElement, MarketingLinkProps>(
  ({ to, onClick, ...props }, ref) => {
    const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e)
      if (e.defaultPrevented) return
      if (to.startsWith('http') || to.startsWith('mailto:') || to.startsWith('tel:')) return
      if (!LANDING_ROUTES.has(to)) return
      e.preventDefault()
      window.history.pushState({}, '', to)
      window.dispatchEvent(new Event('navigate-landing', { bubbles: true }))
      window.scrollTo({ top: 0, behavior: 'instant' })
    }

    return (
      <a ref={ref} href={to} onClick={handleClick} {...props}>
        {props.children}
      </a>
    )
  }
)
MarketingLink.displayName = 'MarketingLink'
