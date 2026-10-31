import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Search, SearchX, Trash2, Users } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import { formatARS } from '../lib/money'
import { formatDate, formatDateTime } from '../lib/dates'
import { PAYMENT_LABELS } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Spinner } from '../components/ui/Feedback'
import { createCustomerFull, deleteCustomer, listCustomersWithStats, updateCustomer, type CustomerInput, type CustomerRow } from '../features/customers/api'
import { listCustomerSales } from '../features/sales/api'

function CustomerForm({ businessId, customer, onClose, onSaved }: {
  businessId: string; customer: CustomerRow | null; onClose: () => void; onSaved: (m: string) => void
}) {
  const [v, setV] = useState({
    name: customer?.name ?? '', phone: customer?.phone ?? '', email: customer?.email ?? '',
    document: customer?.document ?? '', notes: customer?.notes ?? '',
  })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const er: typeof errors = {}
    if (!v.name.trim()) er.name = 'Ingresá el nombre del cliente.'
    if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) er.email = 'Ingresá un email válido.'
    setErrors(er)
    if (Object.keys(er).length) return
    const input: CustomerInput = {
      name: v.name.trim(), phone: v.phone.trim() || null, email: v.email.trim() || null,
      document: v.document.trim() || null, notes: v.notes.trim() || null,
    }
    setSaving(true)
    setFormError(null)
    try {
      if (customer) await updateCustomer(businessId, customer.id, input)
      else await createCustomerFull(businessId, input)
      onSaved(customer ? 'Cambios guardados.' : 'Cliente creado.')
    } catch (err) {
      setFormError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={customer ? 'Editar cliente' : 'Nuevo cliente'} onClose={onClose} locked={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" type="submit" form="customer-form" loading={saving}>{customer ? 'Guardar cambios' : 'Crear cliente'}</Button></>}>
      <form id="customer-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="cu-name" error={errors.name}>
          <input id="cu-name" className={`input ${errors.name ? 'input-error' : ''}`} value={v.name} onChange={set('name')} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono" htmlFor="cu-phone" optional><input id="cu-phone" className="input" inputMode="tel" value={v.phone} onChange={set('phone')} maxLength={40} /></Field>
          <Field label="DNI / CUIT" htmlFor="cu-doc" optional><input id="cu-doc" className="input" value={v.document} onChange={set('document')} maxLength={30} /></Field>
        </div>
        <Field label="Email" htmlFor="cu-email" error={errors.email} optional>
          <input id="cu-email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={v.email} onChange={set('email')} maxLength={160} />
        </Field>
        <Field label="Observaciones" htmlFor="cu-notes" optional><textarea id="cu-notes" rows={2} className="input" value={v.notes} onChange={set('notes')} maxLength={500} /></Field>
        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
      </form>
    </Modal>
  )
}

