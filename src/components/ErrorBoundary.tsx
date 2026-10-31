import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface State { failed: boolean }

/** Red de seguridad: si una pantalla falla al dibujarse, se muestra un aviso en vez de una pantalla en blanco. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de interfaz:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="flex flex-col items-center px-6 py-20 text-center" role="alert">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600"><AlertTriangle size={22} /></div>
        <h2 className="text-lg font-semibold">Algo salió mal en esta pantalla</h2>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">Tus datos están a salvo. Probá recargar la página; si se repite, avisanos.</p>
        <button type="button" className="btn btn-dark mt-5" onClick={() => window.location.reload()}>Recargar</button>
      </div>
    )
  }
}
