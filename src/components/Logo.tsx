export function Logo({ light }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill={light ? '#ffffff' : '#171717'} />
        <path d="M9 12l7-4 7 4v8l-7 4-7-4z" fill="none" stroke="#2f9460" strokeWidth="2.4" strokeLinejoin="round" />
      </svg>
      <span className={`text-[17px] font-bold tracking-tight ${light ? 'text-white' : 'text-neutral-900'}`}>Comercia</span>
    </div>
  )
}
