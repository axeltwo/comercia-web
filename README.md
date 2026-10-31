# Comercia · Gestión de stock y ventas

Sistema web para comercios de Argentina (perfumerías, ropa, accesorios, etc.).
React + TypeScript + Vite + Tailwind CSS · Supabase (PostgreSQL + Auth) · Vercel.

## Estado: Completo (alcance original)

| Módulo | Estado |
|---|---|
| Autenticación (email y contraseña) + alta del negocio | ✅ Funcional |
| Aislamiento de datos por negocio (RLS) | ✅ Funcional y probado |
| Dashboard | ✅ Funcional (las métricas de ventas dependen del módulo Ventas) |
| Productos (crear, editar, eliminar, buscar, filtrar) | ✅ Funcional |
| Categorías (crear, editar, eliminar, cantidad de productos) | ✅ Funcional (etapa 2) |
| Inventario (entradas, salidas, ajustes con motivo, historial con filtros y alertas de stock mínimo) | ✅ Funcional (etapa 2) |
| Ventas (varios productos, descuento, método de pago, cliente opcional, historial, detalle y cancelación) | ✅ Funcional (etapa 3) |
| Clientes (alta, edición, baja, historial de compras, total comprado) | ✅ Funcional |
| Proveedores (alta, edición, baja, asociación con productos, filtro en Productos) | ✅ Funcional · la estructura para futuras compras de mercadería está lista en la base |
| Reportes (ventas por período y por día, métodos de pago, más vendidos, bajo stock, movimientos, costos y ganancia bruta, filtros por fechas) con exportación a CSV | ✅ Funcional |

> Las **funciones SQL de ventas, cancelaciones y movimientos de stock ya existen y están probadas**
> (`supabase/migrations/0003_functions.sql`). Lo que falta es construir sus pantallas.

---

## 1. Qué necesitás configurar (una sola vez)

### A. Crear el proyecto en Supabase
1. Entrá a <https://supabase.com> → **New project**. Elegí una región cercana (por ej. *South America (São Paulo)*) y guardá la contraseña de la base.
2. Cuando termine de crearse, andá a **SQL Editor** → **New query**.
3. Pegá y ejecutá **en este orden**, un archivo por vez (botón *Run*):
   1. `supabase/migrations/0001_schema.sql`
   2. `supabase/migrations/0002_rls.sql`
   3. `supabase/migrations/0003_functions.sql`
   4. `supabase/migrations/0004_inventory_view.sql`
   5. `supabase/migrations/0005_reports_customers_suppliers.sql`

   *(Si ya habías ejecutado los primeros, ejecutá solo los que te falten, siempre en orden.)*

   Cada uno debe terminar con *Success*. Si uno falla, **no sigas**: copiame el error.
4. Verificá en **Table Editor** que aparezcan las tablas (`businesses`, `products`, `sales`, …) y que todas muestren el candado de **RLS enabled**.

### B. Configurar la autenticación
En **Authentication → Providers → Email**:
- Para **probar rápido en tu computadora**, podés desactivar *Confirm email* (así entrás sin confirmar el correo).
- Para **producción**, dejalo activado.

En **Authentication → URL Configuration**:
- *Site URL*: `http://localhost:5173` (cuando publiques, la cambiás por la URL de Vercel).
- *Redirect URLs*: agregá `http://localhost:5173/**` y, más adelante, `https://TU-APP.vercel.app/**`.

