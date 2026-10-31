\set QUIET on
\pset pager off
insert into auth.users (id,email) values ('aaaaaaaa-0000-0000-0000-000000000001','a@x.com'),('bbbbbbbb-0000-0000-0000-000000000002','b@x.com');
set role authenticated;
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.create_business('Negocio A') as biz_a \gset
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
select public.create_business('Negocio B') as biz_b \gset
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into suppliers (business_id,name) values (:'biz_a','Proveedor A') returning id as sup_a \gset
insert into customers (business_id,name,phone) values (:'biz_a','Cliente A','111') returning id as cus_a \gset
select public.create_product(:'biz_a','Prod 1','S1',null,null,null,100000,250000,1,10,:'sup_a') as p1 \gset
select public.create_product(:'biz_a','Prod 2','S2',null,null,null,50000,90000,1,10) as p2 \gset
\echo '--- Producto con proveedor propio'
select name, supplier_id = :'sup_a' as proveedor_ok from products where id = :'p1';
\echo '--- Proveedor de OTRO negocio en producto propio (debe fallar)'
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
insert into suppliers (business_id,name) values (:'biz_b','Proveedor B') returning id as sup_b \gset
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.create_product(:'biz_a','Prod X','SX',null,null,null,1,1,0,0,:'sup_b');
update products set supplier_id = :'sup_b' where id = :'p1';
\echo '--- B no ve proveedores/clientes/estadísticas de A'
set test.uid = 'bbbbbbbb-0000-0000-0000-000000000002';
select (select count(*) from suppliers) as suppliers_B, (select count(*) from customers) as customers_B, (select count(*) from customer_stats) as stats_B;
select public.sales_report(:'biz_a', current_date - 7, current_date)->'summary' as reporte_A_visto_por_B;
\echo '--- Ventas, cancelación y reporte'
set test.uid = 'aaaaaaaa-0000-0000-0000-000000000001';
select public.create_sale(:'biz_a', gen_random_uuid(), :'cus_a', 'cash', 10000, null, jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',2),jsonb_build_object('product_id',:'p2','quantity',1))) as s1 \gset
select public.create_sale(:'biz_a', gen_random_uuid(), :'cus_a', 'transfer', 0, null, jsonb_build_array(jsonb_build_object('product_id',:'p1','quantity',1))) as s2 \gset
select public.create_sale(:'biz_a', gen_random_uuid(), null, 'card', 0, null, jsonb_build_array(jsonb_build_object('product_id',:'p2','quantity',3))) as s3 \gset
select public.cancel_sale(:'s3','Devolución');
select purchases_count, total_spent_cents from customer_stats where customer_id = :'cus_a';  -- esperado 2 y 740000-10000... ver abajo
select jsonb_pretty(public.sales_report(:'biz_a', current_date - 1, current_date + 1) - 'by_day' - 'movements');
\echo '--- Esperado: ventas=2; ingresos=(2*2500+900-100)+2500=8300 -> 830000 c; costo=(2*1000+500)+1000=3500 -> 350000 c; canceladas=1 (2700 -> 270000)'
\echo '--- Rangos inválidos'
select public.sales_report(:'biz_a', current_date, current_date - 1);
select public.sales_report(:'biz_a', current_date - 400, current_date);
select jsonb_array_length(public.sales_report(:'biz_a', current_date, current_date)->'by_day') as dias_hoy;
\echo '--- Borrar cliente deja las ventas como consumidor final'
delete from customers where id = :'cus_a';
select count(*) as ventas_conservadas, count(customer_id) as con_cliente from sales;
select count(*) from sale_items;
\echo '--- Auditoría stock'
select name, stock_quantity, stock_from_movements, consistent from stock_audit order by name;
