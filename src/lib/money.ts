/**
 * Dinero: SIEMPRE enteros en centavos. Nunca se hacen cuentas con decimales de punto flotante.
 * Solo se convierte a texto para mostrar o a centavos al leer lo que escribe el usuario.
 */
const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const arsCompact = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatARS(cents: number): string {
  return arsFormatter.format(cents / 100)
}

export function formatARSCompact(cents: number): string {
  return arsCompact.format(cents / 100)
}

/**
 * Convierte lo que escribe una persona a centavos.
 * Acepta "1234,50", "1.234,50", "1234.50", "1.500" (miles) y "$ 800". Devuelve null si no es válido.
 */
export function parseMoneyToCents(input: string): number | null {
  const s = input.replace(/[$\s]/g, '')
  if (!s) return null
  let intPart: string
  let decPart = ''

  if (s.includes(',')) {
    const parts = s.split(',')
    if (parts.length !== 2) return null
    intPart = parts[0].replace(/\./g, '')
    decPart = parts[1]
  } else {
    const dots = s.split('.')
    if (dots.length === 1) {
      intPart = s
    } else if (dots.length === 2 && dots[1].length <= 2) {
      intPart = dots[0]
      decPart = dots[1]
    } else if (dots.slice(1).every((g) => g.length === 3)) {
      intPart = dots.join('')
    } else {
      return null
    }
  }
  if (intPart === '') intPart = '0'
  if (!/^\d+$/.test(intPart) || !/^\d{0,2}$/.test(decPart)) return null

  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents <= 99_999_999_999_99 ? cents : null
}

/** Centavos → texto editable ("123450" → "1234,50"; enteros sin decimales). */
export function centsToInput(cents: number): string {
  const whole = Math.floor(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`
}

/**
 * Margen bruto estimado (%) = (precio − costo) / precio.
 * Es margen sobre el precio de venta, ANTES de impuestos, comisiones y gastos. No es ganancia neta.
 */
export function grossMarginPercent(costCents: number, priceCents: number): number | null {
  if (priceCents <= 0) return null
  return ((priceCents - costCents) / priceCents) * 100
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}
