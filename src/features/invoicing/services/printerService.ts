// ESC/POS thermal printer service supporting WebUSB, Web Bluetooth, and local network raw printing.
// This is a pragmatic client-side implementation for francophone African contexts where
// dedicated receipt printers may be connected via USB, Bluetooth, or a small local bridge.


// Minimal ambient type stubs for WebUSB / Web Bluetooth to avoid strict TS errors.
declare global {
  interface Navigator {
    usb?: {
      requestDevice: (options: { filters: unknown[] }) => Promise<UsbDeviceStub>;
    };
    bluetooth?: {
      requestDevice: (options: { acceptAllDevices?: boolean; optionalServices?: string[] }) => Promise<BluetoothDeviceStub>;
    };
  }

  interface UsbDeviceStub {
    productName?: string;
    opened: boolean;
    configuration: { interfaces: UsbInterfaceStub[] } | null;
    open: () => Promise<void>;
    selectConfiguration: (config: number) => Promise<void>;
    claimInterface: (iface: number) => Promise<void>;
    transferOut: (endpointNumber: number, data: Uint8Array) => Promise<void>;
  }

  interface UsbInterfaceStub {
    alternate: { endpoints: Array<{ direction: "in" | "out"; endpointNumber: number }> };
  }

  interface BluetoothDeviceStub {
    name?: string;
    gatt?: {
      connect: () => Promise<BluetoothGattServerStub>;
    };
  }

  interface BluetoothGattServerStub {
    getPrimaryService: (uuid: string) => Promise<BluetoothServiceStub>;
  }

  interface BluetoothServiceStub {
    getCharacteristic: (uuid: string) => Promise<BluetoothCharacteristicStub>;
  }

  interface BluetoothCharacteristicStub {
    writeValue: (data: Uint8Array) => Promise<void>;
  }

  // Compatibility aliases so our code can use the standard-ish WebUSB/WebBT type names.
  interface USBDevice extends UsbDeviceStub {}
  interface BluetoothDevice extends BluetoothDeviceStub {}
  interface BluetoothRemoteGATTCharacteristic extends BluetoothCharacteristicStub {}
}

export type PrinterConnectionType = 'usb' | 'bluetooth' | 'network';

interface BasePrinterConfig {
  type: PrinterConnectionType;
  name?: string;
}

export interface UsbPrinterConfig extends BasePrinterConfig {
  type: 'usb';
  device: USBDevice;
  endpoint?: number;
}

export interface BluetoothPrinterConfig extends BasePrinterConfig {
  type: 'bluetooth';
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
}

export interface NetworkPrinterConfig extends BasePrinterConfig {
  type: 'network';
  url: string;
}

export type PrinterConfig = UsbPrinterConfig | BluetoothPrinterConfig | NetworkPrinterConfig;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const CUT = new Uint8Array([GS, 0x56, 0x41, 0x00]);

export function createEscPosBuffer(lines: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  // Initialize printer
  chunks.push(new Uint8Array([ESC, 0x40]));
  // Center align for header
  chunks.push(new Uint8Array([ESC, 0x61, 0x01]));

  for (const line of lines) {
    chunks.push(encoder.encode(line));
    chunks.push(new Uint8Array([LF]));
  }

  // Left align
  chunks.push(new Uint8Array([ESC, 0x61, 0x00]));
  // Feed and cut
  chunks.push(new Uint8Array([LF, LF, LF]));
  chunks.push(CUT);

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function getUsbErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotFoundError') return 'Aucune imprimante USB sélectionnée.';
    if (err.name === 'SecurityError') return 'WebUSB bloqué par la politique de sécurité (HTTPS requis).';
    if (err.name === 'NotAllowedError') return 'Permission WebUSB refusée.';
  }
  return err instanceof Error ? err.message : 'Erreur USB inconnue';
}

function getBluetoothErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotFoundError') return 'Aucune imprimante Bluetooth trouvée.';
    if (err.name === 'SecurityError') return 'Web Bluetooth bloqué par la politique de sécurité (HTTPS requis).';
    if (err.name === 'NotAllowedError') return 'Permission Bluetooth refusée.';
  }
  return err instanceof Error ? err.message : 'Erreur Bluetooth inconnue';
}

export async function requestUsbPrinter(): Promise<UsbPrinterConfig | null> {
  try {
    if (!navigator.usb) {
      throw new Error('WebUSB non supporté par ce navigateur');
    }
    const device = await navigator.usb.requestDevice({ filters: [] });
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);
    return { type: 'usb', device, name: device.productName };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('USB printer error:', err);
    throw new Error(getUsbErrorMessage(err));
  }
}

