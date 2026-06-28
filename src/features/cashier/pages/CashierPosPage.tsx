import { CashierWorkspace } from '../components/CashierWorkspace'

export default function CashierPosPage() {
  return <CashierWorkspace embedded={false} onCloseTab={() => window.close()} />
}
