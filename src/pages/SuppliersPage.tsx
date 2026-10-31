import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Search, SearchX, Trash2, Truck } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import type { Supplier } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier, type SupplierInput } from '../features/suppliers/api'
import { listProducts } from '../features/products/api'

function SupplierForm({ businessId, supplier, onClose, onSaved }: { businessId: string; supplier: Supplier | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [v, setV] = useState({ name: supplier?.name ?? '', contact: supplier?.contact_name ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', notes: supplier?.notes ?? '' })
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setV((x) => ({ ...x, [k]: e.target.value }))

  async function submit(e: FormEvent) {
    e.preventDefault()
    const er: typeof errors = {}
    if (!v.name.trim()) er.name = 'Ingresá el nombre comercial.'
    if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) er.email = 'Ingresá un email válido.'
    setErrors(er)
    if (Object.keys(er).length) return
    const input: SupplierInput = { name: v.name.trim(), contact_name: v.contact.trim() || null, phone: v.phone.trim() || null, email: v.email.trim() || null, notes: v.notes.trim() || null }
    setSaving(true)
    setFormError(null)
    try {
      if (supplier) await updateSupplier(businessId, supplier.id, input)
      else await createSupplier(businessId, input)
      onSaved(supplier ? 'Cambios guardados.' : 'Proveedor creado.')
    } catch (err) { setFormError(friendlyError(err)); setSaving(false) }
  }

  return (
    <Modal title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={onClose} locked={saving}
      footer={<><Button onClick={onClose} disabled={saving}>Cancelar</Button><Button variant="primary" type="submit" form="supplier-form" loading={saving}>{supplier ? 'Guardar cambios' : 'Crear proveedor'}</Button></>}>
      <form id="supplier-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre comercial" htmlFor="su-name" error={errors.name}><input id="su-name" className={`input ${errors.name ? 'input-error' : ''}`} value={v.name} onChange={set('name')} maxLength={120} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Persona de contacto" htmlFor="su-contact" optional><input id="su-contact" className="input" value={v.contact} onChange={set('contact')} maxLength={120} /></Field>
          <Field label="Teléfono" htmlFor="su-phone" optional><input id="su-phone" className="input" inputMode="tel" value={v.phone} onChange={set('phone')} maxLength={40} /></Field>
        </div>
        <Field label="Email" htmlFor="su-email" error={errors.email} optional><input id="su-email" type="email" className={`input ${errors.email ? 'input-error' : ''}`} value={v.email} onChange={set('email')} maxLength={160} /></Field>
        <Field label="Observaciones" htmlFor="su-notes" optional><textarea id="su-notes" rows={2} className="input" value={v.notes} onChange={set('notes')} maxLength={500} placeholder="Condiciones de pago, días de entrega, etc." /></Field>
        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
      </form>
    </Modal>
  )
}

export default function SuppliersPage() {
  const business = useBusiness()
  const toast = useToast()
  const sup = useLoad(() => listSuppliers(business.id), [business.id])
  const prods = useLoad(() => listProducts(business.id), [business.id])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ supplier: Supplier | null } | null>(null)
  const [toDelete, setToDelete] = useState<Supplier | null>(null)
  const [deleting, setDeleting] = useState(false)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of prods.data ?? []) if (p.supplier_id) m.set(p.supplier_id, (m.get(p.supplier_id) ?? 0) + 1)
    return m
  }, [prods.data])
  const reload = () => { sup.reload(); prods.reload() }
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (sup.data ?? []).filter((s) => !q || [s.name, s.contact_name, s.phone, s.email].some((x) => (x ?? '').toLowerCase().includes(q)))
  }, [sup.data, search])

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteSupplier(business.id, toDelete.id)
      toast.success(`Proveedor "${toDelete.name}" eliminado.`)
      setToDelete(null)
      reload()
    } catch (err) { toast.error(friendlyError(err)) } finally { setDeleting(false) }
  }

  const loading = (sup.loading && !sup.data) || (prods.loading && !prods.data)
  const error = sup.error ?? prods.error
  const total = sup.data?.length ?? 0
  return (
    <>
      <PageHeader title="Proveedores" subtitle={sup.data ? `${total} ${total === 1 ? 'proveedor' : 'proveedores'}` : undefined}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ supplier: null })}>Nuevo proveedor</Button>} />
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 p-4">
          <div className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input className="input pl-9" placeholder="Buscar proveedor" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Buscar proveedores" /></div>
        </div>
        {loading ? <div className="space-y-3 p-4" role="status" aria-label="Cargando proveedores">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          : error ? <ErrorState message={error} onRetry={reload} />
          : total === 0 ? <EmptyState icon={<Truck size={22} />} title="Todavía no cargaste proveedores" description="Registrá a quiénes les comprás para asociarlos a tus productos y, más adelante, registrar compras de mercadería."
              action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => setForm({ supplier: null })}>Crear primer proveedor</Button>} />
          : filtered.length === 0 ? <EmptyState icon={<SearchX size={22} />} title="No hay resultados" description="Ningún proveedor coincide con la búsqueda." action={<Button onClick={() => setSearch('')}>Limpiar búsqueda</Button>} />
          : (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((s) => {
                const n = counts.get(s.id) ?? 0
                return (
                  <li key={s.id} className="flex items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.name}</p>
                      <p className="truncate text-sm text-neutral-500">{[s.contact_name, s.phone, s.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                      {s.notes && <p className="truncate text-xs text-neutral-400">{s.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right text-sm">
                      {n > 0 ? <Link to={`/productos?proveedor=${s.id}`} className="font-semibold text-brand-700 hover:underline">{n} {n === 1 ? 'producto' : 'productos'}</Link> : <span className="text-neutral-500">0 productos</span>}
                    </div>
                    <button type="button" className="btn btn-ghost p-2" onClick={() => setForm({ supplier: s })} aria-label={`Editar ${s.name}`}><Pencil size={16} /></button>
                    <button type="button" className="btn btn-ghost p-2 hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(s)} aria-label={`Eliminar ${s.name}`}><Trash2 size={16} /></button>
                  </li>
                )
              })}
            </ul>
          )}
      </div>
      {form && <SupplierForm businessId={business.id} supplier={form.supplier} onClose={() => setForm(null)} onSaved={(m) => { setForm(null); toast.success(m); reload() }} />}
      {toDelete && <ConfirmDialog title="Eliminar proveedor" confirmLabel="Eliminar" loading={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
        message={(counts.get(toDelete.id) ?? 0) > 0 ? `"${toDelete.name}" tiene ${counts.get(toDelete.id)} producto(s) asociado(s). No se borran: quedan sin proveedor. ¿Continuar?` : `¿Eliminar al proveedor "${toDelete.name}"?`} />}
    </>
  )
}