export async function requestBluetoothPrinter(): Promise<BluetoothPrinterConfig | null> {
  try {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth non supporté par ce navigateur');
    }
    const device = await navigator.bluetooth.requestDevice({
      // Thermal printers usually expose a serial-port service; accept any to stay flexible.
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'device_information'],
    });
    const server = await device.gatt?.connect();
    if (!server) throw new Error('Impossible de se connecter au périphérique Bluetooth');

    // Try common ESC/POS service/characteristic UUIDs
    const serviceUuids = ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'];
    const characteristicUuids = ['00002af1-0000-1000-8000-00805f9b34fb', '49535343-1e4d-4bd9-ba61-23c647249616'];

    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    for (const serviceUuid of serviceUuids) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        for (const charUuid of characteristicUuids) {
          characteristic = await service.getCharacteristic(charUuid);
          if (characteristic) break;
        }
        if (characteristic) break;
      } catch {
        // try next service
      }
    }

    if (!characteristic) {
      throw new Error('Aucune caractéristique d\'impression trouvée');
    }

    return { type: 'bluetooth', device, characteristic, name: device.name ?? 'Bluetooth' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Bluetooth printer error:', err);
    throw new Error(getBluetoothErrorMessage(err));
  }
}

export async function printToPrinter(config: PrinterConfig, data: Uint8Array): Promise<void> {
  switch (config.type) {
    case 'usb':
      return printUsb(config, data);
    case 'bluetooth':
      return printBluetooth(config, data);
    case 'network':
      return printNetwork(config, data);
    default:
      throw new Error('Type d\'imprimante inconnu');
  }
}

async function printUsb(config: UsbPrinterConfig, data: Uint8Array): Promise<void> {
  const device = config.device;
  if (!device.opened) {
    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);
  }

  const iface = device.configuration?.interfaces[0];
  if (!iface) throw new Error('Interface USB introuvable');

  const endpointNumber =
    config.endpoint ?? iface.alternate.endpoints.find((e) => e.direction === 'out')?.endpointNumber;
  if (endpointNumber == null) {
    throw new Error('Endpoint de sortie USB introuvable');
  }

  await device.transferOut(endpointNumber, data);
}

async function printBluetooth(config: BluetoothPrinterConfig, data: Uint8Array): Promise<void> {
  await config.characteristic.writeValue(data);
}

async function printNetwork(config: NetworkPrinterConfig, data: Uint8Array): Promise<void> {
  const response = await fetch(config.url, {
    method: 'POST',
    body: new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' }),
    headers: { 'Content-Type': 'application/octet-stream' },
  });
  if (!response.ok) {
    throw new Error(`Erreur réseau : ${response.status} ${response.statusText}`);
  }
}

export function formatDocumentForPrinter(
  doc: {
    documentNumber: string;
    type: string;
    status: string;
    issueDate: string;
    currency: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    paidAmount?: number;
    items: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
  },
  orgName: string,
): string[] {
  const typeLabel = doc.type === 'quote' ? 'DEVIS' : doc.type === 'invoice' ? 'FACTURE' : 'BON DE LIVRAISON';
  const lines: string[] = [];
  lines.push(orgName);
  lines.push('');
  lines.push(typeLabel);
  lines.push(`N° ${doc.documentNumber}`);
  lines.push(`Date: ${new Date(doc.issueDate).toLocaleDateString('fr-FR')}`);
  lines.push(`Statut: ${doc.status}`);
  lines.push('');
  lines.push('ARTICLE          QTE  P.U.   TOTAL');
  lines.push('--------------------------------');
  for (const item of doc.items) {
    const desc = item.description.slice(0, 16).padEnd(16);
    const qty = String(item.quantity).padStart(3);
    const unit = item.unitPrice.toLocaleString('fr-FR').padStart(6);
    const total = item.total.toLocaleString('fr-FR').padStart(7);
    lines.push(`${desc}${qty} ${unit} ${total}`);
  }
  lines.push('--------------------------------');
  lines.push(`SOUS-TOTAL: ${doc.subtotal.toLocaleString('fr-FR')} ${doc.currency}`);
  if (doc.taxTotal > 0) {
    lines.push(`TAXE:       ${doc.taxTotal.toLocaleString('fr-FR')} ${doc.currency}`);
  }
  lines.push(`TOTAL:      ${doc.total.toLocaleString('fr-FR')} ${doc.currency}`);
  if (doc.paidAmount != null && doc.paidAmount > 0) {
    lines.push(`PAYE:       ${doc.paidAmount.toLocaleString('fr-FR')} ${doc.currency}`);
    lines.push(`RESTE:      ${Math.max(0, doc.total - doc.paidAmount).toLocaleString('fr-FR')} ${doc.currency}`);
  }
  lines.push('');
  lines.push('Merci pour votre confiance !');
  return lines;
}
