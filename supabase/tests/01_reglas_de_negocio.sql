\set QUIET on
\pset pager off
insert into auth.users (id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com'),('bbbbbbbb-0000-0000-0000-000000000002','b@x.com');
set role authenticated;
\echo '--- 1. Alta de negocios'
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.create_business('Perfumería A') as biz_a \gset
select public.create_business('Otro negocio') ;  -- debe fallar (1 por usuario)
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
select public.create_business('Ropa B') as biz_b \gset

\echo '--- 2. A crea categoría y productos'
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into categories (business_id,name) values (:'biz_a','Perfumes') returning id as cat \gset
select public.create_product(:'biz_a','Perfume X','SKU-1','7790001',:'cat','desc',500000,900000,2,5) as p1 \gset
select public.create_product(:'biz_a','Crema Y','SKU-2',null,null,null,100000,250000,1,1) as p2 \gset
\echo '--- SKU duplicado (debe fallar)'
select public.create_product(:'biz_a','Otro','sku-1',null,null,null,1,1,0,0);
\echo '--- 3. Aislamiento: B no ve ni toca datos de A'
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
select count(*) as productos_visibles_para_B from products;
select count(*) as negocios_visibles_para_B from businesses;
select public.create_product(:'biz_a','Hack','H',null,null,null,1,1,0,5);
select public.create_sale(:'biz_a', gen_random_uuid(), null, 'cash', 0, null, jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',1)));
select (public.dashboard_summary(:'biz_a')->>'products_count') as dashboard_A_visto_por_B;
update products set name='hack' where id = :'p1';
select count(*) from stock_movements;

\echo '--- 4. Escrituras directas prohibidas (A)'
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
update products set stock_quantity = 999 where id = :'p1';
insert into products (business_id,name,sku) values (:'biz_a','x','y');
update stock_movements set quantity_delta = 99;
delete from stock_movements;
insert into sales (business_id,sale_number,payment_method) values (:'biz_a',99,'cash');
update products set business_id = :'biz_b' where id = :'p1';
\echo '--- categoría de otro negocio en producto propio (debe fallar)'
reset role; insert into categories (business_id,name) values (:'biz_b','CatB') returning id as catb \gset
set role authenticated; set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
update products set category_id = :'catb' where id = :'p1';

\echo '--- 5. Venta: 2 u de Perfume X + 1 Crema, descuento $1000'
select public.create_sale(:'biz_a','11111111-1111-1111-1111-111111111111',null,'cash',100000,'nota',
  jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',2),jsonb_build_object('product_id',:'p2','quantity',1))) as s1 \gset
select sale_number, status, subtotal_cents, discount_cents, total_cents, cost_total_cents from sales where id=:'s1';
select name, stock_quantity from products order by name;
\echo '--- 5b. Idempotencia: misma clave → misma venta, stock sin cambios'
select public.create_sale(:'biz_a','11111111-1111-1111-1111-111111111111',null,'cash',100000,'nota',
  jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',2))) = :'s1'::uuid as misma_venta;
select name, stock_quantity from products order by name;
\echo '--- 5c. Cambio de precio no altera venta pasada'
update products set price_cents = 1, cost_cents = 1, name='Perfume X (nuevo)' where id=:'p1';
select product_name, unit_price_cents, unit_cost_cents, line_total_cents from sale_items order by product_name;

\echo '--- 6. Stock insuficiente / entradas inválidas'
select public.create_sale(:'biz_a',gen_random_uuid(),null,'card',0,null,jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',50)));
select public.create_sale(:'biz_a',gen_random_uuid(),null,'card',0,null,jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',-1)));
select public.create_sale(:'biz_a',gen_random_uuid(),null,'bitcoin',0,null,jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',1)));
select public.create_sale(:'biz_a',gen_random_uuid(),null,'cash',99999999,null,jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',1)));
select public.create_sale(:'biz_a',gen_random_uuid(),null,'cash',0,null,'[]');
select name, stock_quantity from products order by name;
select count(*) as ventas_totales from sales;

\echo '--- 7. Inventario manual'
select public.register_stock_movement(:'biz_a',:'p2','entry',10,'Compra') is not null as entrada_ok;
select public.register_stock_movement(:'biz_a',:'p2','exit',100,'x');
select public.register_stock_movement(:'biz_a',:'p2','adjustment',-1,null);
select public.register_stock_movement(:'biz_a',:'p2','adjustment',-1,'Rotura') is not null as ajuste_ok;
select public.register_stock_movement(:'biz_a',:'p2','adjustment',-500,'Error de conteo');

\echo '--- 8. Cancelación'
select public.cancel_sale(:'s1', null);
select public.cancel_sale(:'s1', 'Devolución del cliente');
select public.cancel_sale(:'s1', 'otra vez');
select status, cancel_reason from sales where id=:'s1';
select name, stock_quantity from products order by name;
\echo '--- B no puede cancelar venta de A'
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
select public.cancel_sale(:'s1', 'intruso');
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';

\echo '--- 9. Auditoría stock (deben ser consistentes)'
select name, stock_quantity, stock_from_movements, consistent from stock_audit order by name;
\echo '--- 10. Dashboard'
select 'ok';
\echo '--- 11. anon sin acceso'
reset role; set role anon;
select count(*) from products;
select public.dashboard_summary(:'biz_a');
