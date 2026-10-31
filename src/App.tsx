import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './components/ui/Toast'
import { supabaseConfigured } from './lib/supabase'
import { Spinner, ErrorState } from './components/ui/Feedback'
import AppLayout from './components/layout/AppLayout'
import AuthPage from './pages/AuthPage'
import OnboardingPage from './pages/OnboardingPage'
import ConfigMissingPage from './pages/ConfigMissingPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import InventoryPage from './pages/InventoryPage'
import SalesPage from './pages/SalesPage'
import CustomersPage from './pages/CustomersPage'
import SuppliersPage from './pages/SuppliersPage'

// El Dashboard incluye la librería de gráficos: se descarga recién cuando se necesita.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))

/** Decide qué pantalla corresponde según el estado de la sesión. */
function Gate({ children }: { children: React.ReactNode }) {
  const { status, errorMessage, reload, signOut } = useAuth()
  if (status === 'loading') return <div className="min-h-screen"><Spinner /></div>
  if (status === 'signedOut') return <AuthPage />
  if (status === 'needsBusiness') return <OnboardingPage />
  if (status === 'error') {
    return (
      <div className="min-h-screen">
        <ErrorState message={errorMessage ?? 'Error desconocido.'} onRetry={reload} />
        <p className="text-center"><button className="text-sm text-neutral-500 underline" onClick={signOut}>Cerrar sesión</button></p>
      </div>
    )
  }
  return <>{children}</>
}

export default function App() {
  if (!supabaseConfigured) return <ConfigMissingPage />

  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Suspense fallback={<Spinner />}><DashboardPage /></Suspense>} />
                <Route path="productos" element={<ProductsPage />} />
                <Route path="categorias" element={<CategoriesPage />} />
                <Route path="inventario" element={<InventoryPage />} />
                <Route path="ventas" element={<SalesPage />} />
                <Route path="clientes" element={<CustomersPage />} />
                <Route path="proveedores" element={<SuppliersPage />} />
                <Route path="reportes" element={<Suspense fallback={<Spinner />}><ReportsPage /></Suspense>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Gate>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
