import type { ReactNode } from 'react'

interface Props {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  optional?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, optional, children }: Props) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
        {optional && <span className="ml-1 font-normal text-neutral-500">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-[13px] text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[13px] text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}
