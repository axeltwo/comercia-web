-- =====================================================================
-- 0003 · Funciones de negocio (atómicas; cada llamada es UNA transacción)
-- Todas son SECURITY DEFINER con search_path vacío y validan membresía internamente.
-- =====================================================================

create function public.assert_member(p_business_id uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Necesitás iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.business_members
                 where business_id = p_business_id and user_id = (select auth.uid())) then
    raise exception 'No tenés acceso a este negocio.' using errcode = '42501';
  end if;
end $$;

-- ---------- Alta de negocio (primer ingreso) ----------
create function public.create_business(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_id uuid; v_name text := btrim(coalesce(p_name, ''));
begin
  if v_uid is null then raise exception 'Necesitás iniciar sesión.' using errcode = '28000'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'El nombre del negocio debe tener entre 2 y 120 caracteres.';
  end if;
  -- Etapa 1: un negocio por usuario (la estructura ya admite varios).
  if exists (select 1 from public.business_members where user_id = v_uid) then
    raise exception 'Tu usuario ya tiene un negocio creado.';
  end if;
  insert into public.businesses (name, created_by) values (v_name, v_uid) returning id into v_id;
  insert into public.business_members (business_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end $$;

-- ---------- Núcleo del stock (interna: NO expuesta a clientes) ----------
-- Bloquea la fila del producto (FOR UPDATE), rechaza stock negativo y deja el movimiento escrito.
create function public.apply_stock_movement(
  p_business_id uuid, p_product_id uuid, p_type text, p_delta integer,
  p_reason text default null, p_sale_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_stock integer; v_name text; v_new integer; v_mov uuid;
begin
  select stock_quantity, name into v_stock, v_name
  from public.products where id = p_product_id and business_id = p_business_id
  for update;
  if not found then raise exception 'El producto no existe.'; end if;

  v_new := v_stock + p_delta;
  if v_new < 0 then
    raise exception 'Stock insuficiente para "%": disponible %, se intentó descontar %.',
      v_name, v_stock, abs(p_delta);
  end if;

  update public.products set stock_quantity = v_new where id = p_product_id;
  insert into public.stock_movements
    (business_id, product_id, movement_type, quantity_delta, stock_after, reason, sale_id, created_by)
  values (p_business_id, p_product_id, p_type, p_delta, v_new, nullif(btrim(p_reason), ''),
          p_sale_id, (select auth.uid()))
  returning id into v_mov;
  return v_mov;
end $$;

-- ---------- Alta de producto (con stock inicial auditado) ----------
create function public.create_product(
  p_business_id uuid, p_name text, p_sku text, p_barcode text, p_category_id uuid,
  p_description text, p_cost_cents bigint, p_price_cents bigint,
  p_min_stock integer, p_initial_stock integer
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

  insert into public.products (business_id, category_id, name, sku, barcode, description,
                               cost_cents, price_cents, min_stock)
  values (p_business_id, p_category_id, btrim(p_name), btrim(p_sku), nullif(btrim(p_barcode), ''),
          nullif(btrim(p_description), ''), p_cost_cents, p_price_cents, coalesce(p_min_stock, 0))
  returning id into v_id;

  if coalesce(p_initial_stock, 0) > 0 then
    perform public.apply_stock_movement(p_business_id, v_id, 'initial', p_initial_stock, 'Stock inicial');
  end if;
  return v_id;
end $$;

-- ---------- Movimientos manuales de inventario ----------
-- entry: p_quantity > 0 suma · exit: p_quantity > 0 resta · adjustment: p_quantity con signo (motivo obligatorio)
create function public.register_stock_movement(
  p_business_id uuid, p_product_id uuid, p_type text, p_quantity integer, p_reason text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_delta integer;
begin
  perform public.assert_member(p_business_id);
  if p_quantity is null or p_quantity = 0 then raise exception 'La cantidad debe ser distinta de cero.'; end if;

  if p_type = 'entry' then
    if p_quantity < 0 then raise exception 'Una entrada debe tener cantidad positiva.'; end if;
    v_delta := p_quantity;
  elsif p_type = 'exit' then
    if p_quantity < 0 then raise exception 'Una salida debe tener cantidad positiva.'; end if;
    v_delta := -p_quantity;
  elsif p_type = 'adjustment' then
    if char_length(btrim(coalesce(p_reason, ''))) < 3 then
      raise exception 'El motivo del ajuste es obligatorio.';
    end if;
    v_delta := p_quantity;
  else
    raise exception 'Tipo de movimiento inválido.';
  end if;
  return public.apply_stock_movement(p_business_id, p_product_id, p_type, v_delta, p_reason);
end $$;

-- ---------- Venta ----------
-- p_items: [{"product_id": "...", "quantity": 2}, ...]  (el precio y costo SIEMPRE salen de la base)
-- p_client_request_id: UUID generado por la pantalla; reintentar la misma venta no duplica nada.
create function public.create_sale(
  p_business_id uuid, p_client_request_id uuid, p_customer_id uuid, p_payment_method text,
  p_discount_cents bigint, p_notes text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid; v_sale uuid; v_number bigint;
  v_subtotal bigint := 0; v_cost bigint := 0; v_discount bigint := coalesce(p_discount_cents, 0);
  v_elem jsonb; r record; p record; v_line bigint;
begin
  perform public.assert_member(p_business_id);
  if p_client_request_id is null then raise exception 'Falta el identificador de la operación.'; end if;

  select id into v_existing from public.sales
   where business_id = p_business_id and client_request_id = p_client_request_id;
  if found then return v_existing; end if;   -- ya registrada: no se repite

  if p_payment_method is null or p_payment_method not in ('cash', 'transfer', 'card', 'other') then
    raise exception 'Método de pago inválido.';
  end if;
  if v_discount < 0 then raise exception 'El descuento no puede ser negativo.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta debe tener al menos un producto.';
  end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Demasiados renglones en una venta.'; end if;

  for v_elem in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_elem) <> 'object'
       or coalesce(v_elem->>'product_id', '') !~* '^[0-9a-f-]{36}$'
       or coalesce(v_elem->>'quantity', '') !~ '^[0-9]{1,6}$'
       or (v_elem->>'quantity')::integer < 1 then
      raise exception 'Renglón de venta inválido.';
    end if;
  end loop;

  -- Número correlativo por negocio. También serializa ventas del mismo negocio (seguro y suficiente para pymes).
  update public.businesses set next_sale_number = next_sale_number + 1
   where id = p_business_id returning next_sale_number - 1 into v_number;

  begin
    insert into public.sales (business_id, sale_number, customer_id, payment_method, notes,
                              client_request_id, created_by)
    values (p_business_id, v_number, p_customer_id, p_payment_method, nullif(btrim(p_notes), ''),
            p_client_request_id, (select auth.uid()))
    returning id into v_sale;
  exception when unique_violation then
    -- Otra petición con la misma clave ganó la carrera: devolvemos esa venta.
    select id into v_existing from public.sales
     where business_id = p_business_id and client_request_id = p_client_request_id;
    if found then return v_existing; end if;
    raise;
  end;

  -- Productos agrupados y en orden fijo (evita deadlocks entre ventas simultáneas)
  for r in
    select (e->>'product_id')::uuid as product_id, sum((e->>'quantity')::integer)::integer as qty
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select id, name, sku, price_cents, cost_cents, deleted_at into p
      from public.products where id = r.product_id and business_id = p_business_id for update;
    if not found then raise exception 'Uno de los productos no existe.'; end if;
    if p.deleted_at is not null then
      raise exception 'El producto "%" fue eliminado y no se puede vender.', p.name;
    end if;

    v_line := r.qty * p.price_cents;
    insert into public.sale_items (business_id, sale_id, product_id, product_name, product_sku,
                                   quantity, unit_price_cents, unit_cost_cents, line_total_cents)
    values (p_business_id, v_sale, p.id, p.name, p.sku, r.qty, p.price_cents, p.cost_cents, v_line);

    perform public.apply_stock_movement(p_business_id, p.id, 'sale', -r.qty,
                                        'Venta #' || v_number, v_sale);
    v_subtotal := v_subtotal + v_line;
    v_cost := v_cost + r.qty * p.cost_cents;
  end loop;

  if v_discount > v_subtotal then raise exception 'El descuento no puede superar el subtotal.'; end if;

  update public.sales set subtotal_cents = v_subtotal, discount_cents = v_discount,
         total_cents = v_subtotal - v_discount, cost_total_cents = v_cost
   where id = v_sale;
  return v_sale;
end $$;

-- ---------- Cancelación de venta (devuelve stock, deja registro) ----------
create function public.cancel_sale(p_sale_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare s record; i record;
begin
  select id, business_id, status, sale_number into s from public.sales where id = p_sale_id for update;
  if not found then raise exception 'La venta no existe.'; end if;
  perform public.assert_member(s.business_id);
  if s.status = 'cancelled' then raise exception 'La venta ya estaba cancelada.'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'El motivo de la cancelación es obligatorio.'; end if;

  for i in select product_id, sum(quantity)::integer as qty from public.sale_items
           where sale_id = p_sale_id group by product_id order by product_id
  loop
    perform public.apply_stock_movement(s.business_id, i.product_id, 'sale_cancel', i.qty,
                                        'Cancelación venta #' || s.sale_number, p_sale_id);
  end loop;

  update public.sales set status = 'cancelled', cancelled_at = now(),
         cancelled_by = (select auth.uid()), cancel_reason = btrim(p_reason)
   where id = p_sale_id;
end $$;

-- ---------- Resumen del dashboard (SECURITY INVOKER: respeta RLS) ----------
-- "Ingresos" = ventas confirmadas (no canceladas). NO es caja cobrada ni ganancia neta.
create function public.dashboard_summary(p_business_id uuid) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_today date := (now() at time zone tz)::date;
  v_today_start timestamptz := v_today::timestamp at time zone tz;
  v_tomorrow timestamptz := (v_today + 1)::timestamp at time zone tz;
  v_month_start timestamptz := date_trunc('month', v_today::timestamp) at time zone tz;
  v_from timestamptz := (v_today - 13)::timestamp at time zone tz;
  v_result jsonb;
begin
  select jsonb_build_object(
    'products_count', (select count(*) from public.products
                        where business_id = p_business_id and deleted_at is null),
    'low_stock_count', (select count(*) from public.products
                         where business_id = p_business_id and deleted_at is null
                           and stock_quantity <= min_stock),
    'out_of_stock_count', (select count(*) from public.products
                            where business_id = p_business_id and deleted_at is null and stock_quantity = 0),
    'today_sales_count', (select count(*) from public.sales
                           where business_id = p_business_id and status = 'completed'
                             and sold_at >= v_today_start and sold_at < v_tomorrow),
    'today_total_cents', (select coalesce(sum(total_cents), 0) from public.sales
                           where business_id = p_business_id and status = 'completed'
                             and sold_at >= v_today_start and sold_at < v_tomorrow),
    'month_revenue_cents', (select coalesce(sum(total_cents), 0) from public.sales
                             where business_id = p_business_id and status = 'completed'
                               and sold_at >= v_month_start and sold_at < v_tomorrow),
    'month_cost_cents', (select coalesce(sum(cost_total_cents), 0) from public.sales
                          where business_id = p_business_id and status = 'completed'
                            and sold_at >= v_month_start and sold_at < v_tomorrow),
    'daily', (
      select jsonb_agg(jsonb_build_object('date', d.day, 'total_cents', coalesce(x.total, 0),
                                          'count', coalesce(x.cnt, 0)) order by d.day)
      from (select (v_today - n) as day from generate_series(0, 13) n) d
      left join (
        select (sold_at at time zone tz)::date as day, sum(total_cents) as total, count(*) as cnt
        from public.sales
        where business_id = p_business_id and status = 'completed' and sold_at >= v_from and sold_at < v_tomorrow
        group by 1
      ) x on x.day = d.day),
    'top_products', coalesce((
      select jsonb_agg(t) from (
        select i.product_id, i.product_name as name, sum(i.quantity)::integer as quantity,
               sum(i.line_total_cents) as revenue_cents
        from public.sale_items i join public.sales s on s.id = i.sale_id
        where s.business_id = p_business_id and s.status = 'completed'
          and s.sold_at >= v_month_start and s.sold_at < v_tomorrow
        group by i.product_id, i.product_name order by sum(i.quantity) desc, i.product_name limit 5) t), '[]'::jsonb),
    'recent_movements', coalesce((
      select jsonb_agg(t) from (
        select m.id, m.movement_type, m.quantity_delta, m.stock_after, m.reason, m.created_at,
               p.name as product_name
        from public.stock_movements m join public.products p on p.id = m.product_id
        where m.business_id = p_business_id order by m.created_at desc, m.id limit 8) t), '[]'::jsonb),
    'low_stock_products', coalesce((
      select jsonb_agg(t) from (
        select id, name, sku, stock_quantity, min_stock from public.products
        where business_id = p_business_id and deleted_at is null and stock_quantity <= min_stock
        order by stock_quantity - min_stock, name limit 6) t), '[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;

-- ---------- Permisos de ejecución ----------
revoke all on function public.assert_member(uuid) from public, anon, authenticated;
revoke all on function public.apply_stock_movement(uuid, uuid, text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.create_business(text) from public, anon;
revoke all on function public.create_product(uuid, text, text, text, uuid, text, bigint, bigint, integer, integer) from public, anon;
revoke all on function public.register_stock_movement(uuid, uuid, text, integer, text) from public, anon;
revoke all on function public.create_sale(uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon;
revoke all on function public.cancel_sale(uuid, text) from public, anon;
revoke all on function public.dashboard_summary(uuid) from public, anon;
revoke all on function public.current_business_ids() from public, anon;

grant execute on function public.current_business_ids() to authenticated;
grant execute on function public.create_business(text) to authenticated;
grant execute on function public.create_product(uuid, text, text, text, uuid, text, bigint, bigint, integer, integer) to authenticated;
grant execute on function public.register_stock_movement(uuid, uuid, text, integer, text) to authenticated;
grant execute on function public.create_sale(uuid, uuid, uuid, text, bigint, text, jsonb) to authenticated;
grant execute on function public.cancel_sale(uuid, text) to authenticated;
grant execute on function public.dashboard_summary(uuid) to authenticated;