function CustomerDetail({ businessId, customer, onClose, onEdit }: { businessId: string; customer: CustomerRow; onClose: () => void; onEdit: () => void }) {
  const sales = useLoad(() => listCustomerSales(businessId, customer.id), [customer.id])
  return (
    <Modal title={customer.name} size="lg" onClose={onClose} footer={<><Button onClick={onEdit} icon={<Pencil size={15} />}>Editar</Button><Button onClick={onClose}>Cerrar</Button></>}>
      <div className="space-y-5">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {[['Teléfono', customer.phone], ['Email', customer.email], ['DNI / CUIT', customer.document], ['Observaciones', customer.notes]].map(([k, val]) => (
            <div key={k as string}><dt className="text-xs text-neutral-500">{k}</dt><dd className="font-medium">{val || '—'}</dd></div>
          ))}
        </dl>
        <div className="grid grid-cols-3 gap-3">
          {[['Compras', String(customer.purchases_count)], ['Total comprado', formatARS(customer.total_spent_cents)],
            ['Última compra', customer.last_purchase_at ? formatDate(customer.last_purchase_at) : '—']].map(([k, val]) => (
            <div key={k} className="rounded-lg bg-neutral-50 px-3 py-2.5"><p className="text-xs text-neutral-500">{k}</p><p className="mt-0.5 text-sm font-bold sm:text-base">{val}</p></div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">Historial de compras</h3>
          {sales.loading ? <Spinner /> : sales.error ? <ErrorState message={sales.error} onRetry={sales.reload} /> : (sales.data ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500">Este cliente todavía no tiene compras registradas.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {(sales.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div><p className="font-semibold">Venta #{s.sale_number}</p><p className="text-xs text-neutral-500">{formatDateTime(s.sold_at)} · {PAYMENT_LABELS[s.payment_method]}</p></div>
                  <div className="text-right"><p className={`font-semibold ${s.status === 'cancelled' ? 'text-neutral-400 line-through' : ''}`}>{formatARS(s.total_cents)}</p>
                    {s.status === 'cancelled' && <Badge tone="red">Cancelada</Badge>}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-neutral-500">Solo las ventas confirmadas suman al total comprado.</p>
        </div>
      </div>
    </Modal>
  )
}

export default function CustomersPage() {
  const business = useBusiness()
  const toast = useToast()
  const { data, loading, error, reload } = useLoad(() => listCustomersWithStats(business.id), [business.id])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ customer: CustomerRow | null } | null>(null)
  const [detail, setDetail] = useState<CustomerRow | null>(null)
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((c) => !q || [c.name, c.phone, c.email, c.document].some((x) => (x ?? '').toLowerCase().includes(q)))
  }, [data, search])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteCustomer(business.id, toDelete.id)
      toast.success(`Cliente "${toDelete.name}" eliminado.`)
      setToDelete(null)
      reload()
    } catch (err) { toast.error(friendlyError(err)) } finally { setDeleting(false) }
  }

  const total = data?.length ?? 0
  return (
    <>
      <PageHeader title="Clientes" subtitle={data ? `${total} ${total === 1 ? 'cliente' : 'clientes'}` : undefined}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ customer: null })}>Nuevo cliente</Button>} />
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-4">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input className="input pl-9" placeholder="Buscar por nombre, teléfono, email o documento" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar clientes" />
          </div>
        </div>
        {loading && !data ? (
          <div className="space-y-3 p-4" role="status" aria-label="Cargando clientes">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? <ErrorState message={error} onRetry={reload} /> : total === 0 ? (
          <EmptyState icon={<Users size={22} />} title="Todavía no cargaste clientes" description="Guardá los datos de tus clientes para asociarlos a sus compras y ver su historial."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ customer: null })}>Crear primer cliente</Button>} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<SearchX size={22} />} title="No hay resultados" description="Ningún cliente coincide con la búsqueda." action={<Button onClick={() => setSearch('')}>Limpiar búsqueda</Button>} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-3">
                <button type="button" onClick={() => setDetail(c)} className="min-w-0 flex-1 text-left" aria-label={`Ver historial de ${c.name}`}>
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-neutral-500">{[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                </button>
                <div className="hidden shrink-0 text-right text-sm sm:block">
                  <p className="font-semibold">{formatARS(c.total_spent_cents)}</p>
                  <p className="text-xs text-neutral-500">{c.purchases_count} {c.purchases_count === 1 ? 'compra' : 'compras'}{c.last_purchase_at ? ` · última ${formatDate(c.last_purchase_at)}` : ''}</p>
                </div>
                <button type="button" className="btn btn-ghost p-2" onClick={() => setForm({ customer: c })} aria-label={`Editar ${c.name}`}><Pencil size={16} /></button>
                <button type="button" className="btn btn-ghost p-2 hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(c)} aria-label={`Eliminar ${c.name}`}><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {form && <CustomerForm businessId={business.id} customer={form.customer} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); setDetail(null); toast.success(m); reload() }} />}
      {detail && !form && <CustomerDetail businessId={business.id} customer={detail} onClose={() => setDetail(null)} onEdit={() => setForm({ customer: detail })} />}
      {toDelete && <ConfirmDialog title="Eliminar cliente" confirmLabel="Eliminar" loading={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
        message={`¿Eliminar a "${toDelete.name}"? Sus ${toDelete.purchases_count} compra(s) se conservan en el historial de ventas como "Consumidor final".`} />}
    </>
  )
}
