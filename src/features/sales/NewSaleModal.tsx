import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Minus, Plus, Search, Trash2, UserPlus } from 'lucide-react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { formatARS, parseMoneyToCents } from '../../lib/money'
import { friendlyError } from '../../lib/errors'
import { PAYMENT_LABELS, type Customer, type PaymentMethod, type Product } from '../../lib/types'
import { createCustomer, createSale } from './api'

interface Line { product: Product; qty: string }

interface Props {
  businessId: string
  products: Product[]
  customers: Customer[]
  onCustomerCreated: (c: Customer) => void
  onClose: () => void
  onSaved: () => void
}

const validQty = (l: Line) => /^\d{1,6}$/.test(l.qty) && Number(l.qty) >= 1 && Number(l.qty) <= l.product.stock_quantity

export default function NewSaleModal({ businessId, products, customers, onCustomerCreated, onClose, onSaved }: Props) {
  // Se genera UNA vez al abrir: si se reintenta la confirmación, el servidor reconoce la misma venta y no la duplica.
  const requestId = useRef(crypto.randomUUID())
  const [search, setSearch] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState('')
  const [notes, setNotes] = useState('')
  const [newCustomer, setNewCustomer] = useState<{ name: string; phone: string } | null>(null)
  const [busyCustomer, setBusyCustomer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [products, search])

  const subtotal = lines.reduce((s, l) => s + (validQty(l) ? Number(l.qty) * l.product.price_cents : 0), 0)
  const cost = lines.reduce((s, l) => s + (validQty(l) ? Number(l.qty) * l.product.cost_cents : 0), 0)
  const discountCents = discount.trim() === '' ? 0 : parseMoneyToCents(discount)
  const discountError =
    discountCents === null ? 'Ingresá un importe válido.' : discountCents > subtotal ? 'El descuento no puede superar el subtotal.' : undefined
  const total = subtotal - (discountCents !== null && !discountError ? discountCents : 0)
  const allValid = lines.length > 0 && lines.every(validQty) && !discountError

  function add(p: Product) {
    if (p.stock_quantity <= 0) return
    setLines((ls) => {
      const i = ls.findIndex((l) => l.product.id === p.id)
      if (i >= 0) {
        const next = [...ls]
        next[i] = { ...next[i], qty: String(Math.min(p.stock_quantity, (Number(next[i].qty) || 0) + 1)) }
        return next
      }
      return [...ls, { product: p, qty: '1' }]
    })
    setSearch('')
    setError(null)
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const q = search.trim().toLowerCase()
    // Lector de código de barras: coincidencia exacta de código o SKU agrega directo
    const exact = products.find((p) => (p.barcode ?? '').toLowerCase() === q || p.sku.toLowerCase() === q)
    const pick = exact ?? (results.length === 1 ? results[0] : undefined)
    if (pick) add(pick)
  }

  const setQty = (id: string, qty: string) => setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, qty: qty.replace(/\D/g, '').slice(0, 6) } : l)))
  const step = (id: string, d: number) =>
    setLines((ls) => ls.map((l) => (l.product.id === id ? { ...l, qty: String(Math.max(1, Math.min(l.product.stock_quantity, (Number(l.qty) || 0) + d))) } : l)))

  async function addCustomer() {
    if (!newCustomer || !newCustomer.name.trim()) return
    setBusyCustomer(true)
    try {
      const c = await createCustomer(businessId, newCustomer.name, newCustomer.phone.trim() || null)
      onCustomerCreated(c)
      setCustomerId(c.id)
      setNewCustomer(null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusyCustomer(false)
    }
  }

  async function confirm() {
    if (!allValid || saving) return
    setSaving(true)
    setError(null)
    try {
      await createSale(businessId, {
        clientRequestId: requestId.current,
        customerId: customerId || null,
        paymentMethod: method,
        discountCents: discountCents ?? 0,
        notes: notes.trim() || null,
        items: lines.map((l) => ({ product_id: l.product.id, quantity: Number(l.qty) })),
      })
      onSaved()
    } catch (err) {
      setError(friendlyError(err))
      setSaving(false)
    }
  }

  return (
    <Modal title="Nueva venta" size="lg" onClose={onClose} locked={saving}
      footer={<>
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={confirm} loading={saving} disabled={!allValid}>Confirmar venta · {formatARS(total)}</Button>
      </>}>
      <div className="space-y-5">
        {/* Buscador */}
        <div className="relative">
          <label htmlFor="sale-search" className="mb-1.5 block text-sm font-medium">Agregar producto</label>
          <Search size={16} className="pointer-events-none absolute left-3 top-[2.45rem] text-neutral-400" aria-hidden />
          <input id="sale-search" className="input pl-9" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={onSearchKey} placeholder="Nombre, SKU o escaneá el código de barras" />
          {search.trim() && (
            <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-pop" role="listbox">
              {results.length === 0 && <li className="px-3 py-3 text-sm text-neutral-500">No se encontraron productos.</li>}
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" disabled={p.stock_quantity <= 0} onClick={() => add(p)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="min-w-0"><span className="block truncate font-medium">{p.name}</span>
                      <span className="text-xs text-neutral-500">{p.sku} · {p.stock_quantity > 0 ? `stock ${p.stock_quantity}` : 'sin stock'}</span></span>
                    <span className="shrink-0 font-semibold">{formatARS(p.price_cents)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Carrito */}
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">
            Buscá y agregá los productos de la venta.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {lines.map((l) => {
              const ok = validQty(l)
              return (
                <li key={l.product.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-semibold">{l.product.name}</p>
                    <p className="text-xs text-neutral-500">{formatARS(l.product.price_cents)} c/u · stock {l.product.stock_quantity}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="btn btn-secondary p-1.5" onClick={() => step(l.product.id, -1)} aria-label={`Quitar una unidad de ${l.product.name}`}><Minus size={14} /></button>
                    <input value={l.qty} onChange={(e) => setQty(l.product.id, e.target.value)} inputMode="numeric" aria-label={`Cantidad de ${l.product.name}`}
                      className={`input w-16 text-center ${ok ? '' : 'input-error'}`} />
                    <button type="button" className="btn btn-secondary p-1.5" onClick={() => step(l.product.id, 1)} aria-label={`Agregar una unidad de ${l.product.name}`}><Plus size={14} /></button>
                  </div>
                  <p className="w-28 text-right text-sm font-semibold">{ok ? formatARS(Number(l.qty) * l.product.price_cents) : '—'}</p>
                  <button type="button" className="btn btn-ghost p-2 hover:!text-red-600" onClick={() => setLines((ls) => ls.filter((x) => x.product.id !== l.product.id))} aria-label={`Quitar ${l.product.name}`}><Trash2 size={16} /></button>
                  {!ok && <p role="alert" className="basis-full text-[13px] text-red-600">Cantidad entre 1 y {l.product.stock_quantity} (stock disponible).</p>}
                </li>
              )
            })}
          </ul>
        )}

        {/* Datos de la venta */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Método de pago" htmlFor="sale-method">
            <select id="sale-method" className="input" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Descuento (ARS)" htmlFor="sale-discount" error={discountError} optional>
            <input id="sale-discount" className={`input ${discountError ? 'input-error' : ''}`} inputMode="decimal" placeholder="0,00" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
        </div>

        <Field label="Cliente" htmlFor="sale-customer" optional>
          {newCustomer === null ? (
            <div className="flex gap-2">
              <select id="sale-customer" className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Consumidor final</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
              </select>
              <Button className="shrink-0" icon={<UserPlus size={16} />} onClick={() => setNewCustomer({ name: '', phone: '' })}>Nuevo</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="sale-customer" className="input" placeholder="Nombre" maxLength={120} autoFocus value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
              <input className="input sm:w-40" placeholder="Teléfono (opcional)" maxLength={40} inputMode="tel" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} aria-label="Teléfono" />
              <Button variant="dark" onClick={addCustomer} loading={busyCustomer} disabled={!newCustomer.name.trim()}>Agregar</Button>
              <Button onClick={() => setNewCustomer(null)} disabled={busyCustomer}>Cancelar</Button>
            </div>
          )}
        </Field>

        <Field label="Nota" htmlFor="sale-notes" optional>
          <input id="sale-notes" className="input" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {/* Totales */}
        <dl className="space-y-1.5 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-neutral-600">Subtotal</dt><dd>{formatARS(subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-neutral-600">Descuento</dt><dd>− {formatARS(discountCents !== null && !discountError ? discountCents : 0)}</dd></div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatARS(total)}</dd></div>
          <div className="flex justify-between text-xs text-neutral-500"><dt>Ganancia bruta estimada de esta venta</dt><dd>{formatARS(total - cost)}</dd></div>
        </dl>
        <p className="text-xs text-neutral-500">Los importes se confirman con los precios vigentes al registrar la venta. El stock se descuenta automáticamente.</p>

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}
