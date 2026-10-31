import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download, Info } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import { centsToCsv, downloadCsv, toCsv } from '../lib/csv'
import { formatARS, formatARSCompact, formatPercent } from '../lib/money'
import { addDays, formatDateTime, formatDayMonth, formatYmd, monthStart, previousMonth, todayYmd } from '../lib/dates'
import { MOVEMENT_LABELS, PAYMENT_LABELS } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { listProducts } from '../features/products/api'
import { listCustomers } from '../features/sales/api'
import { fetchMovementsForExport, fetchSalesForExport, getSalesReport } from '../features/reports/api'

type Preset = 'today' | '7d' | 'month' | 'prev' | 'custom'

function range(p: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const t = todayYmd()
  if (p === 'today') return { from: t, to: t }
  if (p === '7d') return { from: addDays(t, -6), to: t }
  if (p === 'month') return { from: monthStart(t), to: t }
  return previousMonth(t)
}

const PRESETS: { id: Preset; label: string }[] = [
  { id: 'today', label: 'Hoy' }, { id: '7d', label: 'Últimos 7 días' }, { id: 'month', label: 'Este mes' }, { id: 'prev', label: 'Mes anterior' }, { id: 'custom', label: 'Personalizado' },
]

function CsvButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return <Button small onClick={onClick} loading={busy} icon={<Download size={14} />}>Exportar CSV</Button>
}

