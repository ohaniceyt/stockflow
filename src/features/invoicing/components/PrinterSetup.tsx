import { useState } from 'react';
import { Usb, Bluetooth, Wifi, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  requestUsbPrinter,
  requestBluetoothPrinter,
  printToPrinter,
  createEscPosBuffer,
  formatDocumentForPrinter,
  type PrinterConfig,
} from '@/features/invoicing/services/printerService';
import type { InvoiceWithItems, QuoteWithItems, DeliveryNoteWithItems } from '@/types';

type DocumentWithItems = InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems;

interface PrinterSetupProps {
  doc: DocumentWithItems;
  orgName: string;
  onClose?: () => void;
}

export default function PrinterSetup({ doc, orgName, onClose }: PrinterSetupProps) {
  const [printer, setPrinter] = useState<PrinterConfig | null>(null);
  const [networkUrl, setNetworkUrl] = useState('http://127.0.0.1:9100/print');
  const [status, setStatus] = useState<'idle' | 'printing' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleUsb() {
    setStatus('idle');
    try {
      const config = await requestUsbPrinter();
      if (!config) {
        setMessage('Aucune imprimante USB sélectionnée.');
        return;
      }
      setPrinter(config);
      setMessage(`Imprimante USB : ${config.name ?? 'inconnue'}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur USB inconnue');
    }
  }

  async function handleBluetooth() {
    setStatus('idle');
    try {
      const config = await requestBluetoothPrinter();
      if (!config) {
        setMessage('Aucune imprimante Bluetooth sélectionnée.');
        return;
      }
      setPrinter(config);
      setMessage(`Imprimante Bluetooth : ${config.name ?? 'inconnue'}`);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur Bluetooth inconnue');
    }
  }

  function handleNetwork() {
    setPrinter({ type: 'network', url: networkUrl });
    setMessage(`Imprimante réseau : ${networkUrl}`);
  }

  async function handlePrint() {
    if (!printer) return;
    setStatus('printing');
    try {
      const lines = formatDocumentForPrinter(
        {
          documentNumber: doc.documentNumber,
          type: doc.type,
          status: doc.status,
          issueDate: doc.issueDate,
          currency: doc.currency,
          subtotal: doc.subtotal,
          taxTotal: doc.taxTotal,
          total: doc.total,
          paidAmount: (doc as InvoiceWithItems).paidAmount,
          items: doc.items,
        },
        orgName,
      );
      const buffer = createEscPosBuffer(lines);
      await printToPrinter(printer, buffer);
      setStatus('done');
      setMessage('Impression réussie.');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Erreur d\'impression');
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Configuration de l'imprimante thermique</p>
        {onClose && (
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleUsb}>
          <Usb className="mr-1 h-4 w-4" /> USB
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleBluetooth}>
          <Bluetooth className="mr-1 h-4 w-4" /> Bluetooth
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleNetwork}>
          <Wifi className="mr-1 h-4 w-4" /> Réseau
        </Button>
      </div>

      <div className="text-muted-foreground text-xs">
        Choisissez le mode de connexion. WebUSB/Bluetooth nécessitent HTTPS et un navigateur compatible (Chrome/Edge).
        Le mode réseau envoie les données brutes à une petite passerelle locale.
      </div>

      {printer?.type === 'network' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={networkUrl}
            onChange={(e) => setNetworkUrl(e.target.value)}
            className="flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="http://127.0.0.1:9100/print"
          />
        </div>
      )}

      <Button
        type="button"
        size="sm"
        onClick={handlePrint}
        disabled={!printer || status === 'printing'}
      >
        {status === 'printing' ? 'Impression...' : 'Imprimer sur thermique'}
      </Button>

      {message && (
        <p
          className={`text-xs ${
            status === 'error' ? 'text-destructive' : 'text-muted-foreground'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
