import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Menu,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  Store,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { useMe, useOnline, useStore, type Page } from '../store'
import { businesses } from '../data/seed'
import { can, roleLabel, type Permission } from '../lib/permissions'
import { daysUntil } from '../lib/format'
import { cx } from './ui'
import type { BusinessId } from '../types'

type NavItem = { page: Page; label: string; icon: typeof Home; perm?: Permission; module?: string }

const groups: { title: string; items: NavItem[] }[] = [
  {
    title: 'Operación',
    items: [
      { page: 'inicio', label: 'Inicio', icon: Home },
      { page: 'venta', label: 'Vender', icon: ScanBarcode, module: 'M1' },
      { page: 'caja', label: 'Caja', icon: Wallet, module: 'M1' },
      { page: 'ventas', label: 'Ventas', icon: ReceiptText, module: 'M1' },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { page: 'productos', label: 'Productos y precios', icon: Boxes, module: 'M2' },
      { page: 'alertas', label: 'Stock y vencimientos', icon: AlertTriangle, module: 'M2' },
      { page: 'comprobantes', label: 'Comprobantes ARCA', icon: FileText, module: 'M5' },
      { page: 'sincronizacion', label: 'Sincronización', icon: RefreshCw, module: 'M4' },
    ],
  },
  {
    title: 'Control',
    items: [
      { page: 'auditoria', label: 'Auditoría', icon: ClipboardList, perm: 'auditoria.ver', module: 'M3' },
      { page: 'usuarios', label: 'Usuarios y roles', icon: Users, perm: 'usuarios.gestionar', module: 'M3' },
    ],
  },
]

const pageTitle: Record<Page, string> = {
  inicio: 'Inicio',
  venta: 'Vender',
  caja: 'Caja',
  ventas: 'Ventas',
  productos: 'Productos y precios',
  alertas: 'Stock y vencimientos',
  comprobantes: 'Comprobantes ARCA',
  sincronizacion: 'Sincronización',
  auditoria: 'Auditoría',
  usuarios: 'Usuarios y roles',
}

export function ConnectionPill({ dark }: { dark?: boolean }) {
  const online = useOnline()
  const syncing = useStore((s) => s.syncing)
  const pending = useStore((s) => s.queue.length + s.remoteSales.length)
  const setPage = useStore((s) => s.setPage)
  const state = syncing ? 'sync' : online ? 'on' : 'off'
  const label = { on: 'En línea', off: 'Sin conexión', sync: 'Sincronizando' }[state]
  const dot = { on: 'bg-emerald-500', off: 'bg-rose-500', sync: 'bg-amber-500' }[state]
  const shell = dark
    ? 'bg-white/10 text-white ring-white/15 hover:bg-white/15'
    : state === 'off'
      ? 'bg-rose-50 text-rose-700 ring-rose-200'
      : state === 'sync'
        ? 'bg-amber-50 text-amber-800 ring-amber-200'
        : 'bg-white text-ink-700 ring-ink-200 hover:ring-ink-300'
  return (
    <button onClick={() => setPage('sincronizacion')} className={cx('flex h-9 items-center gap-2 rounded-full px-3.5 text-xs font-bold ring-1 transition', shell)} title="Estado de conexión (M4)">
      <span className="relative flex h-2 w-2">
        {state !== 'off' && <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', dot)} />}
        <span className={cx('relative inline-flex h-2 w-2 rounded-full', dot)} />
      </span>
      {state === 'sync' ? <RefreshCw size={13} className="animate-spin" /> : state === 'on' ? <Wifi size={13} /> : <WifiOff size={13} />}
      <span className="hidden sm:inline">{label}</span>
      {pending > 0 && <span className="tabular rounded-full bg-ink-900 px-1.5 py-px text-[10px] text-lime-400">{pending}</span>}
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
  const alertCount = useStore((s) => {
    const prods = s.products.filter((p) => p.businessId === s.businessId)
    const ids = new Set(prods.map((p) => p.id))
    const lotAlerts = s.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= s.expiryWarnDays).length
    const low = prods.filter((p) => s.lots.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0) <= p.minStock).length
    return lotAlerts + low
  })
  const pendingInvoices = useStore((s) => s.invoices.filter((i) => i.businessId === s.businessId && i.status !== 'emitido').length)
  const [open, setOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // al cambiar de pantalla se vuelve arriba
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [page, businessId])

  const go = (p: Page) => {
    setPage(p)
    setOpen(false)
  }

  const sidebar = (
    <nav className="ink-surface flex h-full flex-col text-ink-200">
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <img src="./icon.svg" alt="" className="h-10 w-10 rounded-xl" />
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-white">Súper y Kiosco</div>
          <div className="text-[11px] font-medium text-ink-300">
            por <span className="text-lime-400">Sodium</span>
          </div>
        </div>
      </div>

      <div className="mx-4 mb-5">
        {me.businessId === null ? (
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.06] p-1 ring-1 ring-white/10">
            {(Object.keys(businesses) as BusinessId[]).map((b) => (
              <button
                key={b}
                onClick={() => setBusiness(b)}
                className={cx('rounded-xl px-2 py-2 text-xs font-bold transition', businessId === b ? 'bg-white text-ink-900 shadow' : 'text-ink-300 hover:text-white')}
              >
                {businesses[b].name}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-2.5 text-xs ring-1 ring-white/10">
            <Store size={14} className="text-lime-400" />
            <span className="font-bold text-white">{businesses[businessId].name}</span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3">
        {groups.map((g) => {
          const items = g.items.filter((n) => !n.perm || can(me.role, n.perm))
          if (!items.length) return null
          return (
            <div key={g.title}>
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{g.title}</div>
              <div className="space-y-0.5">
                {items.map((n) => {
                  const active = page === n.page
                  const badge = n.page === 'alertas' ? alertCount : n.page === 'comprobantes' ? pendingInvoices : 0
                  return (
                    <button
                      key={n.page}
                      onClick={() => go(n.page)}
                      className={cx(
                        'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition',
                        active ? 'bg-white/[0.09] text-white' : 'text-ink-300 hover:bg-white/[0.05] hover:text-white',
                      )}
                    >
                      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-lime-400" />}
                      <n.icon size={18} className={cx('shrink-0', active ? 'text-lime-400' : 'text-ink-400 group-hover:text-ink-200')} />
                      <span className="flex-1">{n.label}</span>
                      {badge > 0 && <span className="tabular rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-amber-950">{badge}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="m-3 rounded-2xl bg-white/[0.06] p-2 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-sm font-extrabold text-white">{me.name[0]}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-bold text-white">{me.name}</div>
            <div className="text-[11px] font-medium text-ink-300">{roleLabel[me.role]}</div>
          </div>
          <button onClick={logout} className="rounded-lg p-2 text-ink-300 transition hover:bg-white/10 hover:text-white" title="Cerrar sesión">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-[264px] shrink-0 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-[284px] animate-rise" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-6 z-10 rounded-lg p-1.5 text-ink-300 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-ink-900/[0.06] bg-canvas/80 px-4 backdrop-blur-md sm:px-6">
          <button className="rounded-xl p-2 text-ink-700 hover:bg-ink-900/5 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm">
            <span className="text-ink-400">{businesses[businessId].legalName}</span>
            <span className="mx-2 text-ink-200">/</span>
            <span className="font-bold text-ink-900">{pageTitle[page]}</span>
          </div>
          <span className="hidden rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 ring-1 ring-ink-200 md:inline">PV {businesses[businessId].pointOfSale}</span>
          <ConnectionPill />
        </header>
        <main ref={mainRef} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
