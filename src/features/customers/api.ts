import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type { CustomerFull, CustomerStats } from '../../lib/types'

export type CustomerRow = CustomerFull & CustomerStats

export interface CustomerInput {
  name: string
  phone: string | null
  email: string | null
  document: string | null
  notes: string | null
}

export async function listCustomersWithStats(businessId: string): Promise<CustomerRow[]> {
  const [c, s] = await Promise.all([
    supabase.from('customers').select('id, name, phone, email, document, notes').eq('business_id', businessId).order('name').limit(5000),
    supabase.from('customer_stats').select('customer_id, purchases_count, total_spent_cents, last_purchase_at').eq('business_id', businessId).limit(5000),
  ])
  if (c.error) throw c.error
  if (s.error) throw s.error
  const stats = new Map((s.data ?? []).map((r) => [r.customer_id as string, r]))
  return ((c.data ?? []) as CustomerFull[]).map((cu) => {
    const st = stats.get(cu.id)
    return {
      ...cu,
      purchases_count: Number(st?.purchases_count ?? 0),
      total_spent_cents: Number(st?.total_spent_cents ?? 0),
      last_purchase_at: (st?.last_purchase_at as string | null) ?? null,
    }
  })
}

export async function createCustomerFull(businessId: string, input: CustomerInput): Promise<void> {
  const { error } = await supabase.from('customers').insert({ business_id: businessId, ...input })
  if (error) throw error
}

export async function updateCustomer(businessId: string, id: string, input: CustomerInput): Promise<void> {
  const { data, error } = await supabase.from('customers').update(input).eq('id', id).eq('business_id', businessId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo guardar: el cliente ya no existe o no tenés permiso.')
}

/** Las ventas del cliente se conservan: pasan a figurar como "Consumidor final". */
export async function deleteCustomer(businessId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from('customers').delete().eq('id', id).eq('business_id', businessId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo eliminar: el cliente ya no existe o no tenés permiso.')
}
