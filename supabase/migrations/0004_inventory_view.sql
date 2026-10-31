-- =====================================================================
-- 0004 · Vista del historial de inventario (movimientos + nombre/SKU del producto)
-- security_invoker: respeta RLS del usuario que consulta.
-- =====================================================================
create view public.stock_movements_detail with (security_invoker = true) as
select m.id, m.business_id, m.product_id,
       p.name as product_name, p.sku as product_sku,
       m.movement_type, m.quantity_delta, m.stock_after, m.reason, m.sale_id, m.created_at
from public.stock_movements m
join public.products p on p.id = m.product_id and p.business_id = m.business_id;

grant select on public.stock_movements_detail to authenticated;
