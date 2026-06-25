import { useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { edgeFetch } from '@/services/edgeFunctions'
import { Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

interface BulkProductRow {
  name: string
  category: string | null
  unit: string
  threshold: number
  costPrice: number
  sellingPrice: number
  supplier: string | null
  barcode: string | null
  description: string | null
  isActive: boolean
}

interface ParsedRow {
  index: number
  data: Partial<BulkProductRow>
  errors: string[]
}

interface BulkImportResult {
  created: number
  total: number
  errors: string[]
  error?: string
}

interface BulkProductImportProps {
  orgId: string
  onSuccess: () => void
  disabled?: boolean
}

const EXPECTED_HEADERS = [
  'Nom',
  'Catégorie',
  'Unité',
  'Seuil',
  "Prix d'achat",
  'Prix de vente',
  'Fournisseur',
  'Code-barres',
  'Description',
  'Actif',
]

const HEADER_ALIASES: Record<string, string[]> = {
  Nom: ['nom', 'name', 'produit'],
  Catégorie: ['catégorie', 'categorie', 'category'],
  Unité: ['unité', 'unite', 'unit'],
  Seuil: ['seuil', 'threshold', 'alerte'],
  "Prix d'achat": ["prix d'achat", 'prix achat', 'cost_price', 'cost price'],
  'Prix de vente': ['prix de vente', 'prix vente', 'selling_price', 'selling price'],
  Fournisseur: ['fournisseur', 'supplier'],
  'Code-barres': ['code-barres', 'code barres', 'barcode', 'code-barre'],
  Description: ['description', 'notes'],
  Actif: ['actif', 'active', 'is_active', 'statut'],
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value instanceof Date) return value.toISOString()
  if (
    typeof value === 'object' &&
    'text' in value &&
    typeof (value as Record<string, unknown>).text === 'string'
  ) {
    return (value as { text: string }).text
  }
  return ''
}

function normalizeHeader(value: unknown): string {
  return cellText(value).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findHeaderIndex(headers: string[], expected: string): number {
  const aliases = HEADER_ALIASES[expected] ?? [normalizeHeader(expected)]
  return headers.findIndex((h) => aliases.includes(normalizeHeader(h)))
}

function parseRow(
  row: { getCell: (index: number) => { value: unknown } },
  columnMap: Record<string, number | undefined>,
  rowIndex: number
): ParsedRow | null {
  const getValue = (key: string): unknown => {
    const col = columnMap[key]
    if (col === undefined || col < 0) return undefined
    return row.getCell(col + 1).value
  }

  const hasAny = EXPECTED_HEADERS.some((key) => cellText(getValue(key)) !== '')
  if (!hasAny) return null

  const errors: string[] = []
  const name = cellText(getValue('Nom')).trim()
  if (!name) {
    errors.push('Le nom est requis')
  }

  const category = cellText(getValue('Catégorie')).trim() || null
  const unit = cellText(getValue('Unité')).trim() || 'unité'

  const thresholdRaw = getValue('Seuil')
  const threshold = thresholdRaw === undefined || thresholdRaw === null ? 0 : Number(thresholdRaw)
  if (Number.isNaN(threshold) || threshold < 0) {
    errors.push('Le seuil doit être un nombre positif')
  }

  const costRaw = getValue("Prix d'achat")
  const costPrice = costRaw === undefined || costRaw === null ? 0 : Number(costRaw)
  if (Number.isNaN(costPrice) || costPrice < 0) {
    errors.push("Le prix d'achat doit être un nombre positif")
  }

  const sellingRaw = getValue('Prix de vente')
  const sellingPrice = sellingRaw === undefined || sellingRaw === null ? 0 : Number(sellingRaw)
  if (Number.isNaN(sellingPrice) || sellingPrice < 0) {
    errors.push('Le prix de vente doit être un nombre positif')
  }

  const supplier = cellText(getValue('Fournisseur')).trim() || null
  const barcode = cellText(getValue('Code-barres')).trim() || null
  const description = cellText(getValue('Description')).trim() || null

  const activeRaw = cellText(getValue('Actif')).trim().toLowerCase()
  const isActive = activeRaw === '' || ['oui', 'true', '1', 'yes', 'actif'].includes(activeRaw)

  return {
    index: rowIndex,
    data: {
      name,
      category,
      unit,
      threshold,
      costPrice,
      sellingPrice,
      supplier,
      barcode,
      description,
      isActive,
    },
    errors,
  }
}

export function BulkProductImport({ orgId, onSuccess, disabled }: BulkProductImportProps) {
  const [open, setOpen] = useState(false)
  const [fileKey, setFileKey] = useState(0)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)

  const validRows = parsedRows.filter((r) => r.errors.length === 0)
  const invalidRows = parsedRows.filter((r) => r.errors.length > 0)

  const downloadTemplate = async () => {
    const { Workbook } = await import('exceljs')
    const wb = new Workbook()
    const ws = wb.addWorksheet('Produits')

    ws.addRow(EXPECTED_HEADERS)
    ws.addRow([
      'Ciment 50kg',
      'Matériaux',
      'sac',
      10,
      5000,
      6500,
      'CIMTOGO',
      '123456789',
      'Ciment portland',
      'Oui',
    ])

    const headerRow = ws.getRow(1)
    headerRow.font = { bold: true }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }

    const buffer = await wb.xlsx.writeBuffer()
    downloadBlob(
      buffer,
      `modele-import-produits-${new Date().toISOString().slice(0, 10)}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  }

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    setParseError(null)
    setResult(null)
    setParsedRows([])

    try {
      const buffer = await file.arrayBuffer()
      const { Workbook } = await import('exceljs')
      const wb = new Workbook()
      await wb.xlsx.load(buffer)
      const ws = wb.worksheets[0]
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!ws) {
        throw new Error('Le fichier ne contient pas de feuille de calcul')
      }

      const headerRow = ws.getRow(1)
      const headers: string[] = []
      headerRow.eachCell((cell) => {
        headers.push(cellText(cell.value))
      })

      const columnMap: Record<string, number | undefined> = {}
      for (const expected of EXPECTED_HEADERS) {
        const idx = findHeaderIndex(headers, expected)
        if (idx !== -1) {
          columnMap[expected] = idx
        }
      }

      if (columnMap.Nom === undefined) {
        throw new Error("Colonne 'Nom' introuvable. Veuillez utiliser le modèle.")
      }

      const rows: (ParsedRow | null)[] = []
      ws.eachRow((row, rowIndex) => {
        if (rowIndex === 1) return
        rows.push(parseRow(row, columnMap, rowIndex - 1))
      })

      setParsedRows(rows.filter((r): r is ParsedRow => r !== null))
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Erreur de lecture du fichier')
    } finally {
      setIsParsing(false)
    }
  }

  const handleImport = async () => {
    if (validRows.length === 0) return

    setIsImporting(true)
    setResult(null)

    try {
      const payload = {
        org_id: orgId,
        products: validRows.map((r) => ({
          name: r.data.name,
          category: r.data.category,
          unit: r.data.unit,
          threshold: r.data.threshold,
          cost_price: r.data.costPrice,
          selling_price: r.data.sellingPrice,
          supplier: r.data.supplier,
          barcode: r.data.barcode,
          description: r.data.description,
          is_active: r.data.isActive,
        })),
      }

      const res = await edgeFetch<BulkImportResult>('bulk-create-products', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      setResult(res)
      if (res.created > 0) {
        onSuccess()
      }
    } catch (err) {
      setResult({
        created: 0,
        total: validRows.length,
        errors: [err instanceof Error ? err.message : 'Erreur inconnue'],
      })
    } finally {
      setIsImporting(false)
    }
  }

  const closeDialog = () => {
    setOpen(false)
    setParsedRows([])
    setResult(null)
    setParseError(null)
    setFileKey((k) => k + 1)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            aria-label="Importer des produits depuis Excel"
            disabled={disabled}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importer Excel
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import de produits par Excel</DialogTitle>
          <DialogDescription>
            Téléchargez le modèle, remplissez-le, puis importez vos produits en masse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" />
              Modèle Excel
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulk-upload">Fichier Excel</Label>
            <Input
              key={fileKey}
              id="bulk-upload"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={[disabled, isParsing, isImporting].some(Boolean)}
            />
          </div>

          {isParsing && <p className="text-sm text-muted-foreground">Analyse du fichier…</p>}
          {parseError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {parseError}
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {validRows.length} valide(s)
                </span>
                {invalidRows.length > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {invalidRows.length} invalide(s)
                  </span>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Ligne</th>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Catégorie</th>
                      <th className="px-3 py-2 text-left">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => (
                      <tr key={row.index} className="border-t">
                        <td className="px-3 py-2">{row.index}</td>
                        <td className="px-3 py-2">{row.data.name ?? '—'}</td>
                        <td className="px-3 py-2">{row.data.category ?? '—'}</td>
                        <td className="px-3 py-2">
                          {row.errors.length === 0 ? (
                            <span className="text-green-600">Valide</span>
                          ) : (
                            <ul className="list-disc pl-4 text-destructive">
                              {row.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`rounded-md p-3 text-sm ${
                result.created > 0
                  ? 'bg-green-50 text-green-700'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              <p>
                {result.created} produit(s) créé(s) sur {result.total} ligne(s).
              </p>
              {result.error && <p className="mt-1 font-medium">{result.error}</p>}
              {result.errors.length > 0 && (
                <ul className="mt-1 list-disc pl-4">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={closeDialog} disabled={isImporting}>
              {result && result.created > 0 ? 'Fermer' : 'Annuler'}
            </Button>
            <Button
              onClick={handleImport}
              disabled={[disabled, isImporting, validRows.length === 0].some(Boolean)}
            >
              {isImporting ? 'Import…' : `Importer ${String(validRows.length)} produit(s)`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function downloadBlob(buffer: ArrayBuffer, filename: string, type: string) {
  const blob = new Blob([buffer], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
