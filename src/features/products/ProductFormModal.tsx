import { useMemo, useState, type FormEvent } from 'react'
import { Plus, Info } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { centsToInput, formatARS, formatPercent, grossMarginPercent, parseMoneyToCents } from '../../lib/money'
import { friendlyError } from '../../lib/errors'
import type { Category, Product, Supplier } from '../../lib/types'
import { createCategory, createProduct, updateProduct } from './api'
import { validateProduct, type FormErrors, type ProductFormValues } from './validation'

interface Props {
  businessId: string
  product: Product | null
  categories: Category[]
  suppliers: Supplier[]
  onCategoryCreated: (c: Category) => void
  onClose: () => void
  onSaved: (message: string) => void
}

function initialValues(p: Product | null): ProductFormValues {
  return {
    name: p?.name ?? '',
    sku: p?.sku ?? '',
    barcode: p?.barcode ?? '',
    categoryId: p?.category_id ?? '',
    supplierId: p?.supplier_id ?? '',
    description: p?.description ?? '',
    cost: p ? centsToInput(p.cost_cents) : '',
    price: p ? centsToInput(p.price_cents) : '',
    minStock: p ? String(p.min_stock) : '0',
    initialStock: '0',
  }
}

export default function ProductFormModal({ businessId, product, categories, suppliers, onCategoryCreated, onClose, onSaved }: Props) {
  const isNew = product === null
  const [values, setValues] = useState<ProductFormValues>(() => initialValues(product))
  const [errors, setErrors] = useState<FormErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newCategory, setNewCategory] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)

  const set = (k: keyof ProductFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }))
  }
  const cls = (k: keyof ProductFormValues) => `input ${errors[k] ? 'input-error' : ''}`

  const margin = useMemo(() => {
    const cost = values.cost.trim() === '' ? 0 : parseMoneyToCents(values.cost)
    const price = parseMoneyToCents(values.price)
    if (cost === null || price === null || price <= 0) return null
    return { percent: grossMarginPercent(cost, price)!, unit: price - cost }
  }, [values.cost, values.price])

  async function addCategory() {
    const name = (newCategory ?? '').trim()
    if (!name) return
    setCreatingCategory(true)
    setFormError(null)
    try {
      const cat = await createCategory(businessId, name)
      onCategoryCreated(cat)
      setValues((v) => ({ ...v, categoryId: cat.id }))
      setNewCategory(null)
    } catch (err) {
      setFormError(friendlyError(err))
    } finally {
      setCreatingCategory(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const result = validateProduct(values, isNew)
    setErrors(result.errors)
    if (!result.input) return
    setSaving(true)
    try {
      if (isNew) {
        await createProduct(businessId, result.input, result.initialStock)
        onSaved('Producto creado.')
      } else {
        await updateProduct(businessId, product.id, result.input)
        onSaved('Cambios guardados.')
      }
    } catch (err) {
      setFormError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isNew ? 'Nuevo producto' : 'Editar producto'}
      onClose={onClose}
      size="lg"
      locked={saving}
      footer={
        <>
          <Button onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" form="product-form" loading={saving}>
            {isNew ? 'Crear producto' : 'Guardar cambios'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nombre" htmlFor="p-name" error={errors.name}>
          <input id="p-name" className={cls('name')} value={values.name} onChange={set('name')} maxLength={160}
            placeholder="Ej.: Perfume floral 100 ml" aria-invalid={!!errors.name} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU / código interno" htmlFor="p-sku" error={errors.sku}>
            <input id="p-sku" className={cls('sku')} value={values.sku} onChange={set('sku')} maxLength={60} placeholder="Ej.: PERF-001" />
          </Field>
          <Field label="Código de barras" htmlFor="p-barcode" error={errors.barcode} optional>
            <input id="p-barcode" className={cls('barcode')} value={values.barcode} onChange={set('barcode')}
              maxLength={60} inputMode="numeric" />
          </Field>
        </div>

        <Field label="Categoría" htmlFor="p-category" optional>
          {newCategory === null ? (
            <div className="flex gap-2">
              <select id="p-category" className="input" value={values.categoryId} onChange={set('categoryId')}>
                <option value="">Sin categoría</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={() => setNewCategory('')} icon={<Plus size={16} />} className="shrink-0">Nueva</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input id="p-category" className="input" value={newCategory} maxLength={80} autoFocus
                onChange={(e) => setNewCategory(e.target.value)} placeholder="Nombre de la nueva categoría"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addCategory() } }} />
              <Button variant="dark" onClick={addCategory} loading={creatingCategory} disabled={!newCategory.trim()}>Agregar</Button>
              <Button onClick={() => setNewCategory(null)} disabled={creatingCategory}>Cancelar</Button>
            </div>
          )}
        </Field>

        <Field label="Proveedor" htmlFor="p-supplier" optional>
          <select id="p-supplier" className="input" value={values.supplierId} onChange={set('supplierId')}>
            <option value="">Sin proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>

        <Field label="Descripción" htmlFor="p-desc" optional>
          <textarea id="p-desc" rows={2} className="input" value={values.description} onChange={set('description')} maxLength={1000} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Precio de costo (ARS)" htmlFor="p-cost" error={errors.cost}>
            <input id="p-cost" className={cls('cost')} value={values.cost} onChange={set('cost')} inputMode="decimal" placeholder="0,00" />
          </Field>
          <Field label="Precio de venta (ARS)" htmlFor="p-price" error={errors.price}>
            <input id="p-price" className={cls('price')} value={values.price} onChange={set('price')} inputMode="decimal" placeholder="0,00" />
          </Field>
        </div>

        <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[13px] text-neutral-600">
          <Info size={15} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
          {margin ? (
            <span>
              Margen bruto estimado: <strong className="text-neutral-900">{formatPercent(margin.percent)}</strong> ·
              diferencia por unidad: <strong className="text-neutral-900">{formatARS(margin.unit)}</strong>.
              Es antes de impuestos, comisiones y gastos del negocio.
            </span>
          ) : (
            <span>Cargá costo y precio de venta para ver el margen bruto estimado.</span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isNew ? (
            <Field label="Stock inicial" htmlFor="p-stock" error={errors.initialStock} hint="Se registra como movimiento de inventario.">
              <input id="p-stock" className={cls('initialStock')} value={values.initialStock} onChange={set('initialStock')} inputMode="numeric" />
            </Field>
          ) : (
            <Field label="Stock actual" htmlFor="p-stock" hint="Se modifica desde Inventario, para que quede registrado.">
              <input id="p-stock" className="input" value={product.stock_quantity} disabled readOnly />
            </Field>
          )}
          <Field label="Stock mínimo" htmlFor="p-min" error={errors.minStock} hint="Se avisa cuando el stock llega a este valor.">
            <input id="p-min" className={cls('minStock')} value={values.minStock} onChange={set('minStock')} inputMode="numeric" />
          </Field>
        </div>

        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
      </form>
    </Modal>
  )
}
