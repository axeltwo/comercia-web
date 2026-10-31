const TZ = 'America/Argentina/Buenos_Aires'

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: TZ,
})

/** DD/MM/AAAA */
export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso))
}

/** DD/MM/AAAA HH:MM */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso)).replace(',', '')
}

/** "2026-10-29" → "29/10" (sin pasar por Date para evitar corrimientos de zona horaria) */
export function formatDayMonth(ymd: string): string {
  const [, m, d] = ymd.split('-')
  return `${d}/${m}`
}

/** "2026-10-29" → "29/10/2026" */
export function formatYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

export function todayLong(): string {
  const text = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(new Date())
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Hoy en Argentina como AAAA-MM-DD. */
export function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 8)}01`
}

export function previousMonth(ymd: string): { from: string; to: string } {
  const to = addDays(monthStart(ymd), -1)
  return { from: monthStart(to), to }
}
