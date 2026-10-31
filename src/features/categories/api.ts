import { supabase } from '../../lib/supabase'
import { AppError } from '../../lib/errors'
import type { Category } from '../../lib/types'

export { listCategories, createCategory } from '../products/api'

export async function updateCategory(businessId: string, id: string, name: string, description: string | null): Promise<void> {
  const { data, error } = await supabase
    .from('categories')
    .update({ name: name.trim(), description })
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo guardar: la categoría ya no existe o no tenés permiso.')
}

/** Los productos de la categoría NO se borran: quedan "sin categoría" (lo resuelve la base). */
export async function deleteCategory(businessId: string, id: string): Promise<void> {
  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
    .select('id')
  if (error) throw error
  if (!data || data.length === 0) throw new AppError('No se pudo eliminar: la categoría ya no existe o no tenés permiso.')
}

export async function createCategoryFull(businessId: string, name: string, description: string | null): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ business_id: businessId, name: name.trim(), description })
    .select('id, name, description')
    .single()
  if (error) throw error
  return data as Category
}