### C. Copiar las claves al proyecto
1. En Supabase: **Project Settings → API** (o el botón **Connect**).
2. Copiá la **Project URL** y la clave **anon / publishable**.
3. En la raíz del proyecto, copiá `.env.example` como **`.env.local`** y completá:
   ```
   VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
> 🔒 **Nunca** uses la clave `service_role` en este proyecto ni la subas a GitHub. La clave `anon` es pública *por diseño*: la seguridad la dan las políticas RLS de la base. `.env.local` ya está en `.gitignore`.

## 2. Ejecutar localmente
```bash
npm install
npm run dev        # abre http://localhost:5173
npm run build      # verifica tipos y compila para producción
```
Requiere Node.js 18 o superior.

## 3. Cómo probar la Etapa 1
1. **Registrate** con un email y una contraseña (mínimo 8 caracteres). Si dejaste *Confirm email* activado, confirmá el correo primero.
2. Ingresá el **nombre de tu negocio**. Esto crea el negocio y te asigna como dueño.
3. En **Productos → Nuevo producto**: cargá nombre, SKU, costo, precio y stock inicial. Verificá que el margen se calcule en pantalla.
4. Probá **editar**, **buscar** (nombre, SKU o código de barras), **filtrar** por categoría/disponibilidad y **eliminar**.
5. Volvé al **Dashboard**: debe mostrar el producto, el movimiento "Stock inicial" y, si el stock queda en o bajo el mínimo, la alerta.
6. **Prueba de aislamiento**: cerrá sesión, registrá un segundo usuario con otro email y comprobá que **no ve nada** del primero.
7. En **Table Editor → stock_movements** vas a ver cada movimiento registrado. En **SQL Editor** podés correr `select * from stock_audit;`: la columna `consistent` debe ser siempre `true`.

### Probar la Etapa 2
1. **Categorías → Nueva categoría**: creá una, editala y asignala desde el formulario de un producto. Al eliminarla, sus productos quedan "sin categoría" (no se borran).
2. **Inventario → Registrar movimiento**: probá una *Entrada*, una *Salida* y un *Ajuste* (este exige motivo). Si intentás sacar más de lo que hay, el sistema lo bloquea y muestra el stock resultante antes de confirmar.
3. Revisá el **historial**: filtrá por producto/SKU, tipo y fechas, y usá "Cargar más".
4. Si un producto llega al stock mínimo aparece un aviso con el botón **Reponer**.
5. En SQL Editor: `select * from stock_audit;` debe seguir mostrando `consistent = true` en todas las filas.

### Probar la Etapa 3 (Ventas)
No hay migraciones nuevas: usa las funciones de la etapa 1.
1. Necesitás al menos un producto con stock. **Ventas → Nueva venta**.
2. Buscá por nombre, SKU o código de barras (con un lector, escaneá y se agrega solo). Cambiá cantidades; no te deja pasar del stock.
3. Probá un descuento (ej.: `1.000,50`), elegí método de pago y, si querés, un cliente (podés crearlo ahí mismo).
4. **Confirmar venta**. Verificá: el stock bajó en Productos, aparece el movimiento "Venta" en Inventario y el Dashboard muestra la venta de hoy, los ingresos y la ganancia bruta estimada.
5. Abrí **Ver detalle** y probá **Cancelar venta** (pide motivo): el stock se devuelve y la venta queda como "Cancelada" (no se borra) y deja de sumar en el dashboard.
6. **Prueba de seguridad de precios:** cambiá el precio de un producto después de venderlo y abrí la venta vieja: conserva el precio y costo originales.
7. **Dos pestañas:** abrí Ventas en dos pestañas con un producto de stock 1 y vendé en ambas casi al mismo tiempo: solo una se concreta, la otra muestra "Stock insuficiente".

### Probar Clientes, Proveedores y Reportes
1. **Proveedores → Nuevo proveedor.** Luego en **Productos** editá un producto y elegí ese proveedor. Volvé a Proveedores: aparece la cantidad de productos y, al hacer clic, se filtra la lista de Productos.
2. **Clientes → Nuevo cliente.** Hacé una venta asociada a ese cliente y abrí su ficha (clic en el nombre): vas a ver el historial y el total comprado. Una venta cancelada aparece marcada y no suma.
3. **Reportes:** probá los períodos (Hoy, 7 días, Este mes, Mes anterior, Personalizado). Controlá que *Ingresos − Costo = Ganancia bruta* y que coincida con el Dashboard del mes.
4. **Exportar CSV** en cada sección y abrilo con Excel (separador `;`, tildes correctas, decimales con coma). Los textos que empiezan con `=`, `+`, `-` o `@` se neutralizan para evitar fórmulas maliciosas.

## 4. Publicar (GitHub + Vercel)
```bash
git init && git add . && git commit -m "Etapa 1: base del sistema"
# creá un repositorio vacío en GitHub y seguí sus instrucciones para el "git remote add" y "git push"
```
En <https://vercel.com> → **Add New → Project** → importá el repositorio. Vercel detecta Vite solo.
Antes de desplegar, en **Settings → Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
Después actualizá *Site URL* y *Redirect URLs* en Supabase con la URL que te dé Vercel. `vercel.json` ya resuelve las rutas de la SPA.

---

## 5. Arquitectura y decisiones

```
Navegador (React) ──HTTPS──▶ Supabase
   │                          ├─ Auth (sesiones/JWT)
   │  clave anon (pública)    ├─ PostgREST: lectura/escritura simple, filtrada por RLS
   └──────────────────────────└─ Funciones SQL (RPC): operaciones críticas y atómicas
