import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CashierWorkspace } from '../components/CashierWorkspace'

export interface CartItem {
  id: string
  productId: string
  productName: string
  productUnit: string
  locationId: string
  locationName: string
  sellingPrice: number
  quantity: number
  stock: number
}

export default function CashierPage() {
  const openPosTab = () => {
    window.open('/caisse-pos', '_blank', 'noopener')
  }

  return (
    <CashierWorkspace
      embedded
      extraHeaderActions={
        <Button type="button" variant="outline" size="sm" onClick={openPosTab}>
          <ExternalLink className="mr-2 h-4 w-4" />
          Ouvrir le poste de vente
        </Button>
      }
    />
  )
}
