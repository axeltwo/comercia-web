import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeftRight, Plus, Search, SearchX } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import { formatDateTime } from '../lib/dates'
import { MOVEMENT_LABELS } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { listProducts } from '../features/products/api'
import { listMovements, PAGE_SIZE, type MovementFilters, type MovementRow } from '../features/inventory/api'
import MovementModal from '../features/inventory/MovementModal'

const EMPTY: MovementFilters = { search: '', type: '', from: '', to: '' }
const TONES = { initial: 'neutral', entry: 'green', exit: 'amber', adjustment: 'amber', sale: 'neutral', sale_cancel: 'green' } as const

export default function InventoryPage() {
  const business = useBusiness()
  const toast = useToast()
  const products = useLoad(() => listProducts(business.id), [business.id])

  const [filters, setFilters] = useState<MovementFilters>(EMPTY)
  const [debounced, setDebounced] = useState<MovementFilters>(EMPTY)
  const [rows, setRows] = useState<MovementRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [modal, setModal] = useState<{ productId?: string } | null>(null)
  const requestId = useRef(0)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(filters), 300)
    return () => window.clearTimeout(t)
  }, [filters])

  const load = useCallback(async (append: boolean, offset: number) => {
    const id = ++requestId.current
    append ? setLoadingMore(true) : setLoading(true)
    setError(null)
    try {
      const page = await listMovements(business.id, debounced, offset)
      if (id !== requestId.current) return // llegó una respuesta vieja: se descarta
      setRows((r) => (append ? [...r, ...page] : page))
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      if (id === requestId.current) setError(friendlyError(e))
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false) }
    }
  }, [business.id, debounced])

  useEffect(() => { void load(false, 0) }, [load])

  const low = (products.data ?? []).filter((p) => p.stock_quantity <= p.min_stock)
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY)
  const set = <K extends keyof MovementFilters>(k: K, v: MovementFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  function saved() {
    setModal(null)
    toast.success('Movimiento registrado.')
    products.reload()
    void load(false, 0)
  }

  return (
    <>
      <PageHeader title="Inventario" subtitle="Entradas, salidas, ajustes e historial de movimientos"
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setModal({})} disabled={(products.data ?? []).length === 0}>Registrar movimiento</Button>} />

      {low.length > 0 && (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4" aria-label="Productos para reponer">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle size={16} aria-hidden /> {low.length} {low.length === 1 ? 'producto llegó' : 'productos llegaron'} al stock mínimo
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {low.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span>
                  <span className="text-xs text-neutral-500">Stock {p.stock_quantity} · mínimo {p.min_stock}</span></span>
                <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={() => setModal({ productId: p.id })}>Reponer</button>
              </li>
            ))}
          </ul>
          {low.length > 6 && <p className="mt-2 text-xs text-amber-900">y {low.length - 6} más. Los ves en Productos filtrando por "Stock bajo".</p>}
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-neutral-200 p-4 md:grid-cols-[1fr_11rem_9rem_9rem]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input className="input pl-9" placeholder="Buscar producto o SKU" value={filters.search} onChange={(e) => set('search', e.target.value)} aria-label="Buscar en el historial" />
          </div>
          <select className="input" value={filters.type} onChange={(e) => set('type', e.target.value as MovementFilters['type'])} aria-label="Tipo de movimiento">
            <option value="">Todos los tipos</option>
            {Object.entries(MOVEMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" className="input" value={filters.from} max={filters.to || undefined} onChange={(e) => set('from', e.target.value)} aria-label="Desde" />
          <input type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to', e.target.value)} aria-label="Hasta" />
        </div>

        {loading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Cargando movimientos">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load(false, 0)} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={<SearchX size={22} />} title="No hay movimientos con esos filtros" description="Probá con otro rango de fechas o tipo de movimiento."
              action={<Button onClick={() => setFilters(EMPTY)}>Limpiar filtros</Button>} />
          ) : (
            <EmptyState icon={<ArrowLeftRight size={22} />} title="Todavía no hay movimientos"
              description="Cada vez que cargues stock, vendas o ajustes mercadería, queda registrado acá con fecha y motivo." />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-500">
                  <tr><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Cantidad</th><th className="px-4 py-3 text-right">Stock resultante</th><th className="px-4 py-3">Motivo</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-neutral-50/70">
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDateTime(m.created_at)}</td>
                      <td className="px-4 py-3"><p className="font-semibold">{m.product_name}</p><p className="text-xs text-neutral-500">{m.product_sku}</p></td>
                      <td className="px-4 py-3"><Badge tone={TONES[m.movement_type]}>{MOVEMENT_LABELS[m.movement_type]}</Badge></td>
                      <td className={`px-4 py-3 text-right font-semibold ${m.quantity_delta > 0 ? 'text-brand-700' : ''}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</td>
                      <td className="px-4 py-3 text-right text-neutral-600">{m.stock_after}</td>
                      <td className="max-w-xs truncate px-4 py-3 text-neutral-600" title={m.reason ?? undefined}>{m.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {rows.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.product_name}</p>
                    <p className="text-xs text-neutral-500">{formatDateTime(m.created_at)}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2"><Badge tone={TONES[m.movement_type]}>{MOVEMENT_LABELS[m.movement_type]}</Badge>
                      {m.reason && <span className="truncate text-xs text-neutral-500">{m.reason}</span>}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`font-semibold ${m.quantity_delta > 0 ? 'text-brand-700' : ''}`}>{m.quantity_delta > 0 ? '+' : ''}{m.quantity_delta}</p>
                    <p className="text-xs text-neutral-500">Stock: {m.stock_after}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
              <span>{rows.length} movimientos cargados</span>
              {hasMore && <Button small onClick={() => void load(true, rows.length)} loading={loadingMore}>Cargar más</Button>}
            </div>
          </>
        )}
      </div>

      {modal && products.data && (
        <MovementModal businessId={business.id} products={products.data} initialProductId={modal.productId} onClose={() => setModal(null)} onSaved={saved} />
      )}
    </>
  )
}
