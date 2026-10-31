import { useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { friendlyError } from '../../lib/errors'
import type { Product } from '../../lib/types'
import { registerMovement } from './api'

type Kind = 'entry' | 'exit' | 'adjustment'
const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: 'entry', label: 'Entrada', help: 'Mercadería que ingresa (compra, reposición, devolución).' },
  { value: 'exit', label: 'Salida', help: 'Mercadería que sale sin ser una venta (muestra, regalo, uso propio).' },
  { value: 'adjustment', label: 'Ajuste', help: 'Corrige diferencias de conteo, roturas o pérdidas. Requiere motivo.' },
]

interface Props {
  businessId: string
  products: Product[]
  initialProductId?: string
  onClose: () => void
  onSaved: () => void
}

export default function MovementModal({ businessId, products, initialProductId, onClose, onSaved }: Props) {
  const [productId, setProductId] = useState(initialProductId ?? '')
  const [filter, setFilter] = useState('')
  const [kind, setKind] = useState<Kind>('entry')
  const [direction, setDirection] = useState<'up' | 'down'>('down')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [errors, setErrors] = useState<{ product?: string; qty?: string; reason?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return products.filter((p) => p.id === productId || !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
  }, [products, filter, productId])

  const product = products.find((p) => p.id === productId)
  const amount = /^\d{1,9}$/.test(qty.trim()) ? Number(qty.trim()) : null
  const delta = amount === null ? null : kind === 'entry' ? amount : kind === 'exit' ? -amount : direction === 'up' ? amount : -amount
  const resulting = product && delta !== null ? product.stock_quantity + delta : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const er: typeof errors = {}
    if (!product) er.product = 'Elegí un producto.'
    if (amount === null || amount <= 0) er.qty = 'Ingresá una cantidad entera mayor a 0.'
    if (kind === 'adjustment' && reason.trim().length < 3) er.reason = 'El motivo del ajuste es obligatorio.'
    if (!er.product && !er.qty && resulting !== null && resulting < 0) er.qty = `No alcanza el stock: hay ${product!.stock_quantity} y se intenta descontar ${Math.abs(delta!)}.`
    setErrors(er)
    if (Object.keys(er).length > 0 || !product || delta === null) return

    setSaving(true)
    try {
      await registerMovement(businessId, product.id, kind, kind === 'adjustment' ? delta : amount!, reason)
      onSaved()
    } catch (err) {
      setFormError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <Modal title="Registrar movimiento" onClose={onClose} locked={saving}
      footer={<>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" type="submit" form="movement-form" loading={saving}>Registrar</Button>
      </>}>
      <form id="movement-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Producto" htmlFor="m-product" error={errors.product}>
          <input className="input mb-2" placeholder="Filtrar por nombre o SKU" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar productos" />
          <select id="m-product" className={`input ${errors.product ? 'input-error' : ''}`} value={productId}
            onChange={(e) => { setProductId(e.target.value); setErrors((x) => ({ ...x, product: undefined })) }}>
            <option value="">Elegí un producto…</option>
            {options.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku} (stock {p.stock_quantity})</option>)}
          </select>
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-neutral-800">Tipo de movimiento</legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup">
            {KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={kind === k.value} onClick={() => setKind(k.value)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${kind === k.value ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100'}`}>
                {k.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-500">{KINDS.find((k) => k.value === kind)!.help}</p>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          {kind === 'adjustment' && (
            <Field label="Sentido del ajuste" htmlFor="m-dir">
              <select id="m-dir" className="input" value={direction} onChange={(e) => setDirection(e.target.value as 'up' | 'down')}>
                <option value="down">Restar (faltante, rotura)</option>
                <option value="up">Sumar (sobrante)</option>
              </select>
            </Field>
          )}
          <Field label="Cantidad" htmlFor="m-qty" error={errors.qty}>
            <input id="m-qty" className={`input ${errors.qty ? 'input-error' : ''}`} inputMode="numeric" value={qty}
              onChange={(e) => { setQty(e.target.value); setErrors((x) => ({ ...x, qty: undefined })) }} placeholder="0" />
          </Field>
        </div>

        <Field label={kind === 'adjustment' ? 'Motivo' : 'Motivo o nota'} htmlFor="m-reason" error={errors.reason} optional={kind !== 'adjustment'}>
          <input id="m-reason" className={`input ${errors.reason ? 'input-error' : ''}`} value={reason} maxLength={200}
            onChange={(e) => { setReason(e.target.value); setErrors((x) => ({ ...x, reason: undefined })) }}
            placeholder={kind === 'adjustment' ? 'Ej.: Conteo físico, producto roto' : kind === 'entry' ? 'Ej.: Compra a proveedor' : 'Ej.: Muestra para cliente'} />
        </Field>

        {product && resulting !== null && (
          <p className={`rounded-lg px-3 py-2.5 text-[13px] ${resulting < 0 ? 'bg-red-50 text-red-700' : 'bg-neutral-50 text-neutral-600'}`}>
            Stock actual <strong>{product.stock_quantity}</strong> → quedaría en <strong>{resulting}</strong>
            {resulting < 0 ? ' (no permitido)' : resulting <= product.min_stock ? ' · quedaría en o bajo el mínimo' : ''}
          </p>
        )}
        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
      </form>
    </Modal>
  )
}
