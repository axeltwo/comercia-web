import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type { Supplier } from '../../lib/types'

export interface SupplierInput {
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

export async function listSuppliers(businessId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, phone, email, notes')
    .eq('business_id', businessId)
    .order('name')
    .limit(2000)
  if (error) throw error
  return (data ?? []) as Supplier[]
}

export async function createSupplier(businessId: string, input: SupplierInput): Promise<void> {
  const { error } = await supabase.from('suppliers').insert({ business_id: businessId, ...input })
  if (error) throw error
}

export async function updateSupplier(businessId: string, id: string, input: SupplierInput): Promise<void> {
  const { data, error } = await supabase.from('suppliers').update(input).eq('id', id).eq('business_id', businessId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo guardar: el proveedor ya no existe o no tenés permiso.')
}

/** Los productos del proveedor no se borran: quedan "sin proveedor" (lo resuelve la base). */
export async function deleteSupplier(businessId: string, id: string): Promise<void> {
  const { data, error } = await supabase.from('suppliers').delete().eq('id', id).eq('business_id', businessId).select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo eliminar: el proveedor ya no existe o no tenés permiso.')
}
