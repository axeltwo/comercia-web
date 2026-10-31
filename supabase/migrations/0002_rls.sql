-- =====================================================================
-- 0002 · Row Level Security y permisos
-- Regla: un usuario solo ve/toca filas de los negocios de los que es miembro.
-- Lo sensible (stock, ventas) NO se escribe con INSERT/UPDATE directo: solo vía funciones.
-- =====================================================================

-- Devuelve los negocios del usuario autenticado. SECURITY DEFINER evita recursión de RLS.
create function public.current_business_ids() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select business_id from public.business_members where user_id = (select auth.uid())
$$;

alter table public.businesses       enable row level security;
alter table public.business_members enable row level security;
alter table public.categories       enable row level security;
alter table public.suppliers        enable row level security;
alter table public.customers        enable row level security;
alter table public.products         enable row level security;
alter table public.sales            enable row level security;
alter table public.sale_items       enable row level security;
alter table public.stock_movements  enable row level security;

-- Cerrar todo por defecto y abrir solo lo necesario
revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from public, anon;

-- businesses / members: lectura; el dueño puede renombrar. La creación va por create_business().
create policy businesses_select on public.businesses for select to authenticated
  using (id in (select public.current_business_ids()));
create policy businesses_update on public.businesses for update to authenticated
  using (exists (select 1 from public.business_members m
                 where m.business_id = id and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (true);
grant select on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;

create policy members_select on public.business_members for select to authenticated
  using (business_id in (select public.current_business_ids()));
grant select on public.business_members to authenticated;

-- categorías, proveedores, clientes: CRUD completo dentro del propio negocio
create policy categories_all on public.categories for all to authenticated
  using (business_id in (select public.current_business_ids()))
  with check (business_id in (select public.current_business_ids()));
grant select, delete on public.categories to authenticated;
grant insert (business_id, name, description) on public.categories to authenticated;
grant update (name, description) on public.categories to authenticated;

create policy suppliers_all on public.suppliers for all to authenticated
  using (business_id in (select public.current_business_ids()))
  with check (business_id in (select public.current_business_ids()));
grant select, delete on public.suppliers to authenticated;
grant insert (business_id, name, contact_name, phone, email, notes) on public.suppliers to authenticated;
grant update (name, contact_name, phone, email, notes) on public.suppliers to authenticated;

create policy customers_all on public.customers for all to authenticated
  using (business_id in (select public.current_business_ids()))
  with check (business_id in (select public.current_business_ids()));
grant select, delete on public.customers to authenticated;
grant insert (business_id, name, phone, email, document, notes) on public.customers to authenticated;
grant update (name, phone, email, document, notes) on public.customers to authenticated;

-- productos: lectura y edición de datos comerciales. stock_quantity y business_id NO son editables.
-- Alta vía create_product(); "eliminar" = poner deleted_at.
create policy products_select on public.products for select to authenticated
  using (business_id in (select public.current_business_ids()));
create policy products_update on public.products for update to authenticated
  using (business_id in (select public.current_business_ids()))
  with check (business_id in (select public.current_business_ids()));
grant select on public.products to authenticated;
grant update (category_id, supplier_id, name, sku, barcode, description,
              cost_cents, price_cents, min_stock, deleted_at) on public.products to authenticated;

-- ventas, detalle y movimientos: SOLO lectura. Se escriben únicamente con funciones.
create policy sales_select on public.sales for select to authenticated
  using (business_id in (select public.current_business_ids()));
create policy sale_items_select on public.sale_items for select to authenticated
  using (business_id in (select public.current_business_ids()));
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (business_id in (select public.current_business_ids()));
grant select on public.sales, public.sale_items, public.stock_movements to authenticated;
grant select on public.stock_audit to authenticated;
