import { parseMoneyToCents } from '../../lib/money'
import type { ProductInput } from './api'

export interface ProductFormValues {
  name: string
  sku: string
  barcode: string
  categoryId: string
  supplierId: string
  description: string
  cost: string
  price: string
  minStock: string
  initialStock: string
}

export type FormErrors = Partial<Record<keyof ProductFormValues, string>>

function parseCount(value: string): number | null {
  const v = value.trim()
  if (v === '') return 0
  if (!/^\d{1,9}$/.test(v)) return null
  return Number(v)
}

export function validateProduct(
  v: ProductFormValues,
  isNew: boolean,
): { errors: FormErrors; input?: ProductInput; initialStock: number } {
  const errors: FormErrors = {}
  const name = v.name.trim()
  const sku = v.sku.trim()
  const barcode = v.barcode.trim()

  if (!name) errors.name = 'Ingresá el nombre del producto.'
  else if (name.length > 160) errors.name = 'El nombre es demasiado largo (máximo 160 caracteres).'
  if (!sku) errors.sku = 'Ingresá un SKU o código interno.'
  else if (sku.length > 60) errors.sku = 'Máximo 60 caracteres.'
  if (barcode.length > 60) errors.barcode = 'Máximo 60 caracteres.'

  const cost = v.cost.trim() === '' ? 0 : parseMoneyToCents(v.cost)
  const price = parseMoneyToCents(v.price)
  if (cost === null) errors.cost = 'Ingresá un importe válido. Ej.: 1.250,50'
  if (v.price.trim() === '') errors.price = 'Ingresá el precio de venta.'
  else if (price === null) errors.price = 'Ingresá un importe válido. Ej.: 2.500'

  const minStock = parseCount(v.minStock)
  if (minStock === null) errors.minStock = 'Ingresá un número entero (0 o más).'
  const initialStock = isNew ? parseCount(v.initialStock) : 0
  if (initialStock === null) errors.initialStock = 'Ingresá un número entero (0 o más).'

  if (Object.keys(errors).length > 0 || cost === null || price === null || minStock === null || initialStock === null) {
    return { errors, initialStock: 0 }
  }
  return {
    errors,
    initialStock,
    input: {
      name,
      sku,
      barcode: barcode || null,
      category_id: v.categoryId || null,
      supplier_id: v.supplierId || null,
      description: v.description.trim() || null,
      cost_cents: cost,
      price_cents: price,
      min_stock: minStock,
    },
  }
}
