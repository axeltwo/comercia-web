interface MaybeDbError {
  code?: string
  message?: string
  details?: string
}

/** Error con un mensaje ya pensado para mostrarle al usuario tal cual. */
export class AppError extends Error {}

/** Traduce errores de Supabase/PostgreSQL a mensajes claros para el usuario. */
export function friendlyError(err: unknown): string {
  if (err instanceof AppError) return err.message
  const e = (err ?? {}) as MaybeDbError
  const msg = e.message ?? ''
  const text = `${msg} ${e.details ?? ''}`.toLowerCase()

  if (/failed to fetch|networkerror|load failed/.test(text)) {
    return 'No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.'
  }
  // Auth
  if (text.includes('invalid login credentials')) return 'El email o la contraseña no son correctos.'
  if (text.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.'
  if (text.includes('user already registered')) return 'Ya existe una cuenta con ese email.'
  if (text.includes('password should be at least')) return 'La contraseña es demasiado corta.'
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.'
  }
  // Base de datos
  if (e.code === '23505') {
    if (text.includes('sku')) return 'Ya existe un producto con ese SKU.'
    if (text.includes('barcode')) return 'Ya existe un producto con ese código de barras.'
    if (text.includes('categories')) return 'Ya existe una categoría con ese nombre.'
    return 'Ya existe un registro con esos datos.'
  }
  if (e.code === '23503') return 'El proveedor, categoría o cliente elegido ya no existe o no es válido. Actualizá la página e intentá de nuevo.'
  if (e.code === '23514') return 'Alguno de los valores no es válido. Revisá los campos.'
  if (e.code === '42501' || text.includes('permission denied') || text.includes('row-level security')) {
    return 'No tenés permiso para realizar esta acción.'
  }
  // Mensajes escritos en las funciones SQL (RAISE EXCEPTION): ya vienen en español.
  if (e.code === 'P0001' && msg) return msg
  return 'Ocurrió un error inesperado. Intentá de nuevo.'
}
