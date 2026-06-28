import { jsPDF } from 'jspdf'
import type { StockItem } from '../services/stockService'

interface ExportOptions {
  redactFinancials?: boolean
}

export function exportStockToExcel(
  stock: StockItem[],
  orgName = 'StockFlow',
  options: ExportOptions = {}
) {
  const { redactFinancials = false } = options
  return import('exceljs').then(({ Workbook }) => {
    const wb = new Workbook()
    const ws = wb.addWorksheet('Stock')

    const baseColumns = [
      { header: 'Produit', key: 'productName', width: 30 },
      { header: 'Référence', key: 'barcode', width: 20 },
      { header: 'Catégorie', key: 'category', width: 20 },
      { header: 'Emplacement', key: 'locationName', width: 20 },
      { header: 'Quantité', key: 'quantity', width: 12 },
      { header: 'Unité', key: 'productUnit', width: 12 },
      { header: 'Seuil', key: 'threshold', width: 12 },
    ]

    const financialColumns = redactFinancials
      ? []
      : [
          { header: 'PA unitaire', key: 'costPrice', width: 14 },
          { header: 'PV unitaire', key: 'sellingPrice', width: 14 },
          { header: 'Valeur achat', key: 'stockValue', width: 14 },
          { header: 'Valeur vente', key: 'stockSellingValue', width: 14 },
        ]

    ws.columns = [
      ...baseColumns,
      ...financialColumns,
      { header: 'Statut', key: 'status', width: 12 },
    ]

    stock.forEach((item) => {
      const status =
        item.quantity <= 0 ? 'RUPTURE' : item.quantity <= item.threshold ? 'ALERTE' : 'OK'
      const row: Record<string, unknown> = {
        productName: item.productName,
        barcode: item.barcode ?? '',
        category: item.category ?? '',
        locationName: item.locationName,
        quantity: item.quantity,
        productUnit: item.productUnit,
        threshold: item.threshold,
        status,
      }
      if (!redactFinancials) {
        row.costPrice = item.costPrice
        row.sellingPrice = item.sellingPrice
        row.stockValue = item.quantity * item.costPrice
        row.stockSellingValue = item.quantity * item.sellingPrice
      }
      ws.addRow(row)
    })

    ws.getRow(1).font = { bold: true }
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    }

    return wb.xlsx.writeBuffer().then((buffer) => {
      downloadBlob(
        buffer,
        `stock-${orgName}-${today()}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
    })
  })
}

export async function exportStockToPdf(
  stock: StockItem[],
  orgName = 'StockFlow',
  options: ExportOptions = {}
) {
  const { redactFinancials = false } = options
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 14

    doc.setFontSize(16)
    doc.text(`Stock - ${orgName}`, 14, y)
    y += 8

    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, y)
    y += 10

    stock.forEach((item, index) => {
      if (y > 270) {
        doc.addPage()
        y = 14
      }

      const status =
        item.quantity <= 0 ? 'RUPTURE' : item.quantity <= item.threshold ? 'ALERTE' : 'OK'
      const color =
        item.quantity <= 0
          ? [225, 29, 72]
          : item.quantity <= item.threshold
            ? [217, 119, 6]
            : [5, 150, 105]

      doc.setFillColor(color[0], color[1], color[2])
      doc.rect(14, y - 2, 2, 10, 'F')

      doc.setFontSize(11)
      doc.setTextColor(15, 23, 42)
      doc.text(`${String(index + 1)}. ${item.productName}`, 18, y + 4)

      doc.setFontSize(9)
      doc.setTextColor(100)
      const details = redactFinancials
        ? `${item.quantity.toLocaleString()} ${item.productUnit} · Seuil: ${item.threshold.toLocaleString()} · ${status}`
        : `${item.quantity.toLocaleString()} ${item.productUnit} · PA: ${item.costPrice.toLocaleString()} · PV: ${item.sellingPrice.toLocaleString()} · ${status}`
      doc.text(details, pageWidth - 14, y + 4, { align: 'right' })

      y += 10
      doc.setDrawColor(226, 232, 240)
      doc.line(14, y, pageWidth - 14, y)
      y += 4
    })

    doc.save(`stock-${orgName}-${today()}.pdf`)
    await Promise.resolve()
}

export function shareStockOnWhatsApp(
  stock: StockItem[],
  orgName = 'StockFlow',
  options: ExportOptions = {}
) {
  const { redactFinancials = false } = options
  const lines = stock.map((item) => {
    const status =
      item.quantity <= 0 ? 'RUPTURE' : item.quantity <= item.threshold ? 'ALERTE' : 'OK'
    const details = redactFinancials
      ? `${item.quantity.toLocaleString()} ${item.productUnit} (${status})`
      : `${item.quantity.toLocaleString()} ${item.productUnit} · PA: ${item.costPrice.toLocaleString()} · PV: ${item.sellingPrice.toLocaleString()} (${status})`
    return `• ${item.productName}: ${details}`
  })

  const header = `*Stock ${orgName}* — ${new Date().toLocaleDateString('fr-FR')}\n\n`
  const footer = stock.length > 0 ? `\n\n_Total: ${String(stock.length)} produits_` : ''
  const message = header + lines.join('\n') + footer

  const url = `https://wa.me/?text=${encodeURIComponent(message)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function downloadBlob(buffer: ArrayBuffer | BlobPart, filename: string, type: string) {
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

function today() {
  return new Date().toISOString().slice(0, 10)
}
