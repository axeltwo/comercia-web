import { useState, type FormEvent } from 'react'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Logo } from '../components/Logo'

type Mode = 'login' | 'register'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsConfirm, setNeedsConfirm] = useState(false)

  const emailError = email && !/^\S+@\S+\.\S+$/.test(email) ? 'Ingresá un email válido.' : undefined

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Ingresá un email válido.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        const confirm = await signUp(email.trim(), password)
        if (confirm) setNeedsConfirm(true)
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (needsConfirm) {
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MailCheck size={24} />
          </div>
          <h1 className="text-xl font-bold">Confirmá tu email</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Te enviamos un mensaje a <strong>{email}</strong>. Abrí el enlace para activar tu cuenta y después ingresá.
          </p>
          <Button className="mt-6 w-full" onClick={() => { setNeedsConfirm(false); setMode('login') }}>
            Ir a ingresar
          </Button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">{mode === 'login' ? 'Ingresá a tu negocio' : 'Creá tu cuenta'}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {mode === 'login' ? 'Usá el email con el que te registraste.' : 'Después vas a poder configurar los datos de tu negocio.'}
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={emailError}>
          <input id="email" type="email" autoComplete="email" className={`input ${emailError ? 'input-error' : ''}`}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@minegocio.com" />
        </Field>
        <Field label="Contraseña" htmlFor="password" hint={mode === 'register' ? 'Mínimo 8 caracteres.' : undefined}>
          <input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={busy}>
          {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-600">
        {mode === 'login' ? '¿Todavía no tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
        <button type="button" className="font-semibold text-brand-700 hover:underline"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
          {mode === 'login' ? 'Registrate' : 'Ingresá'}
        </button>
      </p>
    </Shell>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="mb-8"><Logo /></div>
      <div className="card w-full max-w-sm p-6 sm:p-8">{children}</div>
      <p className="mt-6 text-xs text-neutral-400">Gestión de stock y ventas para comercios</p>
    </div>
  )
}
