import { supabase } from '../../lib/supabase'
import type { DashboardSummary } from '../../lib/types'

export async function getDashboard(businessId: string): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('dashboard_summary', { p_business_id: businessId })
  if (error) throw error
  return data as DashboardSummary
}