```

**No hay servidor propio**: lo sensible vive en PostgreSQL, que es quien garantiza la consistencia.

| Decisión | Motivo |
|---|---|
| **Dinero en centavos (`bigint`)** | Evita errores de redondeo de decimales/floats. Solo se formatea para mostrar. |
| **Stock = caché + movimientos** | `products.stock_quantity` se actualiza **solo** desde funciones; cada cambio deja una fila inmutable en `stock_movements`. La vista `stock_audit` compara ambos. |
| **Los clientes no pueden escribir stock, ventas ni movimientos** | `REVOKE` + permisos por columna: aunque alguien manipule el frontend, la base lo rechaza. |
| **Ventas por función `create_sale`** | Una transacción: bloquea productos (`FOR UPDATE`), valida stock, copia precio/costo históricos, descuenta stock y registra movimientos. Si algo falla, no se guarda nada. |
| **Idempotencia (`client_request_id`)** | Reintentar o hacer doble clic en "Confirmar venta" no duplica la venta ni el descuento. |
| **Precio y costo salen de la base** | El cliente solo manda producto y cantidad: no puede falsear importes. |
| **Cancelación (`cancel_sale`)** | Marca la venta, exige motivo y devuelve el stock con movimientos `sale_cancel`. No borra nada. |
| **"Eliminar" producto = archivar (`deleted_at`)** | Las ventas y movimientos pasados siguen mostrando el producto. |
| **Multi-negocio desde el día 1** | Toda tabla lleva `business_id`; claves foráneas compuestas impiden mezclar datos de negocios distintos. |
| **Ventas ≠ caja ≠ ganancia** | "Ingresos" = ventas confirmadas (no canceladas). "Ganancia bruta estimada" = ingresos − costo de lo vendido, **antes** de impuestos, comisiones y gastos. El registro de caja real queda para una etapa futura. |

### Estructura de carpetas
```
supabase/
  migrations/   0001 esquema · 0002 seguridad (RLS) · 0003 funciones · 0004 vista de historial · 0005 reportes/clientes/proveedores
  tests/        pruebas SQL (se ejecutan en un PostgreSQL local; ver abajo)
src/
  lib/          dinero, fechas, errores en español, cliente Supabase, tipos
  context/      sesión y negocio activo
  components/   ui/ (botones, modal, toasts…) · layout/ (sidebar, navegación)
  features/     products/ (API, validación, formulario) · dashboard/
  pages/        una pantalla por ruta
```

## 6. Antes de usarlo con clientes reales (lista de control)
- [ ] Las 5 migraciones ejecutadas en orden y todas las tablas con **RLS enabled**.
- [ ] *Confirm email* **activado** en Supabase Auth, y SMTP propio configurado (el correo por defecto de Supabase tiene límites bajos).
- [ ] *Site URL* y *Redirect URLs* apuntando a tu dominio de Vercel.
- [ ] Solo la clave `anon/publishable` en Vercel; **nunca** `service_role`.
- [ ] Plan de Supabase con **backups** (el gratuito no incluye copias de seguridad automáticas diarias garantizadas: exportá tus datos periódicamente o pasá a un plan pago).
- [ ] Probaste el aislamiento con dos usuarios distintos (ver "Probar la Etapa 1", punto 6).
- [ ] Revisaste que `select * from stock_audit where not consistent;` devuelva 0 filas.

## 7. Límites conocidos de esta etapa
- Los reportes cubren hasta 1 año por consulta y las exportaciones detalladas hasta 10.000 filas (acotá el período si lo superás).
- Todavía no hay registro de compras de mercadería a proveedores (la estructura está lista), ni caja/cobros separados de las ventas, ni facturación ARCA ni medios de pago (fuera de alcance acordado).
- Los importes de ventas son los de la lista vigente: no hay precios por cliente ni promociones automáticas.
- Un usuario = un negocio (la base ya admite varios; falta el selector en pantalla).
- Solo existe el rol *owner*; los roles `admin`/`staff` están en el esquema pero sin permisos diferenciados todavía.
- La lista de productos carga hasta 2.000 y filtra en el navegador (suficiente para comercios chicos; luego se pagina).
- En Productos solo se define el stock inicial; después se modifica únicamente desde Inventario (queda registrado).
- Requiere PostgreSQL 15+ (los proyectos nuevos de Supabase ya lo usan).
- Sin facturación electrónica ARCA ni medios de pago, según lo acordado.

## 8. Pruebas de la base de datos (opcional)
`supabase/tests/` tiene un guion que simula dos negocios y comprueba aislamiento, stock negativo, idempotencia,
cancelaciones y auditoría. Se ejecuta contra un PostgreSQL local (no contra Supabase):
`00_stub_supabase.sql` crea los roles/`auth.uid()` mínimos, luego las 5 migraciones y por último `01_reglas_de_negocio.sql` y `02_reportes_clientes_proveedores.sql`.
