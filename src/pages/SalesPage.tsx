import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Receipt, Search, SearchX } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import { formatARS } from '../lib/money'
import { formatDateTime } from '../lib/dates'
import { PAYMENT_LABELS, type Customer, type Sale } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { listProducts } from '../features/products/api'
import { listCustomers, listSales, PAGE_SIZE, type SaleFilters } from '../features/sales/api'
import NewSaleModal from '../features/sales/NewSaleModal'
import SaleDetailModal from '../features/sales/SaleDetailModal'

const EMPTY: SaleFilters = { status: '', number: '', from: '', to: '' }

export default function SalesPage() {
  const business = useBusiness()
  const toast = useToast()
  const products = useLoad(() => listProducts(business.id), [business.id])
  const customersLoad = useLoad(() => listCustomers(business.id), [business.id])
  const [extraCustomers, setExtraCustomers] = useState<Customer[]>([])

  const [filters, setFilters] = useState<SaleFilters>(EMPTY)
  const [debounced, setDebounced] = useState<SaleFilters>(EMPTY)
  const [rows, setRows] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [selected, setSelected] = useState<Sale | null>(null)
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
      const page = await listSales(business.id, debounced, offset)
      if (id !== requestId.current) return
      setRows((r) => (append ? [...r, ...page] : page))
      setHasMore(page.length === PAGE_SIZE)
    } catch (e) {
      if (id === requestId.current) setError(friendlyError(e))
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false) }
    }
  }, [business.id, debounced])

  useEffect(() => { void load(false, 0) }, [load])

  const customers = useMemo(() => {
    const base = customersLoad.data ?? []
    return [...base, ...extraCustomers.filter((e) => !base.some((c) => c.id === e.id))].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [customersLoad.data, extraCustomers])
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers])

  const hasFilters = JSON.stringify(filters) !== JSON.stringify(EMPTY)
  const set = <K extends keyof SaleFilters>(k: K, v: SaleFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const canSell = (products.data ?? []).some((p) => p.stock_quantity > 0)

  function after(message: string) {
    setNewOpen(false)
    setSelected(null)
    toast.success(message)
    products.reload()
    void load(false, 0)
  }

  return (
    <>
      <PageHeader title="Ventas" subtitle="Registro e historial de ventas"
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewOpen(true)} disabled={products.loading || !canSell}>Nueva venta</Button>} />

      {!products.loading && !products.error && !canSell && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Para registrar una venta necesitás al menos un producto con stock. Cargalo en Productos o sumá stock desde Inventario.
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="grid gap-3 border-b border-neutral-200 p-4 md:grid-cols-[1fr_11rem_9rem_9rem]">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input className="input pl-9" placeholder="Buscar por N° de venta" inputMode="numeric" value={filters.number} onChange={(e) => set('number', e.target.value)} aria-label="Buscar por número de venta" />
          </div>
          <select className="input" value={filters.status} onChange={(e) => set('status', e.target.value as SaleFilters['status'])} aria-label="Estado">
            <option value="">Todos los estados</option>
            <option value="completed">Confirmadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          <input type="date" className="input" value={filters.from} max={filters.to || undefined} onChange={(e) => set('from', e.target.value)} aria-label="Desde" />
          <input type="date" className="input" value={filters.to} min={filters.from || undefined} onChange={(e) => set('to', e.target.value)} aria-label="Hasta" />
        </div>

        {loading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Cargando ventas">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load(false, 0)} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState icon={<SearchX size={22} />} title="No hay ventas con esos filtros" description="Probá con otro rango de fechas, estado o número."
              action={<Button onClick={() => setFilters(EMPTY)}>Limpiar filtros</Button>} />
          ) : (
            <EmptyState icon={<Receipt size={22} />} title="Todavía no registraste ventas"
              description="Cuando registres la primera, vas a ver acá el historial y el dashboard empezará a mostrar tus ingresos."
              action={canSell ? <Button variant="primary" icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>Registrar primera venta</Button> : undefined} />
          )
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-500">
                  <tr><th className="px-4 py-3">N°</th><th className="px-4 py-3">Fecha</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {rows.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50/70">
                      <td className="px-4 py-3 font-semibold">#{s.sale_number}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{formatDateTime(s.sold_at)}</td>
                      <td className="px-4 py-3 text-neutral-600">{(s.customer_id && customerName.get(s.customer_id)) || 'Consumidor final'}</td>
                      <td className="px-4 py-3 text-neutral-600">{PAYMENT_LABELS[s.payment_method]}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${s.status === 'cancelled' ? 'text-neutral-400 line-through' : ''}`}>{formatARS(s.total_cents)}</td>
                      <td className="px-4 py-3"><Badge tone={s.status === 'cancelled' ? 'red' : 'green'}>{s.status === 'cancelled' ? 'Cancelada' : 'Confirmada'}</Badge></td>
                      <td className="px-4 py-3 text-right"><Button small onClick={() => setSelected(s)}>Ver detalle</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-neutral-100 md:hidden">
              {rows.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelected(s)} className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-neutral-50">
                    <div className="min-w-0">
                      <p className="font-semibold">Venta #{s.sale_number}</p>
                      <p className="text-xs text-neutral-500">{formatDateTime(s.sold_at)} · {PAYMENT_LABELS[s.payment_method]}</p>
                      <p className="truncate text-xs text-neutral-500">{(s.customer_id && customerName.get(s.customer_id)) || 'Consumidor final'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-semibold ${s.status === 'cancelled' ? 'text-neutral-400 line-through' : ''}`}>{formatARS(s.total_cents)}</p>
                      <Badge tone={s.status === 'cancelled' ? 'red' : 'green'}>{s.status === 'cancelled' ? 'Cancelada' : 'Confirmada'}</Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
              <span>{rows.length} ventas cargadas</span>
              {hasMore && <Button small onClick={() => void load(true, rows.length)} loading={loadingMore}>Cargar más</Button>}
            </div>
          </>
        )}
      </div>

      {newOpen && products.data && (
        <NewSaleModal businessId={business.id} products={products.data} customers={customers}
          onCustomerCreated={(c) => setExtraCustomers((l) => [...l, c])} onClose={() => setNewOpen(false)} onSaved={() => after('Venta registrada.')} />
      )}
      {selected && (
        <SaleDetailModal sale={selected} customerName={(selected.customer_id && customerName.get(selected.customer_id)) || null}
          onClose={() => setSelected(null)} onCancelled={() => after(`Venta #${selected.sale_number} cancelada. El stock fue devuelto.`)} />
      )}
    </>
  )
}
