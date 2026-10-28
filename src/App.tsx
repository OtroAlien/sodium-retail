import { useEffect, type ReactNode } from 'react'
import { useMe, useStore, type Page } from './store'
import Layout, { pageAllowed } from './components/Layout'
import DemoPanel from './components/DemoPanel'
import { ConfirmProvider, ErrorBoundary, Toasts } from './components/feedback'
import Login from './pages/Login'
import PanelGeneral from './pages/PanelGeneral'
import Inicio from './pages/Inicio'
import Venta from './pages/Venta'
import Caja from './pages/Caja'
import Ventas from './pages/Ventas'
import Productos from './pages/Productos'
import Alertas from './pages/Alertas'
import Compras from './pages/Compras'
import Clientes from './pages/Clientes'
import Presupuestos from './pages/Presupuestos'
import Mostrador from './pages/Mostrador'
import Reservas from './pages/Reservas'
import Disponibilidad from './pages/Disponibilidad'
import Equipos from './pages/Equipos'
import Comprobantes from './pages/Comprobantes'
import Cobros from './pages/Cobros'
import Reportes from './pages/Reportes'
import Oportunidades from './pages/Oportunidades'
import Automatizaciones from './pages/Automatizaciones'
import Asistente from './pages/Asistente'
import Sincronizacion from './pages/Sincronizacion'
import Auditoria from './pages/Auditoria'
import Usuarios from './pages/Usuarios'
import { businesses } from './data/seed'

const INACTIVITY_MS = 15 * 60 * 1000

const views: Record<Page, () => ReactNode> = {
  panel: () => <PanelGeneral />,
  inicio: () => <Inicio />,
  venta: () => <Venta />,
  caja: () => <Caja />,
  ventas: () => <Ventas />,
  productos: () => <Productos />,
  alertas: () => <Alertas />,
  compras: () => <Compras />,
  clientes: () => <Clientes />,
  presupuestos: () => <Presupuestos />,
  mostrador: () => <Mostrador />,
  reservas: () => <Reservas />,
  disponibilidad: () => <Disponibilidad />,
  equipos: () => <Equipos />,
  comprobantes: () => <Comprobantes />,
  cobros: () => <Cobros />,
  reportes: () => <Reportes />,
  oportunidades: () => <Oportunidades />,
  automatizaciones: () => <Automatizaciones />,
  asistente: () => <Asistente />,
  sincronizacion: () => <Sincronizacion />,
  auditoria: () => <Auditoria />,
  usuarios: () => <Usuarios />,
}

export default function App() {
  const me = useMe()
  const page = useStore((s) => s.page)
  const businessId = useStore((s) => s.businessId)
  const setRealOnline = useStore((s) => s.setRealOnline)

  // estado real de la red del dispositivo
  useEffect(() => {
    const on = () => setRealOnline(true)
    const off = () => setRealOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    setRealOnline(navigator.onLine)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [setRealOnline])

  // M5-R2: los comprobantes pendientes se reintentan solos
  useEffect(() => {
    const t = setInterval(() => useStore.getState().retryPendingInvoices(), 8000)
    return () => clearInterval(t)
  }, [])

  // M3: cierre automático de sesión por inactividad
  useEffect(() => {
    if (!me) return
    let timer = setTimeout(() => useStore.getState().logout(), INACTIVITY_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => useStore.getState().logout(), INACTIVITY_MS)
    }
    const evs = ['pointerdown', 'keydown'] as const
    evs.forEach((e) => window.addEventListener(e, reset))
    return () => {
      clearTimeout(timer)
      evs.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [me])

  if (!me) {
    return (
      <ConfirmProvider>
        <Login />
        <DemoPanel />
        <Toasts />
      </ConfirmProvider>
    )
  }

  // un usuario no puede acceder a pantallas fuera de su rol ni de su rubro (criterio M3)
  const allowed = pageAllowed(page, businesses[businessId].kind, me)
  return (
    <ConfirmProvider>
      <Layout>
        <ErrorBoundary resetKey={`${page}-${businessId}`} onHome={() => useStore.getState().setPage('inicio')}>
          {allowed ? views[page]() : <Inicio />}
        </ErrorBoundary>
      </Layout>
      <DemoPanel />
      <Toasts />
    </ConfirmProvider>
  )
}
