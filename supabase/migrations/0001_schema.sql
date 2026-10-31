-- =====================================================================
-- 0001 · Esquema base
-- Dinero: siempre en CENTAVOS (bigint). Nunca decimales ni floats.
-- Aislamiento: toda tabla de negocio lleva business_id.
-- =====================================================================

create table public.businesses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 2 and 120),
  created_by       uuid references auth.users (id) on delete set null,
  next_sale_number bigint not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, business_id)
);
create unique index categories_business_name_key on public.categories (business_id, lower(btrim(name)));

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 120),
  contact_name text,
  phone        text,
  email        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, business_id)
);

create table public.customers (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  phone       text,
  email       text,
  document    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, business_id)
);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  category_id    uuid,
  supplier_id    uuid,
  name           text not null check (char_length(btrim(name)) between 1 and 160),
  sku            text not null check (char_length(btrim(sku)) between 1 and 60),
  barcode        text check (barcode is null or char_length(btrim(barcode)) between 1 and 60),
  description    text,
  cost_cents     bigint not null default 0 check (cost_cents >= 0),
  price_cents    bigint not null default 0 check (price_cents >= 0),
  -- Caché del stock. Solo lo modifican las funciones; la verdad auditable está en stock_movements.
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  min_stock      integer not null default 0 check (min_stock >= 0),
  deleted_at     timestamptz,           -- "eliminar" = archivar, para no romper el historial
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, business_id),
  foreign key (category_id, business_id) references public.categories (id, business_id)
    on delete set null (category_id),
  foreign key (supplier_id, business_id) references public.suppliers (id, business_id)
    on delete set null (supplier_id)
);
-- SKU y código de barras únicos por negocio (entre productos no archivados)
create unique index products_business_sku_key on public.products (business_id, lower(btrim(sku)))
  where deleted_at is null;
create unique index products_business_barcode_key on public.products (business_id, btrim(barcode))
  where barcode is not null and deleted_at is null;
create index products_business_name_idx on public.products (business_id, lower(name));
create index products_category_idx on public.products (category_id);

create table public.sales (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  sale_number       bigint not null,
  customer_id       uuid,
  status            text not null default 'completed' check (status in ('completed', 'cancelled')),
  payment_method    text not null check (payment_method in ('cash', 'transfer', 'card', 'other')),
  subtotal_cents    bigint not null default 0 check (subtotal_cents >= 0),
  discount_cents    bigint not null default 0 check (discount_cents >= 0),
  total_cents       bigint not null default 0 check (total_cents >= 0),
  cost_total_cents  bigint not null default 0 check (cost_total_cents >= 0),  -- copia histórica del costo
  notes             text,
  client_request_id uuid,                -- idempotencia: evita registrar dos veces la misma venta
  sold_at           timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null,
  cancelled_at      timestamptz,
  cancelled_by      uuid references auth.users (id) on delete set null,
  cancel_reason     text,
  created_at        timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, sale_number),
  unique (business_id, client_request_id),
  check (discount_cents <= subtotal_cents),
  check (total_cents = subtotal_cents - discount_cents),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  foreign key (customer_id, business_id) references public.customers (id, business_id)
    on delete set null (customer_id)
);
create index sales_business_sold_idx on public.sales (business_id, sold_at desc);
create index sales_customer_idx on public.sales (customer_id);

create table public.sale_items (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  sale_id          uuid not null,
  product_id       uuid not null,
  -- Copias históricas: cambiar el producto después NO altera ventas pasadas
  product_name     text not null,
  product_sku      text not null,
  quantity         integer not null check (quantity > 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  unit_cost_cents  bigint not null check (unit_cost_cents >= 0),
  line_total_cents bigint not null check (line_total_cents >= 0),
  check (line_total_cents = quantity * unit_price_cents),
  foreign key (sale_id, business_id) references public.sales (id, business_id),
  foreign key (product_id, business_id) references public.products (id, business_id)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  product_id     uuid not null,
  movement_type  text not null check (movement_type in
                   ('initial', 'entry', 'exit', 'adjustment', 'sale', 'sale_cancel')),
  quantity_delta integer not null check (quantity_delta <> 0),  -- con signo: + entra, - sale
  stock_after    integer not null check (stock_after >= 0),
  reason         text,
  sale_id        uuid,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default clock_timestamp(),  -- orden fino dentro de una misma operación
  check (
    (movement_type in ('initial', 'entry', 'sale_cancel') and quantity_delta > 0) or
    (movement_type in ('exit', 'sale') and quantity_delta < 0) or
    (movement_type = 'adjustment')
  ),
  check (movement_type <> 'adjustment' or char_length(btrim(coalesce(reason, ''))) >= 3),
  foreign key (product_id, business_id) references public.products (id, business_id),
  foreign key (sale_id, business_id) references public.sales (id, business_id)
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_business_idx on public.stock_movements (business_id, created_at desc);

-- Auditoría: stock guardado vs. stock reconstruido desde los movimientos (deben coincidir siempre)
create view public.stock_audit with (security_invoker = true) as
select p.id as product_id, p.business_id, p.name, p.stock_quantity,
       coalesce(sum(m.quantity_delta), 0)::integer as stock_from_movements,
       (p.stock_quantity = coalesce(sum(m.quantity_delta), 0)) as consistent
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id;

-- ---------- Triggers ----------
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger trg_businesses_updated before update on public.businesses
  for each row execute function public.set_updated_at();
create trigger trg_categories_updated before update on public.categories
  for each row execute function public.set_updated_at();
create trigger trg_suppliers_updated before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger trg_customers_updated before update on public.customers
  for each row execute function public.set_updated_at();
create trigger trg_products_updated before update on public.products
  for each row execute function public.set_updated_at();

-- El historial de movimientos es inmutable: se corrige con un movimiento nuevo, nunca editando.
create function public.prevent_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Los movimientos de stock no se pueden modificar ni borrar.';
end $$;
create trigger trg_stock_movements_immutable before update or delete on public.stock_movements
  for each row execute function public.prevent_mutation();
create trigger trg_sale_items_immutable before update or delete on public.sale_items
  for each row execute function public.prevent_mutation();
