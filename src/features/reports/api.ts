import { supabase } from '../../lib/supabase'
import type { MovementRow } from '../inventory/api'
import type { Sale, SalesReport } from '../../lib/types'
import { SALE_COLUMNS } from '../sales/api'

const AR_OFFSET = '-03:00' // Argentina no usa horario de verano
const CHUNK = 1000
const MAX_ROWS = 10000

export async function getSalesReport(businessId: string, from: string, to: string): Promise<SalesReport> {
  const { data, error } = await supabase.rpc('sales_report', { p_business_id: businessId, p_from: from, p_to: to })
  if (error) throw error
  return data as SalesReport
}

/** Todas las ventas del período (confirmadas y canceladas) para exportar. Tope de seguridad: 10.000. */
export async function fetchSalesForExport(businessId: string, from: string, to: string): Promise<{ rows: Sale[]; truncated: boolean }> {
  const rows: Sale[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    const { data, error } = await supabase
      .from('sales').select(SALE_COLUMNS).eq('business_id', businessId)
      .gte('sold_at', `${from}T00:00:00${AR_OFFSET}`).lte('sold_at', `${to}T23:59:59.999${AR_OFFSET}`)
      .order('sold_at', { ascending: true }).order('sale_number', { ascending: true })
      .range(offset, offset + CHUNK - 1)
    if (error) throw error
    rows.push(...((data ?? []) as Sale[]))
    if (!data || data.length < CHUNK) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

export async function fetchMovementsForExport(businessId: string, from: string, to: string): Promise<{ rows: MovementRow[]; truncated: boolean }> {
  const rows: MovementRow[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
    const { data, error } = await supabase
      .from('stock_movements_detail')
      .select('id, product_id, product_name, product_sku, movement_type, quantity_delta, stock_after, reason, created_at')
      .eq('business_id', businessId)
      .gte('created_at', `${from}T00:00:00${AR_OFFSET}`).lte('created_at', `${to}T23:59:59.999${AR_OFFSET}`)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + CHUNK - 1)
    if (error) throw error
    rows.push(...((data ?? []) as MovementRow[]))
    if (!data || data.length < CHUNK) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}
