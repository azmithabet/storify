import { downloadBlob } from './download'

export interface ExportColumn<T> {
  /** Header label shown in the spreadsheet. */
  header: string
  /** Either a key on the row, or a function that returns the cell value. */
  accessor: keyof T | ((row: T) => string | number | boolean | null | undefined)
  /** Optional column width (in characters). */
  width?: number
}

function getValue<T>(row: T, accessor: ExportColumn<T>['accessor']) {
  if (typeof accessor === 'function') return accessor(row)
  const v = row[accessor]
  return v as string | number | boolean | null | undefined
}

export async function exportRowsToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const XLSX = await import('xlsx')

  const aoa: (string | number | boolean | null)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => {
      const v = getValue(row, c.accessor)
      return v == null ? '' : v
    })),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? Math.max(c.header.length + 2, 12) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  downloadBlob(blob, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

/**
 * Export tabular data to a UTF-8 CSV with BOM (so Excel opens Arabic correctly).
 */
export function exportRowsToCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
) {
  const escape = (val: unknown) => {
    if (val == null) return ''
    const s = String(val)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    columns.map((c) => escape(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escape(getValue(row, c.accessor))).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`)
}