export default function ReportsPage() {
  const business = useBusiness()
  const toast = useToast()
  const [preset, setPreset] = useState<Preset>('month')
  const [{ from, to }, setDates] = useState(range('month'))
  const [exporting, setExporting] = useState<string | null>(null)

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to
  const tooLong = valid && Date.parse(to) - Date.parse(from) > 366 * 86400000
  const ok = valid && !tooLong
  const report = useLoad(() => (ok ? getSalesReport(business.id, from, to) : Promise.resolve(null)), [business.id, from, to, ok])
  const products = useLoad(() => listProducts(business.id), [business.id])

  function choose(p: Preset) {
    setPreset(p)
    if (p !== 'custom') setDates(range(p))
  }

  async function exportWith(key: string, fn: () => Promise<void>) {
    setExporting(key)
    try { await fn() } catch (e) { toast.error(friendlyError(e)) } finally { setExporting(null) }
  }

  const r = report.data
  const s = r?.summary
  const gross = s ? s.revenue_cents - s.cost_cents : 0
  const margin = s && s.revenue_cents > 0 ? (gross / s.revenue_cents) * 100 : null
  const avgTicket = s && s.sales_count > 0 ? Math.round(s.revenue_cents / s.sales_count) : 0
  const low = (products.data ?? []).filter((p) => p.stock_quantity <= p.min_stock)
  const file = (name: string) => `${name}_${from}_a_${to}.csv`
  const nothing = !!s && s.sales_count === 0 && s.cancelled_count === 0 && (r?.movements.length ?? 0) === 0

  return (
    <>
      <PageHeader title="Reportes" subtitle={ok ? `Del ${formatYmd(from)} al ${formatYmd(to)}` : undefined} />

      <div className="card mb-6 p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => choose(p.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${preset === p.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'}`}>{p.label}</button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <input type="date" className="input w-40" value={from} max={to || undefined} aria-label="Desde" onChange={(e) => { setPreset('custom'); setDates((d) => ({ ...d, from: e.target.value })) }} />
            <span className="text-neutral-400">–</span>
            <input type="date" className="input w-40" value={to} min={from || undefined} aria-label="Hasta" onChange={(e) => { setPreset('custom'); setDates((d) => ({ ...d, to: e.target.value })) }} />
          </div>
        </div>
        {!valid && <p role="alert" className="mt-3 text-sm text-red-600">Elegí un rango de fechas válido (la fecha “desde” no puede ser posterior a “hasta”).</p>}
        {tooLong && <p role="alert" className="mt-3 text-sm text-red-600">El período no puede superar un año.</p>}
      </div>

      {report.error ? <div className="card"><ErrorState message={report.error} onRetry={report.reload} /></div>
        : !ok ? null
        : report.loading || !r || !s ? (
          <div role="status" aria-label="Cargando reporte"><div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-24" />)}</div><Skeleton className="mt-6 h-72" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              {[
                ['Ingresos por ventas', formatARS(s.revenue_cents), `${s.sales_count} ${s.sales_count === 1 ? 'venta' : 'ventas'}`],
                ['Costo de lo vendido', formatARS(s.cost_cents), 'Costo histórico'],
                ['Ganancia bruta estimada', formatARS(gross), margin === null ? 'Ingresos − costo' : `Margen ${formatPercent(margin)}`],
                ['Ticket promedio', formatARS(avgTicket), 'Por venta confirmada'],
                ['Descuentos', formatARS(s.discount_cents), 'Ya descontados de ingresos'],
                ['Canceladas', String(s.cancelled_count), s.cancelled_count ? `${formatARS(s.cancelled_cents)} · no suman` : 'Ninguna'],
              ].map(([k, v, n]) => (
                <div key={k} className="card min-w-0 p-4"><p className="text-[13px] font-medium leading-tight text-neutral-500">{k}</p><p className="mt-2 break-words text-xl font-bold tracking-tight">{v}</p><p className="mt-1 text-xs text-neutral-500">{n}</p></div>
              ))}
            </div>
            <p className="mt-3 flex items-start gap-2 text-xs text-neutral-500"><Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              Ingresos = ventas confirmadas (sin canceladas). No son dinero cobrado en caja ni ganancia neta: la ganancia bruta no descuenta impuestos, comisiones ni gastos del negocio.</p>

            {nothing && <div className="card mt-6"><EmptyState icon={<Info size={22} />} title="Sin actividad en este período" description="No hay ventas ni movimientos de inventario entre esas fechas. Probá con otro rango." /></div>}

            {/* Ventas por día */}
            <section className="card mt-6 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Ventas por día</h2>
                <CsvButton busy={exporting === 'days'} onClick={() => void exportWith('days', async () => {
                  downloadCsv(file('ventas_por_dia'), toCsv(['Fecha', 'Ventas', 'Ingresos (ARS)', 'Costo (ARS)', 'Ganancia bruta (ARS)'],
                    r.by_day.map((d) => [formatYmd(d.date), d.count, centsToCsv(d.revenue_cents), centsToCsv(d.cost_cents), centsToCsv(d.revenue_cents - d.cost_cents)])))
                })} /></div>
              {r.by_day.length === 0 ? <p className="mt-4 text-sm text-neutral-500">No hay ventas confirmadas en el período.</p> : (
                <>
                  <div className="mt-4 h-64"><ResponsiveContainer width="100%" height="100%">
                    <BarChart data={r.by_day.map((d) => ({ ...d, label: formatDayMonth(d.date), pesos: d.revenue_cents / 100 }))} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="#e5e5e5" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#737373' }} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: '#737373' }} tickFormatter={(v: number) => formatARSCompact(v * 100)} />
                      <Tooltip cursor={{ fill: '#f5f5f5' }} formatter={(v: number) => [formatARS(Math.round(v * 100)), 'Ingresos']}
                        labelFormatter={(_l, p) => (p?.[0]?.payload?.date ? formatYmd(p[0].payload.date) : '')} contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 13 }} />
                      <Bar dataKey="pesos" fill="#1f7a4d" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart></ResponsiveContainer></div>
                  <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-neutral-200">
                    <table className="w-full text-left text-sm"><thead className="sticky top-0 bg-neutral-50 text-xs font-semibold text-neutral-500"><tr>
                      <th className="px-3 py-2.5">Fecha</th><th className="px-3 py-2.5 text-right">Ventas</th><th className="px-3 py-2.5 text-right">Ingresos</th><th className="hidden px-3 py-2.5 text-right sm:table-cell">Costo</th><th className="px-3 py-2.5 text-right">Ganancia bruta</th></tr></thead>
                      <tbody className="divide-y divide-neutral-100">{[...r.by_day].reverse().map((d) => (
                        <tr key={d.date}><td className="px-3 py-2">{formatYmd(d.date)}</td><td className="px-3 py-2 text-right">{d.count}</td><td className="px-3 py-2 text-right font-semibold">{formatARS(d.revenue_cents)}</td>
                          <td className="hidden px-3 py-2 text-right text-neutral-600 sm:table-cell">{formatARS(d.cost_cents)}</td><td className="px-3 py-2 text-right">{formatARS(d.revenue_cents - d.cost_cents)}</td></tr>))}</tbody></table>
                  </div>
                </>
              )}
              <div className="mt-4 flex justify-end">
                <CsvButton busy={exporting === 'sales'} onClick={() => void exportWith('sales', async () => {
                  const [{ rows, truncated }, customers] = await Promise.all([fetchSalesForExport(business.id, from, to), listCustomers(business.id)])
                  const names = new Map(customers.map((c) => [c.id, c.name]))
                  downloadCsv(file('ventas_detalle'), toCsv(['N°', 'Fecha', 'Estado', 'Cliente', 'Método de pago', 'Subtotal (ARS)', 'Descuento (ARS)', 'Total (ARS)', 'Costo (ARS)', 'Ganancia bruta (ARS)', 'Motivo cancelación'],
                    rows.map((x) => [x.sale_number, formatDateTime(x.sold_at), x.status === 'cancelled' ? 'Cancelada' : 'Confirmada', (x.customer_id && names.get(x.customer_id)) || 'Consumidor final', PAYMENT_LABELS[x.payment_method],
                      centsToCsv(x.subtotal_cents), centsToCsv(x.discount_cents), centsToCsv(x.total_cents), centsToCsv(x.cost_total_cents), centsToCsv(x.total_cents - x.cost_total_cents), x.cancel_reason])))
                  if (truncated) toast.error('Se exportaron las primeras 10.000 ventas. Acotá el período para el resto.')
                })} />
                <span className="ml-3 self-center text-xs text-neutral-500">Detalle de cada venta del período</span>
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <section className="card p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Productos más vendidos</h2>
                  <CsvButton busy={exporting === 'top'} onClick={() => void exportWith('top', async () => {
                    downloadCsv(file('productos_mas_vendidos'), toCsv(['Producto', 'SKU', 'Unidades', 'Importe (ARS)', 'Costo (ARS)', 'Ganancia bruta (ARS)'],
                      r.top_products.map((p) => [p.name, p.sku, p.quantity, centsToCsv(p.revenue_cents), centsToCsv(p.cost_cents), centsToCsv(p.revenue_cents - p.cost_cents)])))
                  })} /></div>
                {r.top_products.length === 0 ? <p className="mt-4 text-sm text-neutral-500">No hay productos vendidos en el período.</p> : (
                  <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs font-semibold text-neutral-500"><tr>
                    <th className="py-2 pr-3">Producto</th><th className="px-3 py-2 text-right">Unid.</th><th className="px-3 py-2 text-right">Importe</th><th className="py-2 pl-3 text-right">Ganancia bruta</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">{r.top_products.map((p) => (
                      <tr key={p.product_id}><td className="py-2.5 pr-3"><p className="font-medium">{p.name}</p><p className="text-xs text-neutral-500">{p.sku}</p></td>
                        <td className="px-3 py-2.5 text-right font-semibold">{p.quantity}</td><td className="px-3 py-2.5 text-right">{formatARS(p.revenue_cents)}</td><td className="py-2.5 pl-3 text-right">{formatARS(p.revenue_cents - p.cost_cents)}</td></tr>))}</tbody></table>
                    <p className="mt-2 text-xs text-neutral-500">Importe antes de descuentos generales de cada venta. Se muestran los 20 primeros por unidades.</p></div>)}
              </section>

              <section className="card p-5"><h2 className="font-semibold">Por método de pago</h2>
                {r.by_payment.length === 0 ? <p className="mt-4 text-sm text-neutral-500">Sin ventas en el período.</p> : (
                  <ul className="mt-3 divide-y divide-neutral-100">{r.by_payment.map((m) => (
                    <li key={m.payment_method} className="flex items-center justify-between py-2.5 text-sm"><span><span className="font-medium">{PAYMENT_LABELS[m.payment_method]}</span><span className="block text-xs text-neutral-500">{m.count} {m.count === 1 ? 'venta' : 'ventas'}</span></span>
                      <span className="text-right font-semibold">{formatARS(m.revenue_cents)}<span className="block text-xs font-normal text-neutral-500">{s.revenue_cents > 0 ? formatPercent((m.revenue_cents / s.revenue_cents) * 100) : ''}</span></span></li>))}</ul>)}
              </section>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Productos con bajo stock</h2>
                  <CsvButton busy={exporting === 'low'} onClick={() => void exportWith('low', async () => {
                    downloadCsv(`stock_bajo_${todayYmd()}.csv`, toCsv(['Producto', 'SKU', 'Stock actual', 'Stock mínimo', 'A reponer hasta el mínimo'], low.map((p) => [p.name, p.sku, p.stock_quantity, p.min_stock, Math.max(0, p.min_stock - p.stock_quantity)])))
                  })} /></div>
                <p className="text-xs text-neutral-500">Situación actual (no depende del período).</p>
                {low.length === 0 ? <p className="mt-4 text-sm text-neutral-500">Ningún producto está en o bajo su stock mínimo.</p> : (
                  <ul className="mt-3 max-h-72 divide-y divide-neutral-100 overflow-auto">{low.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0"><span className="block truncate font-medium">{p.name}</span><span className="text-xs text-neutral-500">{p.sku} · mínimo {p.min_stock}</span></span>
                      <Badge tone={p.stock_quantity === 0 ? 'red' : 'amber'}>{p.stock_quantity === 0 ? 'Sin stock' : `${p.stock_quantity} u.`}</Badge></li>))}</ul>)}
              </section>

              <section className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Movimientos de inventario</h2>
                  <CsvButton busy={exporting === 'mov'} onClick={() => void exportWith('mov', async () => {
                    const { rows, truncated } = await fetchMovementsForExport(business.id, from, to)
                    downloadCsv(file('movimientos_inventario'), toCsv(['Fecha', 'Producto', 'SKU', 'Tipo', 'Cantidad', 'Stock resultante', 'Motivo'],
                      rows.map((m) => [formatDateTime(m.created_at), m.product_name, m.product_sku, MOVEMENT_LABELS[m.movement_type], m.quantity_delta, m.stock_after, m.reason])))
                    if (truncated) toast.error('Se exportaron los primeros 10.000 movimientos. Acotá el período para el resto.')
                  })} /></div>
                {r.movements.length === 0 ? <p className="mt-4 text-sm text-neutral-500">Sin movimientos en el período.</p> : (
                  <ul className="mt-3 divide-y divide-neutral-100">{r.movements.map((m) => (
                    <li key={m.movement_type} className="flex items-center justify-between py-2.5 text-sm"><span className="font-medium">{MOVEMENT_LABELS[m.movement_type]}</span>
                      <span className="text-right"><span className="font-semibold">{m.units} u.</span><span className="block text-xs text-neutral-500">{m.count} {m.count === 1 ? 'movimiento' : 'movimientos'}</span></span></li>))}</ul>)}
              </section>
            </div>
          </>
        )}
    </>
  )
}
