import { useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { useBusiness } from '../context/AuthContext'
import { useLoad } from '../lib/useLoad'
import { useToast } from '../components/ui/Toast'
import { friendlyError } from '../lib/errors'
import type { Category } from '../lib/types'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui/Feedback'
import { createCategoryFull, deleteCategory, listCategories, updateCategory } from '../features/categories/api'
import { listProducts } from '../features/products/api'

function CategoryForm({ businessId, category, onClose, onSaved }: {
  businessId: string; category: Category | null; onClose: () => void; onSaved: (m: string) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return setError('Ingresá el nombre de la categoría.')
    if (clean.length > 80) return setError('El nombre es demasiado largo (máximo 80 caracteres).')
    setSaving(true)
    setError(null)
    try {
      const desc = description.trim() || null
      if (category) await updateCategory(businessId, category.id, clean, desc)
      else await createCategoryFull(businessId, clean, desc)
      onSaved(category ? 'Cambios guardados.' : 'Categoría creada.')
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <Modal title={category ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose} locked={saving}
      footer={<>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" type="submit" form="category-form" loading={saving}>{category ? 'Guardar cambios' : 'Crear categoría'}</Button>
      </>}>
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="c-name" error={error ?? undefined}>
          <input id="c-name" className={`input ${error ? 'input-error' : ''}`} value={name} maxLength={80}
            onChange={(e) => { setName(e.target.value); setError(null) }} placeholder="Ej.: Perfumes" />
        </Field>
        <Field label="Descripción" htmlFor="c-desc" optional>
          <textarea id="c-desc" rows={2} className="input" value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </form>
    </Modal>
  )
}

export default function CategoriesPage() {
  const business = useBusiness()
  const toast = useToast()
  const cats = useLoad(() => listCategories(business.id), [business.id])
  const prods = useLoad(() => listProducts(business.id), [business.id])
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [toDelete, setToDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of prods.data ?? []) if (p.category_id) m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1)
    return m
  }, [prods.data])

  const reload = () => { cats.reload(); prods.reload() }
  const loading = (cats.loading && !cats.data) || (prods.loading && !prods.data)
  const error = cats.error ?? prods.error

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteCategory(business.id, toDelete.id)
      toast.success(`Categoría "${toDelete.name}" eliminada.`)
      setToDelete(null)
      reload()
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setDeleting(false)
    }
  }

  const list = cats.data ?? []
  const open = (c: Category | null) => { setEditing(c); setFormOpen(true) }

  return (
    <>
      <PageHeader title="Categorías" subtitle={cats.data ? `${list.length} ${list.length === 1 ? 'categoría' : 'categorías'}` : undefined}
        actions={<Button variant="primary" icon={<Plus size={16} />} onClick={() => open(null)}>Nueva categoría</Button>} />
      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-4" role="status" aria-label="Cargando categorías">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : list.length === 0 ? (
          <EmptyState icon={<Tags size={22} />} title="Todavía no hay categorías"
            description="Agrupá tus productos (perfumes, remeras, accesorios…) para encontrarlos y filtrarlos más rápido."
            action={<Button variant="primary" icon={<Plus size={16} />} onClick={() => open(null)}>Crear primera categoría</Button>} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {list.map((c) => {
              const n = counts.get(c.id) ?? 0
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="truncate text-sm text-neutral-500">
                      {n} {n === 1 ? 'producto' : 'productos'}{c.description ? ` · ${c.description}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="btn btn-ghost p-2" onClick={() => open(c)} aria-label={`Editar ${c.name}`}><Pencil size={16} /></button>
                    <button type="button" className="btn btn-ghost p-2 hover:!bg-red-50 hover:!text-red-600" onClick={() => setToDelete(c)} aria-label={`Eliminar ${c.name}`}><Trash2 size={16} /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {formOpen && <CategoryForm businessId={business.id} category={editing} onClose={() => setFormOpen(false)}
        onSaved={(m) => { setFormOpen(false); toast.success(m); reload() }} />}
      {toDelete && (
        <ConfirmDialog title="Eliminar categoría" confirmLabel="Eliminar" loading={deleting} onConfirm={confirmDelete} onCancel={() => setToDelete(null)}
          message={(counts.get(toDelete.id) ?? 0) > 0
            ? `"${toDelete.name}" tiene ${counts.get(toDelete.id)} producto(s). No se borran: quedan sin categoría. ¿Querés continuar?`
            : `¿Querés eliminar la categoría "${toDelete.name}"?`} />
      )}
    </>
  )
}
