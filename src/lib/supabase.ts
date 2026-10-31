import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** false si faltan las variables de entorno: la app muestra una guía en lugar de romperse. */
export const supabaseConfigured = Boolean(url && anonKey)

// Solo se usa la clave pública. La seguridad real la dan las políticas RLS en la base de datos.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'sin-configurar', {
  auth: { persistSession: true, autoRefreshToken: true },
})
