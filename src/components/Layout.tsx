import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Boxes,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileSignature,
  FileText,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Shirt,
  Sparkles,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  Workflow,
  X,
} from 'lucide-react'
import { useMe, useOnline, useStore, type Page } from '../store'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { can, roleLabel, type Permission } from '../lib/permissions'
import { daysUntil, todayISO } from '../lib/format'
import { IconButton, cx } from './ui'
import type { BusinessId, BusinessKind } from '../types'

type NavItem = { page: Page; label: string | Partial<Record<BusinessKind, string>>; icon: typeof Home; perm?: Permission; kinds?: BusinessKind[] }

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operación',
    items: [
      { page: 'inicio', label: 'Inicio', icon: Home },
      { page: 'mostrador', label: 'Mostrador', icon: Store, kinds: ['rental'] },
      { page: 'reservas', label: 'Reservas', icon: CalendarDays, kinds: ['rental'] },
      { page: 'disponibilidad', label: 'Disponibilidad', icon: CalendarRange, kinds: ['rental'] },
      { page: 'venta', label: { retail: 'Vender', hardware: 'Vender', rental: 'Venta de accesorios' }, icon: ScanBarcode },
      { page: 'presupuestos', label: 'Presupuestos', icon: FileSignature, kinds: ['hardware'] },
      { page: 'caja', label: 'Caja', icon: Wallet },
      { page: 'ventas', label: 'Ventas', icon: ReceiptText },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { page: 'equipos', label: 'Equipos y prendas', icon: Shirt, kinds: ['rental'] },
      { page: 'productos', label: { retail: 'Productos y precios', hardware: 'Productos y variantes', rental: 'Accesorios' }, icon: Boxes },
      { page: 'alertas', label: { retail: 'Stock y vencimientos', hardware: 'Stock y reposición' }, icon: AlertTriangle, kinds: ['retail', 'hardware'] },
      { page: 'compras', label: 'Proveedores y compras', icon: Truck, kinds: ['retail', 'hardware'] },
      { page: 'clientes', label: 'Clientes', icon: UserRound },
    ],
  },
  {
    title: 'Crecimiento',
    items: [
      { page: 'reportes', label: 'Reportes', icon: BarChart3, perm: 'reportes.ver' },
      { page: 'oportunidades', label: 'Oportunidades', icon: Lightbulb, perm: 'reportes.ver' },
      { page: 'automatizaciones', label: 'Automatizaciones', icon: Workflow, perm: 'automatizaciones.gestionar' },
      { page: 'asistente', label: 'Asistente IA', icon: Sparkles },
    ],
  },
  {
    title: 'Control',
    items: [
      { page: 'comprobantes', label: 'Comprobantes ARCA', icon: FileText },
      { page: 'cobros', label: 'Cobros digitales', icon: CreditCard },
      { page: 'sincronizacion', label: 'Sincronización', icon: RefreshCw },
      { page: 'auditoria', label: 'Auditoría', icon: ClipboardList, perm: 'auditoria.ver' },
      { page: 'usuarios', label: 'Usuarios y permisos', icon: Users },
    ],
  },
]

export const pageTitle: Record<Page, string> = {
  panel: 'Panel general',
  inicio: 'Inicio',
  venta: 'Vender',
  caja: 'Caja',
  ventas: 'Ventas',
  productos: 'Productos',
  alertas: 'Stock',
  compras: 'Proveedores y compras',
  clientes: 'Clientes',
  presupuestos: 'Presupuestos',
  mostrador: 'Mostrador',
  reservas: 'Reservas',
  disponibilidad: 'Disponibilidad',
  equipos: 'Equipos y prendas',
  comprobantes: 'Comprobantes ARCA',
  cobros: 'Cobros digitales',
  reportes: 'Reportes',
  oportunidades: 'Oportunidades',
  automatizaciones: 'Automatizaciones',
  asistente: 'Asistente IA',
  sincronizacion: 'Sincronización',
  auditoria: 'Auditoría',
  usuarios: 'Usuarios y permisos',
}

