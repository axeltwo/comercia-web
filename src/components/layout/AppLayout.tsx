import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../Logo'
import { ErrorBoundary } from '../ErrorBoundary'
import { NAV_ITEMS } from './nav'

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { business, user, signOut } = useAuth()
  return (
    <div className="flex h-full flex-col bg-neutral-900 text-neutral-300">
      <div className="px-5 pb-4 pt-5"><Logo light /></div>

      <div className="mx-3 mb-3 rounded-lg bg-neutral-800 px-3 py-2.5">
        <p className="text-xs text-neutral-400">Negocio</p>
        <p className="truncate text-sm font-semibold text-white">{business?.name}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3" aria-label="Principal">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-neutral-900'
                  : 'hover:bg-neutral-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} className={isActive ? 'text-brand-600' : 'text-neutral-500 group-hover:text-neutral-300'} aria-hidden />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-neutral-800 p-3">
        <p className="truncate px-2 pb-2 text-xs text-neutral-500">{user?.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          <LogOut size={18} aria-hidden /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Sidebar fija (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent />
      </aside>

      {/* Barra superior + cajón (celular/tablet) */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost -ml-2 p-2" aria-label="Abrir menú">
          <Menu size={22} />
        </button>
        <Logo />
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-neutral-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-pop">
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú"
              className="absolute right-2 top-3 z-10 rounded-lg p-2 text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <ErrorBoundary key={pathname}><Outlet /></ErrorBoundary>
      </main>
    </div>
  )
}
