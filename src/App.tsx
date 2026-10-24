import { useEffect } from 'react'
import { useMe, useStore } from './store'
import Layout from './components/Layout'
import DemoPanel from './components/DemoPanel'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Venta from './pages/Venta'
import Caja from './pages/Caja'
import Ventas from './pages/Ventas'
import Productos from './pages/Productos'
import Alertas from './pages/Alertas'
import Comprobantes from './pages/Comprobantes'
import Sincronizacion from './pages/Sincronizacion'
import Auditoria from './pages/Auditoria'
import Usuarios from './pages/Usuarios'
import { can } from './lib/permissions'

const INACTIVITY_MS = 15 * 60 * 1000

export default function App() {
  const me = useMe()
  const page = useStore((s) => s.page)
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
      <>
        <Login />
        <DemoPanel />
      </>
    )
  }

  // un Cajero no puede acceder a pantallas fuera de su rol (criterio M3)
  const blocked = (page === 'auditoria' && !can(me.role, 'auditoria.ver')) || (page === 'usuarios' && !can(me.role, 'usuarios.gestionar'))

  const view = blocked ? (
    <Inicio />
  ) : (
    {
      inicio: <Inicio />,
      venta: <Venta />,
      caja: <Caja />,
      ventas: <Ventas />,
      productos: <Productos />,
      alertas: <Alertas />,
      comprobantes: <Comprobantes />,
      sincronizacion: <Sincronizacion />,
      auditoria: <Auditoria />,
      usuarios: <Usuarios />,
    }[page]
  )

  return (
    <>
      <Layout>{view}</Layout>
      <DemoPanel />
    </>
  )
}