/** pantallas disponibles para un rubro y un usuario */
export function pageAllowed(page: Page, kind: BusinessKind, me: Parameters<typeof can>[0]) {
  if (page === 'panel') return can(me, 'panel.conjunto')
  for (const g of groups) for (const n of g.items) if (n.page === page) return (!n.kinds || n.kinds.includes(kind)) && (!n.perm || can(me, n.perm))
  return false
}

/** firma discreta del proveedor de software */
export function SodiumSignature({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-400', className)}>
      <span className="h-1 w-1 rounded-full bg-brand-200/70 shadow-[0_0_6px_1px_rgba(200,225,248,0.6)]" />
      por <span className="font-semibold text-ink-200">Sodium</span>
    </div>
  )
}

export function BusinessDot({ id, className }: { id: BusinessId; className?: string }) {
  return <span className={cx('inline-block h-2 w-2 shrink-0 rounded-full', className)} style={{ background: businesses[id].color }} />
}

export function ConnectionPill({ dark }: { dark?: boolean }) {
  const online = useOnline()
  const syncing = useStore((s) => s.syncing)
  const pending = useStore((s) => s.queue.length + s.remoteSales.length)
  const setPage = useStore((s) => s.setPage)
  const loggedIn = useStore((s) => !!s.currentUserId)
  const state = syncing ? 'sync' : online ? 'on' : 'off'
  const label = { on: 'En línea', off: 'Sin conexión', sync: 'Sincronizando' }[state]
  const dot = { on: 'bg-emerald-400', off: 'bg-rose-400', sync: 'bg-amber-300' }[state]
  const shell = dark
    ? 'glass text-white hover:bg-white/15'
    : state === 'off'
      ? 'bg-rose-400/12 text-rose-200 ring-rose-300/40'
      : state === 'sync'
        ? 'bg-amber-400/12 text-amber-200 ring-amber-300/40'
        : 'bg-white/[0.06] text-ink-100 ring-white/20 hover:ring-white/30'
  const detail = `${label}${pending ? `, ${pending} operaciones por sincronizar` : ''}`
  return (
    <button
      onClick={() => loggedIn && setPage('sincronizacion')}
      className={cx('flex min-h-11 items-center gap-2 rounded-full px-3.5 text-xs font-bold ring-1 transition sm:min-h-10', shell)}
      aria-label={`Estado de conexión: ${detail}. Abrir sincronización`}
      title={detail}
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        {state !== 'off' && <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dot)} />}
        <span className={cx('relative inline-flex h-2 w-2 rounded-full', dot)} />
      </span>
      {state === 'sync' ? <RefreshCw size={14} className="animate-spin" aria-hidden /> : state === 'on' ? <Wifi size={14} aria-hidden /> : <WifiOff size={14} aria-hidden />}
      <span className="hidden sm:inline">{label}</span>
      {pending > 0 && <span className="tabular rounded-full bg-white px-1.5 py-px text-[11px] text-ink-900">{pending}</span>}
    </button>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const me = useMe()!
  const page = useStore((s) => s.page)
  const setPage = useStore((s) => s.setPage)
  const businessId = useStore((s) => s.businessId)
  const setBusiness = useStore((s) => s.setBusiness)
  const logout = useStore((s) => s.logout)
  const kind = businesses[businessId].kind
  // conteos para los avisos del menú (primitivos, para no re-renderizar de más)
  const alertas = useStore((s) => {
    const prods = s.products.filter((p) => p.businessId === s.businessId)
    const ids = new Set(prods.map((p) => p.id))
    const lotAlerts = s.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= s.expiryWarnDays).length
    const low = prods.filter((p) => s.lots.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0) <= p.minStock).length
    return lotAlerts + low
  })
  const comprobantes = useStore((s) => s.invoices.filter((i) => i.businessId === s.businessId && i.status !== 'emitido').length)
  const mostrador = useStore((s) => {
    const today = todayISO()
    return s.businessId === 'alquiler' ? s.reservations.filter((r) => (r.status === 'reservada' && r.from === today) || (r.status === 'entregada' && r.to <= today)).length : 0
  })
  const presupuestos = useStore((s) => s.quotes.filter((q) => q.businessId === s.businessId && q.status === 'abierto').length)
  const compras = useStore((s) => s.orders.filter((o) => o.businessId === s.businessId && o.status === 'borrador').length)
  const badges: Partial<Record<Page, number>> = { alertas, comprobantes, mostrador, presupuestos, compras }
  const [open, setOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const drawerRef = useRef<HTMLElement>(null)

  // al cambiar de pantalla se vuelve arriba
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [page, businessId])

  // menú del celular: Escape lo cierra, el foco entra y vuelve, y el fondo no se desplaza
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    drawerRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', esc)
    const lock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = lock
      prev?.focus?.({ preventScroll: true })
    }
  }, [open])

  const go = (p: Page) => {
    setPage(p)
    setOpen(false)
  }

  const isAdmin = me.businessId === null
  const consolidated = page === 'panel'
  const biz = businesses[businessId]

  const sidebar = (
    <nav aria-label="Menú principal" className="flex h-full flex-col border-r border-white/10 bg-ink-950/35 text-ink-200 backdrop-blur-xl">
      <div className="px-5 pb-4 pt-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-400">Gestión de negocios</div>
        <div className="mt-1 flex items-center gap-2 text-[17px] font-bold tracking-tight text-white">
          {consolidated ? <LayoutDashboard size={16} className="shrink-0 text-brand-200" aria-hidden /> : <BusinessDot id={businessId} className="h-2.5 w-2.5" />}
          <span className="wrap-any">{consolidated ? 'Todos los negocios' : biz.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink-400">{consolidated ? 'Vista consolidada' : 'Vista de un solo negocio'}</div>
      </div>

      {isAdmin && (
        <div className="mx-3 mb-4 space-y-1.5">
          <button
            onClick={() => go('panel')}
            aria-current={consolidated ? 'page' : undefined}
            className={cx('flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold transition', consolidated ? 'bg-white text-ink-900 shadow-glow' : 'glass text-white hover:bg-white/10')}
          >
            <LayoutDashboard size={17} aria-hidden /> Panel general
          </button>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.04] p-1 ring-1 ring-white/10" role="group" aria-label="Cambiar de negocio">
            {BUSINESS_IDS.map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBusiness(b)
                  if (page === 'panel') setPage('inicio')
                  setOpen(false)
                }}
                aria-pressed={businessId === b && !consolidated}
                className={cx(
                  'flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-left text-xs font-bold leading-tight transition',
                  businessId === b && !consolidated ? 'bg-white/[0.14] text-white ring-1 ring-white/20' : 'text-ink-300 hover:text-white',
                )}
              >
                <BusinessDot id={b} />
                <span className="wrap-any min-w-0">{businesses[b].name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        {groups.map((g) => {
          const items = g.items.filter((n) => (!n.kinds || n.kinds.includes(kind)) && (!n.perm || can(me, n.perm)))
          if (!items.length) return null
          return (
            <div key={g.title}>
              <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">{g.title}</div>
              <div className="space-y-0.5">
                {items.map((n) => {
                  const active = page === n.page
                  const label = typeof n.label === 'string' ? n.label : (n.label[kind] ?? Object.values(n.label)[0])
                  const badge = badges[n.page] ?? 0
                  return (
                    <button
                      key={n.page}
                      onClick={() => go(n.page)}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'group relative flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition',
                        active ? 'bg-white/[0.1] text-white ring-1 ring-inset ring-white/15' : 'text-ink-200 hover:bg-white/[0.05] hover:text-white',
                      )}
                    >
                      {active && <span className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-white shadow-[0_0_10px_2px_rgba(200,225,248,0.7)]" aria-hidden />}
                      <n.icon size={17} className={cx('shrink-0', active ? 'text-white' : 'text-ink-400 group-hover:text-ink-200')} aria-hidden />
                      <span className="min-w-0 flex-1 leading-tight">{label}</span>
                      {badge > 0 && (
                        <span className="tabular rounded-full bg-amber-300 px-1.5 text-xs font-bold text-amber-950" aria-label={`${badge} pendientes`}>
                          {badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="m-3 mt-0 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-brand-300 text-sm font-bold text-ink-900" aria-hidden>
            {me.name[0]}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="wrap-any text-sm font-bold text-white">{me.name}</div>
            <div className="wrap-any text-xs font-medium text-ink-300">
              {roleLabel[me.role]}
              {me.businessId ? ` · ${businesses[me.businessId].name}` : ' · todos los negocios'}
            </div>
          </div>
          <IconButton label="Cerrar sesión" onClick={logout}>
            <LogOut size={17} aria-hidden />
          </IconButton>
        </div>
      </div>
      <SodiumSignature className="justify-center pb-4" />
    </nav>
  )

  return (
    <div className="flex h-full">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="hidden w-[272px] shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <aside ref={drawerRef} className="absolute inset-y-0 left-0 w-[min(300px,88vw)] bg-ink-900 animate-rise" onClick={(e) => e.stopPropagation()}>
            <IconButton label="Cerrar menú" data-autofocus className="absolute right-2 top-4 z-10" onClick={() => setOpen(false)}>
              <X size={20} aria-hidden />
            </IconButton>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* encabezado: dónde estoy (negocio o consolidado), en qué sección y qué alcance tienen los datos */}
        <header
          className="no-print sticky top-0 z-20 border-b border-white/10 bg-ink-900/75 backdrop-blur-md"
          style={{ boxShadow: consolidated ? 'inset 0 3px 0 0 rgb(255 255 255 / 0.85)' : `inset 0 3px 0 0 ${biz.color}` }}
        >
          <div className="flex min-h-16 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
            <IconButton label="Abrir menú" className="lg:hidden" onClick={() => setOpen(true)}>
              <Menu size={20} aria-hidden />
            </IconButton>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold">
                {consolidated ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-ink-900">
                    <LayoutDashboard size={12} aria-hidden /> Vista consolidada · 4 negocios
                  </span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink-100">
                    <BusinessDot id={businessId} />
                    <span className="wrap-any">{biz.legalName}</span>
                    <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-ink-300 ring-1 ring-white/10">Solo este negocio · PV {biz.pointOfSale}</span>
                  </span>
                )}
              </div>
              <h2 className="wrap-any mt-0.5 text-base font-bold leading-tight text-white sm:text-lg">{pageTitle[page]}</h2>
            </div>
            {isAdmin && !consolidated && (
              <button
                onClick={() => setPage('panel')}
                className="hidden min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-ink-100 ring-1 ring-white/20 transition hover:bg-white/10 sm:inline-flex"
              >
                <ArrowLeft size={14} aria-hidden /> Panel general
              </button>
            )}
            <ConnectionPill />
          </div>
          {isAdmin && !consolidated && (
            <button onClick={() => setPage('panel')} className="flex min-h-11 w-full items-center gap-1.5 border-t border-white/10 px-4 text-xs font-semibold text-ink-200 hover:bg-white/5 sm:hidden">
              <ArrowLeft size={14} aria-hidden /> Volver al panel general (todos los negocios)
            </button>
          )}
        </header>
        <main id="contenido" tabIndex={-1} ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-28 outline-none sm:p-6 sm:pb-28 lg:p-8 lg:pb-16">
          {children}
        </main>
      </div>
    </div>
  )
}
