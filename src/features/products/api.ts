import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type { Category, Product } from '../../lib/types'

const PRODUCT_COLUMNS =
  'id, business_id, category_id, supplier_id, name, sku, barcode, description, cost_cents, price_cents, stock_quantity, min_stock, created_at, updated_at'

export async function listProducts(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_COLUMNS)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(2000)
  if (error) throw error
  return (data ?? []) as Product[]
}

export async function listCategories(businessId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('business_id', businessId)
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function createCategory(businessId: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, name: name.trim() })
    .select('id, name, description')
    .single()
  if (error) throw error
  return data as Category
}

export interface ProductInput {
  name: string
  sku: string
  barcode: string | null
  category_id: string | null
  supplier_id: string | null
  description: string | null
  cost_cents: number
  price_cents: number
  min_stock: number
}

/** Alta vía función SQL: crea el producto y registra el stock inicial como movimiento auditable. */
export async function createProduct(businessId: string, input: ProductInput, initialStock: number): Promise<string> {
  const { data, error } = await supabase.rpc('create_product', {
    p_business_id: businessId,
    p_name: input.name,
    p_sku: input.sku,
    p_barcode: input.barcode,
    p_category_id: input.category_id,
    p_description: input.description,
    p_cost_cents: input.cost_cents,
    p_price_cents: input.price_cents,
    p_min_stock: input.min_stock,
    p_initial_stock: initialStock,
    p_supplier_id: input.supplier_id,
  })
  if (error) throw error
  return data as string
}

/** El stock NO se edita acá: solo cambia con movimientos de inventario. */
export async function updateProduct(businessId: string, id: string, input: ProductInput): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .update(input)
    .eq('id', id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .select('id')
  if (error) throw error
  // Si RLS o un filtro no encontró la fila, Supabase no da error: lo verificamos para no simular un guardado.
  if (!data || data.length === 0) throw new AppError('No se pudo guardar: el producto ya no existe o no tenés permiso.')
}

/** "Eliminar" = archivar. El historial de ventas y movimientos conserva el producto. */
export async function archiveProduct(businessId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo eliminar: el producto ya no existe o no tenés permiso.')
}
