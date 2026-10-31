import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageOpen, Pencil, Plus, Search, SearchX, Trash2 } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import { formatARS, formatPercent, grossMarginPercent } from '../lib/money'
import { formatDate } from '../lib/dates'
import type { Category, Product } from '../lib/types'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { archiveProduct, listCategories, listProducts } from '../features/products/api'
import { listSuppliers } from '../features/suppliers/api'
import ProductFormModal from '../features/products/ProductFormModal'

type Availability = 'all' | 'ok' | 'low' | 'out'

function stockTone(p: Product): { tone: 'green' | 'amber' | 'red'; label: string } {
  if (p.stock_quantity === 0) return { tone: 'red', label: 'Sin stock' }
  if (p.stock_quantity <= p.min_stock) return { tone: 'amber', label: 'Stock bajo' }
  return { tone: 'green', label: 'Disponible' }
}

export default function ProductsPage() {
  const business = useBusiness()
  const toast = useToast()
  const products = useLoad(() => listProducts(business.id), [business.id])
  const cats = useLoad(() => listCategories(business.id), [business.id])
  const suppliers = useLoad(() => listSuppliers(business.id), [business.id])
  const [extraCats, setExtraCats] = useState<Category[]>([])
  const [params] = useSearchParams()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [availability, setAvailability] = useState<Availability>('all')
  const [supplierFilter, setSupplierFilter] = useState(params.get('proveedor') ?? '')

  const [editing, setEditing] = useState<Product | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState(false)

  const categories = useMemo(() => {
    const all = [...(cats.data ?? []), ...extraCats.filter((e) => !(cats.data ?? []).some((c) => c.id === e.id))]
    return all.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [cats.data, extraCats])
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (products.data ?? []).filter((p) => {
      if (q && !(p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q))) return false
      if (categoryFilter === '__none') { if (p.category_id) return false }
      else if (categoryFilter && p.category_id !== categoryFilter) return false
      if (supplierFilter && p.supplier_id !== supplierFilter) return false
      if (availability === 'out') return p.stock_quantity === 0
      if (availability === 'low') return p.stock_quantity > 0 && p.stock_quantity <= p.min_stock
      if (availability === 'ok') return p.stock_quantity > p.min_stock
      return true
    })
  }, [products.data, search, categoryFilter, availability, supplierFilter])

  const hasFilters = search.trim() !== '' || categoryFilter !== '' || availability !== 'all' || supplierFilter !== ''
  const total = products.data?.length ?? 0

  function openNew() { setEditing(null); setFormOpen(true) }
  function openEdit(p: Product) { setEditing(p); setFormOpen(true) }

  function onSaved(message: string) {
    setFormOpen(false)
    toast.success(message)
    products.reload()
  }

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await archiveProduct(business.id, toDelete.id)
      toast.success(`"${toDelete.name}" se eliminó.`)
      setToDelete(null)
      products.reload()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Productos"
        subtitle={products.data ? `${total} ${total === 1 ? 'producto registrado' : 'productos registrados'}` : undefined}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={openNew}>Nuevo producto</Button>}
      />

      <div className="card overflow-hidden">
        {/* Filtros */}
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              className="input pl-9"
              placeholder="Buscar producto, SKU o código"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar productos"
            />
          </div>
          <select className="input md:w-52" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filtrar por categoría">
            <option value="">Todas las categorías</option>
            <option value="__none">Sin categoría</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="input md:w-48" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} aria-label="Filtrar por proveedor">
            <option value="">Todos los proveedores</option>
            {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="input md:w-48" value={availability} onChange={(e) => setAvailability(e.target.value as Availability)} aria-label="Filtrar por disponibilidad">
            <option value="all">Toda disponibilidad</option>
            <option value="ok">Disponible</option>
            <option value="low">Stock bajo</option>
            <option value="out">Sin stock</option>
          </select>
        </div>

        {products.loading && !products.data ? (
          <div className="space-y-3 p-4" role="status" aria-label="Cargando productos">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : products.error ? (
          <ErrorState message={products.error} onRetry={products.reload} />
        ) : total === 0 ? (
          <EmptyState
            icon={<PackageOpen size={22} />}
            title="Todavía no cargaste productos"
            description="Agregá tu primer producto con su costo, precio y stock para empezar a controlar tu inventario."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={openNew}>Crear primer producto</Button>}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX size={22} />}
            title="No hay resultados"
            description="Ningún producto coincide con la búsqueda o los filtros elegidos."
            action={hasFilters ? <Button onClick={() => { setSearch(''); setCategoryFilter(''); setAvailability('all'); setSupplierFilter('') }}>Limpiar filtros</Button> : undefined}
          />
        ) : (
          <>
            {/* Tabla (tablet/escritorio) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-500">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Categoría</th>
                    <th className="px-4 py-3 text-right">Costo</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="hidden px-4 py-3 text-right xl:table-cell">Margen</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="hidden px-4 py-3 xl:table-cell">Modificado</th>
                    <th className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filtered.map((p) => {
                    const st = stockTone(p)
                    const m = grossMarginPercent(p.cost_cents, p.price_cents)
                    return (
                      <tr key={p.id} className="hover:bg-neutral-50/70">
                        <td className="px-4 py-3">
                          <p className="font-semibold">{p.name}</p>
                          <p className="text-xs text-neutral-500">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-neutral-600 lg:table-cell">{(p.category_id && categoryName.get(p.category_id)) || '—'}</td>
                        <td className="px-4 py-3 text-right text-neutral-600">{formatARS(p.cost_cents)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatARS(p.price_cents)}</td>
                        <td className="hidden px-4 py-3 text-right text-neutral-600 xl:table-cell">{m === null ? '—' : formatPercent(m)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold">{p.stock_quantity}</span>
                            <Badge tone={st.tone}>{st.label}</Badge>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-neutral-500 xl:table-cell">{formatDate(p.updated_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button type="button" className="btn btn-ghost p-2" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}><Pencil size={16} /></button>
                            <button type="button" className="btn btn-ghost p-2 hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(p)} aria-label={`Eliminar ${p.name}`}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Tarjetas (celular) */}
            <ul className="divide-y divide-neutral-100 md:hidden">
              {filtered.map((p) => {
                const st = stockTone(p)
                return (
                  <li key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{p.name}</p>
                        <p className="text-xs text-neutral-500">{p.sku}{p.category_id && categoryName.get(p.category_id) ? ` · ${categoryName.get(p.category_id)}` : ''}</p>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div className="text-sm">
                        <p className="font-semibold">{formatARS(p.price_cents)}</p>
                        <p className="text-xs text-neutral-500">Costo {formatARS(p.cost_cents)} · Stock {p.stock_quantity}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" className="btn btn-secondary p-2" onClick={() => openEdit(p)} aria-label={`Editar ${p.name}`}><Pencil size={16} /></button>
                        <button type="button" className="btn btn-secondary p-2 text-red-600" onClick={() => setToDelete(p)} aria-label={`Eliminar ${p.name}`}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500">
              Mostrando {filtered.length} de {total}. El margen es bruto estimado (antes de impuestos y gastos).
            </p>
          </>
        )}
      </div>

      {formOpen && (
        <ProductFormModal
          businessId={business.id}
          product={editing}
          categories={categories}
          suppliers={suppliers.data ?? []}
          onCategoryCreated={(c) => setExtraCats((l) => [...l, c])}
          onClose={() => setFormOpen(false)}
          onSaved={onSaved}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Eliminar producto"
          message={`¿Querés eliminar "${toDelete.name}"? Deja de aparecer en tu lista, pero las ventas y movimientos anteriores conservan su registro.`}
          confirmLabel="Eliminar"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}
