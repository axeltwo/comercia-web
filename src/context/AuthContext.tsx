import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { friendlyError } from '../lib/errors'

export interface Business {
  id: string
  name: string
  role: 'owner' | 'admin' | 'staff'
}

type Status = 'loading' | 'signedOut' | 'needsBusiness' | 'ready' | 'error'

interface AuthState {
  status: Status
  user: User | null
  business: Business | null
  errorMessage: string | null
  signIn: (email: string, password: string) => Promise<void>
  /** Devuelve true si hay que confirmar el email antes de poder ingresar. */
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  createBusiness: (name: string) => Promise<void>
  reload: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [business, setBusiness] = useState<Business | null>(null)
  const [businessLoaded, setBusinessLoaded] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // 1) Sesión de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoaded(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setSessionLoaded(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  // 2) Negocio del usuario (las políticas RLS ya filtran: solo devuelve los suyos)
  useEffect(() => {
    if (!sessionLoaded) return
    if (!userId) {
      setBusiness(null)
      setBusinessLoaded(true)
      setErrorMessage(null)
      return
    }
    let cancelled = false
    setBusinessLoaded(false)
    setErrorMessage(null)
    supabase
      .from('business_members')
      .select('role, business:businesses(id, name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setErrorMessage(friendlyError(error))
          setBusiness(null)
        } else {
          const row = data?.[0] as unknown as { role: Business['role']; business: { id: string; name: string } | null } | undefined
          setBusiness(row?.business ? { id: row.business.id, name: row.business.name, role: row.role } : null)
        }
        setBusinessLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionLoaded, userId, reloadKey])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return !data.session
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setBusiness(null)
  }, [])

  const createBusiness = useCallback(async (name: string) => {
    const { error } = await supabase.rpc('create_business', { p_name: name })
    if (error) throw error
    setReloadKey((k) => k + 1)
  }, [])

  const status: Status =
    !sessionLoaded || (session && !businessLoaded)
      ? 'loading'
      : !session
        ? 'signedOut'
        : errorMessage
          ? 'error'
          : business
            ? 'ready'
            : 'needsBusiness'

  const value = useMemo<AuthState>(
    () => ({
      status,
      user: session?.user ?? null,
      business,
      errorMessage,
      signIn,
      signUp,
      signOut,
      createBusiness,
      reload: () => setReloadKey((k) => k + 1),
    }),
    [status, session, business, errorMessage, signIn, signUp, signOut, createBusiness],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

/** Para pantallas internas: el negocio siempre existe (lo garantiza el guard de rutas). */
export function useBusiness(): Business {
  const { business } = useAuth()
  if (!business) throw new Error('No hay negocio activo')
  return business
}
