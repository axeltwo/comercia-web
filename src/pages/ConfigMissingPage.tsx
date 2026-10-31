import { Shell } from './AuthPage'

export default function ConfigMissingPage() {
  return (
    <Shell>
      <h1 className="text-xl font-bold">Falta conectar Supabase</h1>
      <p className="mt-2 text-sm text-neutral-600">
        La aplicación no encuentra las variables de entorno. Creá el archivo <code className="rounded bg-neutral-100 px-1">.env.local</code> en
        la raíz del proyecto con estos dos valores y reiniciá <code className="rounded bg-neutral-100 px-1">npm run dev</code>:
      </p>
      <pre className="mt-4 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">
{`VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=...`}
      </pre>
      <p className="mt-4 text-sm text-neutral-600">Los pasos detallados están en el README.</p>
    </Shell>
  )
}
