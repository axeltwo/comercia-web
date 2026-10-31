import { supabase } from '../../lib/supabase'
import type { Customer, PaymentMethod, Sale, SaleItem } from '../../lib/types'

export const PAGE_SIZE = 30
const AR_OFFSET = '-03:00' // Argentina no usa horario de verano

export interface SaleFilters {
  status: '' | 'completed' | 'cancelled'
  /** Número de venta (opcional) */
  number: string
  from: string
  to: string
}

export const SALE_COLUMNS =
  'id, sale_number, customer_id, status, payment_method, subtotal_cents, discount_cents, total_cents, cost_total_cents, notes, sold_at, cancelled_at, cancel_reason'

export async function listSales(businessId: string, f: SaleFilters, offset: number): Promise<Sale[]> {
  let q = supabase
    .from('sales')
    .select(SALE_COLUMNS)
    .eq('business_id', businessId)
    .order('sold_at', { ascending: false })
    .order('sale_number', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)
  if (f.status) q = q.eq('status', f.status)
  if (f.from) q = q.gte('sold_at', `${f.from}T00:00:00${AR_OFFSET}`)
  if (f.to) q = q.lte('sold_at', `${f.to}T23:59:59.999${AR_OFFSET}`)
  const n = f.number.trim().replace(/^#/, '')
  if (/^\d{1,12}$/.test(n)) q = q.eq('sale_number', Number(n))
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as Sale[]
}

export async function listSaleItems(saleId: string): Promise<SaleItem[]> {
  const { data, error } = await supabase
    .from('sale_items')
    .select('id, product_id, product_name, product_sku, quantity, unit_price_cents, unit_cost_cents, line_total_cents')
    .eq('sale_id', saleId)
    .order('product_name', { ascending: true })
  if (error) throw error
  return (data ?? []) as SaleItem[]
}

export interface NewSaleInput {
  clientRequestId: string
  customerId: string | null
  paymentMethod: PaymentMethod
  discountCents: number
  notes: string | null
  items: { product_id: string; quantity: number }[]
}

/**
 * Una sola llamada = una sola transacción en la base. Precio y costo los toma el servidor del producto;
 * clientRequestId hace que reintentar la misma venta no duplique nada.
 */
export async function createSale(businessId: string, s: NewSaleInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_business_id: businessId,
    p_client_request_id: s.clientRequestId,
    p_customer_id: s.customerId,
    p_payment_method: s.paymentMethod,
    p_discount_cents: s.discountCents,
    p_notes: s.notes,
    p_items: s.items,
  })
  if (error) throw error
  return data as string
}

export async function cancelSale(saleId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_sale', { p_sale_id: saleId, p_reason: reason.trim() })
  if (error) throw error
}

export async function listCustomers(businessId: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
    .limit(2000)
  if (error) throw error
  return (data ?? []) as Customer[]
}

export async function createCustomer(businessId: string, name: string, phone: string | null): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({ business_id: businessId, name: name.trim(), phone })
    .select('id, name, phone')
    .single()
  if (error) throw error
  return data as Customer
}

/** Historial de compras de un cliente (hasta 500, de la más reciente a la más antigua). */
export async function listCustomerSales(businessId: string, customerId: string): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(SALE_COLUMNS)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('sold_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as Sale[]
}
