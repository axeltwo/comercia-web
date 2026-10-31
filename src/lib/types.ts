export interface Category {
  id: string
  name: string
  description: string | null
}

export interface Product {
  id: string
  business_id: string
  category_id: string | null
  supplier_id: string | null
  name: string
  sku: string
  barcode: string | null
  description: string | null
  cost_cents: number
  price_cents: number
  stock_quantity: number
  min_stock: number
  created_at: string
  updated_at: string
}

export type MovementType = 'initial' | 'entry' | 'exit' | 'adjustment' | 'sale' | 'sale_cancel'

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  initial: 'Stock inicial',
  entry: 'Entrada',
  exit: 'Salida',
  adjustment: 'Ajuste',
  sale: 'Venta',
  sale_cancel: 'Venta cancelada',
}

export interface DashboardSummary {
  products_count: number
  low_stock_count: number
  out_of_stock_count: number
  today_sales_count: number
  today_total_cents: number
  month_revenue_cents: number
  month_cost_cents: number
  daily: { date: string; total_cents: number; count: number }[]
  top_products: { product_id: string; name: string; quantity: number; revenue_cents: number }[]
  recent_movements: {
    id: string
    movement_type: MovementType
    quantity_delta: number
    stock_after: number
    reason: string | null
    created_at: string
    product_name: string
  }[]
  low_stock_products: { id: string; name: string; sku: string; stock_quantity: number; min_stock: number }[]
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'other'

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
}

export interface Customer {
  id: string
  name: string
  phone: string | null
}

export interface Sale {
  id: string
  sale_number: number
  customer_id: string | null
  status: 'completed' | 'cancelled'
  payment_method: PaymentMethod
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  cost_total_cents: number
  notes: string | null
  sold_at: string
  cancelled_at: string | null
  cancel_reason: string | null
}

export interface SaleItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  quantity: number
  unit_price_cents: number
  unit_cost_cents: number
  line_total_cents: number
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

export interface CustomerFull extends Customer {
  email: string | null
  document: string | null
  notes: string | null
}

export interface CustomerStats {
  purchases_count: number
  total_spent_cents: number
  last_purchase_at: string | null
}

export interface SalesReport {
  summary: {
    sales_count: number
    revenue_cents: number
    subtotal_cents: number
    discount_cents: number
    cost_cents: number
    cancelled_count: number
    cancelled_cents: number
  }
  by_day: { date: string; count: number; revenue_cents: number; cost_cents: number }[]
  by_payment: { payment_method: PaymentMethod; count: number; revenue_cents: number }[]
  top_products: { product_id: string; name: string; sku: string; quantity: number; revenue_cents: number; cost_cents: number }[]
  movements: { movement_type: MovementType; count: number; units: number }[]
}
