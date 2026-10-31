import { supabase } from '../../lib/supabase'
import type { MovementType } from '../../lib/types'

export interface MovementRow {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  movement_type: MovementType
  quantity_delta: number
  stock_after: number
  reason: string | null
  created_at: string
}

export interface MovementFilters {
  search: string
  type: '' | MovementType
  /** YYYY-MM-DD (hora de Argentina) */
  from: string
  to: string
}

export const PAGE_SIZE = 30

// Argentina no usa horario de verano: UTC-3 fijo.
const AR_OFFSET = '-03:00'

export async function listMovements(businessId: string, f: MovementFilters, offset: number): Promise<MovementRow[]> {
  let q = supabase
    .from('stock_movements_detail')
    .select('id, product_id, product_name, product_sku, movement_type, quantity_delta, stock_after, reason, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (f.type) q = q.eq('movement_type', f.type)
  if (f.from) q = q.gte('created_at', `${f.from}T00:00:00${AR_OFFSET}`)
  if (f.to) q = q.lte('created_at', `${f.to}T23:59:59.999${AR_OFFSET}`)
  // Se quitan caracteres que tienen significado especial en los filtros de la API.
  const term = f.search.trim().replace(/[,()%*\\]/g, ' ').trim()
  if (term) q = q.or(`product_name.ilike.%${term}%,product_sku.ilike.%${term}%`)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as MovementRow[]
}

/** entry/exit: cantidad positiva. adjustment: cantidad con signo. El servidor valida todo otra vez. */
export async function registerMovement(
  businessId: string, productId: string, type: 'entry' | 'exit' | 'adjustment', quantity: number, reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('register_stock_movement', {
    p_business_id: businessId,
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    p_reason: reason.trim() || null,
  })
  if (error) throw error
}
