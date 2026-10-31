import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { friendlyError } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Shell } from './AuthPage'

export default function OnboardingPage() {
  const { createBusiness, signOut, user } = useAuth()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (clean.length < 2) return setError('El nombre debe tener al menos 2 caracteres.')
    setBusy(true)
    setError(null)
    try {
      await createBusiness(clean)
    } catch (err) {
      setError(friendlyError(err))
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="text-xl font-bold">¿Cómo se llama tu negocio?</h1>
      <p className="mt-1 text-sm text-neutral-500">Es el nombre que vas a ver en el sistema. Podés cambiarlo más adelante.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Nombre del negocio" htmlFor="business-name" error={error ?? undefined}>
          <input id="business-name" className={`input ${error ? 'input-error' : ''}`} value={name}
            onChange={(e) => setName(e.target.value)} placeholder="Ej.: Perfumería Aurora" maxLength={120} autoFocus />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={busy}>Crear negocio</Button>
      </form>
      <p className="mt-6 text-center text-xs text-neutral-500">
        Sesión iniciada como {user?.email}.{' '}
        <button type="button" onClick={signOut} className="font-semibold text-neutral-700 hover:underline">Salir</button>
      </p>
    </Shell>
  )
}
