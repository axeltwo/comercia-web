/**
 * Exportación a CSV pensada para Excel en español (Argentina): separador ";", UTF-8 con BOM,
 * decimales con coma. Las celdas de texto que empiezan con = + - @ se neutralizan para evitar
 * "inyección de fórmulas" si alguien guardó un nombre malicioso.
 */
type Cell = string | number | null | undefined

const PURE_NUMBER = /^-?\d+(,\d+)?$/

export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !PURE_NUMBER.test(s)) s = `'${s}`
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/** Centavos → "1234,50" (sin separador de miles, para que Excel lo trate como número). */
export function centsToCsv(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
