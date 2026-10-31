-- =====================================================================
-- 0005 · Reportes, estadísticas de clientes y proveedor en el alta de producto
-- =====================================================================

-- ---------- Estadísticas por cliente (solo ventas confirmadas) ----------
create view public.customer_stats with (security_invoker = true) as
select c.id as customer_id, c.business_id,
       count(s.id) filter (where s.status = 'completed') as purchases_count,
       coalesce(sum(s.total_cents) filter (where s.status = 'completed'), 0)::bigint as total_spent_cents,
       max(s.sold_at) filter (where s.status = 'completed') as last_purchase_at
from public.customers c
left join public.sales s on s.customer_id = c.id and s.business_id = c.business_id
group by c.id;
grant select on public.customer_stats to authenticated;

-- ---------- Alta de producto: ahora admite proveedor ----------
-- Se reemplaza la función (cambia la firma) y se vuelven a dar los permisos.
drop function public.create_product(uuid, text, text, text, uuid, text, bigint, bigint, integer, integer);

create function public.create_product(
  p_business_id uuid, p_name text, p_sku text, p_barcode text, p_category_id uuid,
  p_description text, p_cost_cents bigint, p_price_cents bigint,
  p_min_stock integer, p_initial_stock integer, p_supplier_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform public.assert_member(p_business_id);
  if char_length(btrim(coalesce(p_name, ''))) = 0 then raise exception 'El nombre es obligatorio.'; end if;
  if char_length(btrim(coalesce(p_sku, ''))) = 0 then raise exception 'El SKU es obligatorio.'; end if;
  if p_cost_cents is null or p_cost_cents < 0 or p_price_cents is null or p_price_cents < 0 then
    raise exception 'Los precios no pueden ser negativos.';
  end if;
  if coalesce(p_min_stock, 0) < 0 or coalesce(p_initial_stock, 0) < 0 then
    raise exception 'Las cantidades no pueden ser negativas.';
  end if;

  insert into public.products (business_id, category_id, supplier_id, name, sku, barcode, description,
                               cost_cents, price_cents, min_stock)
  values (p_business_id, p_category_id, p_supplier_id, btrim(p_name), btrim(p_sku), nullif(btrim(p_barcode), ''),
          nullif(btrim(p_description), ''), p_cost_cents, p_price_cents, coalesce(p_min_stock, 0))
  returning id into v_id;

  if coalesce(p_initial_stock, 0) > 0 then
    perform public.apply_stock_movement(p_business_id, v_id, 'initial', p_initial_stock, 'Stock inicial');
  end if;
  return v_id;
end $$;

revoke all on function public.create_product(uuid, text, text, text, uuid, text, bigint, bigint, integer, integer, uuid) from public, anon;
grant execute on function public.create_product(uuid, text, text, text, uuid, text, bigint, bigint, integer, integer, uuid) to authenticated;

-- ---------- Reporte de ventas por período (fechas en hora de Argentina) ----------
-- Ingresos = ventas confirmadas. Ganancia bruta = ingresos − costo histórico de lo vendido.
-- No incluye impuestos, comisiones ni gastos: NO es ganancia neta.
create function public.sales_report(p_business_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_from timestamptz; v_to timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'El rango de fechas no es válido.';
  end if;
  if p_to - p_from > 366 then
    raise exception 'El período no puede superar un año.';
  end if;
  v_from := p_from::timestamp at time zone tz;
  v_to := (p_to + 1)::timestamp at time zone tz;

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'sales_count',     count(*) filter (where status = 'completed'),
        'revenue_cents',   coalesce(sum(total_cents) filter (where status = 'completed'), 0),
        'subtotal_cents',  coalesce(sum(subtotal_cents) filter (where status = 'completed'), 0),
        'discount_cents',  coalesce(sum(discount_cents) filter (where status = 'completed'), 0),
        'cost_cents',      coalesce(sum(cost_total_cents) filter (where status = 'completed'), 0),
        'cancelled_count', count(*) filter (where status = 'cancelled'),
        'cancelled_cents', coalesce(sum(total_cents) filter (where status = 'cancelled'), 0))
      from public.sales
      where business_id = p_business_id and sold_at >= v_from and sold_at < v_to),
    'by_day', coalesce((
      select jsonb_agg(t order by t.date) from (
        select (sold_at at time zone tz)::date as date, count(*) as count,
               sum(total_cents) as revenue_cents, sum(cost_total_cents) as cost_cents
        from public.sales
        where business_id = p_business_id and status = 'completed' and sold_at >= v_from and sold_at < v_to
        group by 1) t), '[]'::jsonb),
    'by_payment', coalesce((
      select jsonb_agg(t order by t.revenue_cents desc) from (
        select payment_method, count(*) as count, sum(total_cents) as revenue_cents
        from public.sales
        where business_id = p_business_id and status = 'completed' and sold_at >= v_from and sold_at < v_to
        group by payment_method) t), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.product_id, i.product_name as name, i.product_sku as sku,
               sum(i.quantity)::integer as quantity,
               sum(i.line_total_cents) as revenue_cents,
               sum(i.quantity * i.unit_cost_cents) as cost_cents
        from public.sale_items i join public.sales s on s.id = i.sale_id
        where s.business_id = p_business_id and s.status = 'completed' and s.sold_at >= v_from and s.sold_at < v_to
        group by i.product_id, i.product_name, i.product_sku
        order by sum(i.quantity) desc, i.product_name limit 20) t), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(t) from (
        select movement_type, count(*) as count, sum(abs(quantity_delta))::integer as units
        from public.stock_movements
        where business_id = p_business_id and created_at >= v_from and created_at < v_to
        group by movement_type order by movement_type) t), '[]'::jsonb)
  );
end $$;

revoke all on function public.sales_report(uuid, date, date) from public, anon;
grant execute on function public.sales_report(uuid, date, date) to authenticated;
