import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'dark' | 'secondary' | 'danger' | 'ghost'

// Clases escritas completas: Tailwind elimina las que se arman dinámicamente (`btn-${variant}`).
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn btn-primary',
  dark: 'btn btn-dark',
  secondary: 'btn btn-secondary',
  danger: 'btn btn-danger',
  ghost: 'btn btn-ghost',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'secondary', small, loading, icon, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`${VARIANT_CLASS[variant]} ${small ? 'btn-sm' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}
