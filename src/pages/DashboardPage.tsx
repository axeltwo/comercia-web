import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, ArrowRight, Boxes, ShoppingBag, TrendingUp, Wallet, PackageX, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { getDashboard } from '../features/dashboard/api'
import { formatARS, formatARSCompact, formatPercent } from '../lib/money'
import { formatDateTime, formatDayMonth, formatYmd, todayLong } from '../lib/dates'
import { MOVEMENT_LABELS } from '../lib/types'
import { Badge, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'

function StatCard({ icon, label, value, note, tone = 'neutral', className = '' }: {
  icon: ReactNode; label: string; value: string; note?: string; tone?: 'neutral' | 'amber'; className?: string
}) {
  return (
    <div className={`card min-w-0 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium leading-tight text-neutral-500">{label}</p>
        <span className={tone === 'amber' ? 'text-amber-600' : 'text-neutral-400'}>{icon}</span>
      </div>
      <p className="mt-2 break-words text-xl font-bold tracking-tight">{value}</p>
      {note && <p className="mt-1 text-xs text-neutral-500">{note}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const business = useBusiness()
  const { data, loading, error, reload } = useLoad(() => getDashboard(business.id), [business.id])

  const header = <PageHeader title="Resumen" subtitle={`${todayLong()} · ${business.name}`} />

  if (error) return <>{header}<div className="card"><ErrorState message={error} onRetry={reload} /></div></>
  if (loading || !data) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" role="status" aria-label="Cargando resumen">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="mt-6 h-80" />
      </>
    )
  }

  const gross = data.month_revenue_cents - data.month_cost_cents
  const grossMargin = data.month_revenue_cents > 0 ? (gross / data.month_revenue_cents) * 100 : null
  const hasSales = data.daily.some((d) => d.count > 0)
  const chartData = data.daily.map((d) => ({ ...d, label: formatDayMonth(d.date), pesos: d.total_cents / 100 }))
  const noProducts = data.products_count === 0

  return (
    <>
      {header}

      {/* Alertas */}
      {(data.out_of_stock_count > 0 || data.low_stock_count > 0) && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p className="flex-1">
            {data.out_of_stock_count > 0 && <><strong>{data.out_of_stock_count}</strong> {data.out_of_stock_count === 1 ? 'producto sin stock' : 'productos sin stock'}. </>}
            {data.low_stock_count > data.out_of_stock_count && <><strong>{data.low_stock_count - data.out_of_stock_count}</strong> con stock bajo. </>}
            <Link to="/productos" className="font-semibold underline">Ver productos</Link>
          </p>
        </div>
      )}

      {/* Tarjetas */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={<Boxes size={18} />} label="Productos" value={String(data.products_count)} note="Registrados y activos" />
        <StatCard icon={<PackageX size={18} />} label="Stock bajo" value={String(data.low_stock_count)}
          note={data.low_stock_count > 0 ? 'En o por debajo del mínimo' : 'Todo en orden'} tone={data.low_stock_count > 0 ? 'amber' : 'neutral'} />
        <StatCard icon={<ShoppingBag size={18} />} label="Ventas de hoy" value={formatARS(data.today_total_cents)}
          note={`${data.today_sales_count} ${data.today_sales_count === 1 ? 'operación' : 'operaciones'}`} />
        <StatCard icon={<Wallet size={18} />} label="Ingresos del mes" value={formatARS(data.month_revenue_cents)} note="Ventas confirmadas, sin canceladas" />
        <StatCard className="col-span-2 lg:col-span-1" icon={<TrendingUp size={18} />} label="Ganancia bruta estimada" value={formatARS(gross)}
          note={grossMargin === null ? 'Ingresos menos costo de lo vendido' : `Margen ${formatPercent(grossMargin)} · antes de gastos`} />
      </div>

      {!hasSales && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-100 px-4 py-3 text-[13px] text-neutral-600">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          <span>Todavía no hay ventas registradas. Registrá la primera en <Link to="/ventas" className="font-semibold text-brand-700 underline">Ventas</Link>; estos importes se calculan solo con ventas reales.</span>
        </div>
      )}

      {/* Gráfico + más vendidos */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Ventas por día</h2>
          <p className="text-sm text-neutral-500">Últimos 14 días</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#737373' }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: '#737373' }}
                  tickFormatter={(v: number) => formatARSCompact(v * 100)} />
                <Tooltip
                  cursor={{ fill: '#f5f5f5' }}
                  formatter={(v: number) => [formatARS(Math.round(v * 100)), 'Ventas']}
                  labelFormatter={(_l, p) => (p?.[0]?.payload?.date ? formatYmd(p[0].payload.date) : '')}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e5e5', fontSize: 13 }}
                />
                <Bar dataKey="pesos" fill="#1f7a4d" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Más vendidos del mes</h2>
          {data.top_products.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">Cuando registres ventas, vas a ver acá los productos que más salen.</p>
          ) : (
            <ol className="mt-4 divide-y divide-neutral-100">
              {data.top_products.map((p) => (
                <li key={p.product_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-semibold">{p.quantity} u.</span>
                    <span className="block text-xs text-neutral-500">{formatARS(p.revenue_cents)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Movimientos + stock bajo */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold">Últimos movimientos de inventario</h2>
          {data.recent_movements.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">
              {noProducts ? 'Cargá tu primer producto con stock y el movimiento va a aparecer acá.' : 'Todavía no hay movimientos de inventario.'}
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-neutral-100">
              {data.recent_movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.product_name}</p>
                    <p className="text-xs text-neutral-500">{MOVEMENT_LABELS[m.movement_type]} · {formatDateTime(m.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${m.quantity_delta > 0 ? 'text-brand-700' : 'text-neutral-900'}`}>
                      {m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}
                    </p>
                    <p className="text-xs text-neutral-500">Stock: {m.stock_after}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold">Para reponer</h2>
          {data.low_stock_products.length === 0 ? (
            <p className="mt-6 text-sm text-neutral-500">Ningún producto llegó a su stock mínimo.</p>
          ) : (
            <>
              <ul className="mt-3 divide-y divide-neutral-100">
                {data.low_stock_products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-neutral-500">{p.sku} · mínimo {p.min_stock}</p>
                    </div>
                    <Badge tone={p.stock_quantity === 0 ? 'red' : 'amber'}>{p.stock_quantity === 0 ? 'Sin stock' : `${p.stock_quantity} u.`}</Badge>
                  </li>
                ))}
              </ul>
              <Link to="/productos" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                Ver productos <ArrowRight size={14} aria-hidden />
              </Link>
            </>
          )}
        </section>
      </div>
    </>
  )
}
