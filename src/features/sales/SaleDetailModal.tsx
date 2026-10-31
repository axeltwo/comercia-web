import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Field'
import { Badge, ErrorState, Spinner } from '../../components/ui/Feedback'
import { useLoad } from '../../lib/useLoad'
import { formatARS } from '../../lib/money'
import { formatDateTime } from '../../lib/dates'
import { friendlyError } from '../../lib/errors'
import { PAYMENT_LABELS, type Sale } from '../../lib/types'
import { cancelSale, listSaleItems } from './api'

interface Props {
  sale: Sale
  customerName: string | null
  onClose: () => void
  onCancelled: () => void
}

export default function SaleDetailModal({ sale, customerName, onClose, onCancelled }: Props) {
  const items = useLoad(() => listSaleItems(sale.id), [sale.id])
  const [cancelling, setCancelling] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function doCancel() {
    if (reason.trim().length < 3) return setError('Indicá el motivo de la cancelación.')
    setBusy(true)
    setError(null)
    try {
      await cancelSale(sale.id, reason)
      onCancelled()
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  const profit = sale.total_cents - sale.cost_total_cents
  const cancelled = sale.status === 'cancelled'

  return (
    <Modal title={`Venta #${sale.sale_number}`} size="lg" onClose={onClose} locked={busy}
      footer={cancelling ? (
        <>
          <Button onClick={() => { setCancelling(false); setError(null) }} disabled={busy}>Volver</Button>
          <Button variant="danger" onClick={doCancel} loading={busy}>Confirmar cancelación</Button>
        </>
      ) : (
        <>
          <Button onClick={onClose}>Cerrar</Button>
          {!cancelled && <Button variant="danger" onClick={() => setCancelling(true)}>Cancelar venta</Button>}
        </>
      )}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-600">
          <Badge tone={cancelled ? 'red' : 'green'}>{cancelled ? 'Cancelada' : 'Confirmada'}</Badge>
          <span>{formatDateTime(sale.sold_at)}</span>
          <span>{PAYMENT_LABELS[sale.payment_method]}</span>
          <span>{customerName ?? 'Consumidor final'}</span>
        </div>

        {cancelled && (
          <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800">
            Cancelada el {sale.cancelled_at ? formatDateTime(sale.cancelled_at) : ''}. Motivo: {sale.cancel_reason}. El stock fue devuelto al inventario.
          </p>
        )}

        {items.loading ? <Spinner /> : items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
                <tr><th className="px-3 py-2.5">Producto</th><th className="px-3 py-2.5 text-right">Cant.</th><th className="px-3 py-2.5 text-right">Precio</th><th className="px-3 py-2.5 text-right">Subtotal</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {(items.data ?? []).map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2.5"><p className="font-medium">{i.product_name}</p><p className="text-xs text-neutral-500">{i.product_sku}</p></td>
                    <td className="px-3 py-2.5 text-right">{i.quantity}</td>
                    <td className="px-3 py-2.5 text-right">{formatARS(i.unit_price_cents)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatARS(i.line_total_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <dl className="space-y-1.5 rounded-lg bg-neutral-50 px-4 py-3 text-sm">
          <div className="flex justify-between"><dt className="text-neutral-600">Subtotal</dt><dd>{formatARS(sale.subtotal_cents)}</dd></div>
          {sale.discount_cents > 0 && <div className="flex justify-between"><dt className="text-neutral-600">Descuento</dt><dd>− {formatARS(sale.discount_cents)}</dd></div>}
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-bold"><dt>Total</dt><dd>{formatARS(sale.total_cents)}</dd></div>
          <div className="flex justify-between text-xs text-neutral-500"><dt>Costo de la mercadería (histórico)</dt><dd>{formatARS(sale.cost_total_cents)}</dd></div>
          <div className="flex justify-between text-xs text-neutral-500"><dt>Ganancia bruta estimada</dt><dd>{formatARS(profit)}</dd></div>
        </dl>
        {sale.notes && <p className="text-sm text-neutral-600"><span className="font-medium text-neutral-800">Nota:</span> {sale.notes}</p>}
        <p className="text-xs text-neutral-500">Precios y costos son los vigentes al momento de la venta; no cambian si luego editás el producto.</p>

        {cancelling && (
          <Field label="Motivo de la cancelación" htmlFor="cancel-reason" error={error ?? undefined}>
            <input id="cancel-reason" className={`input ${error ? 'input-error' : ''}`} autoFocus maxLength={200} value={reason}
              onChange={(e) => { setReason(e.target.value); setError(null) }} placeholder="Ej.: Devolución del cliente" />
            <p className="mt-1.5 text-[13px] text-neutral-500">Se devolverá el stock al inventario. La venta queda registrada como cancelada.</p>
          </Field>
        )}
        {!cancelling && error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  )
}
