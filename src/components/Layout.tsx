import { useState, type ReactNode } from 'react'
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
  ShieldCheck,
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

const nav: { page: Page; label: string; icon: typeof Home; perm?: Permission; module: string }[] = [
  { page: 'inicio', label: 'Inicio', icon: Home, module: '' },
  { page: 'venta', label: 'Vender', icon: ScanBarcode, module: 'M1' },
  { page: 'caja', label: 'Caja', icon: Wallet, module: 'M1' },
  { page: 'ventas', label: 'Ventas', icon: ReceiptText, module: 'M1' },
  { page: 'productos', label: 'Productos y precios', icon: Boxes, module: 'M2' },
  { page: 'alertas', label: 'Stock y vencimientos', icon: AlertTriangle, module: 'M2' },
  { page: 'comprobantes', label: 'Comprobantes ARCA', icon: FileText, module: 'M5' },
  { page: 'sincronizacion', label: 'Sincronización', icon: RefreshCw, module: 'M4' },
  { page: 'auditoria', label: 'Auditoría', icon: ClipboardList, perm: 'auditoria.ver', module: 'M3' },
  { page: 'usuarios', label: 'Usuarios y roles', icon: Users, perm: 'usuarios.gestionar', module: 'M3' },
]

export function ConnectionPill({ compact }: { compact?: boolean }) {
  const online = useOnline()
  const syncing = useStore((s) => s.syncing)
  const pending = useStore((s) => s.queue.length + s.remoteSales.length)
  const setPage = useStore((s) => s.setPage)
  const state = syncing ? 'sync' : online ? 'on' : 'off'
  const styles = {
    on: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    off: 'bg-rose-50 text-rose-700 ring-rose-200',
    sync: 'bg-amber-50 text-amber-800 ring-amber-200',
  }[state]
  const label = { on: 'Con conexión', off: 'Sin conexión', sync: 'Sincronizando…' }[state]
  return (
    <button onClick={() => setPage('sincronizacion')} className={cx('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1', styles)} title="Estado de conexión (M4)">
      {state === 'sync' ? <RefreshCw size={14} className="animate-spin" /> : state === 'on' ? <Wifi size={14} /> : <WifiOff size={14} />}
      {!compact && label}
      {pending > 0 && <span className="tabular rounded-full bg-white/80 px-1.5 text-[11px]">{pending} pendiente{pending > 1 ? 's' : ''}</span>}
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

  const items = nav.filter((n) => !n.perm || can(me.role, n.perm))
  const go = (p: Page) => {
    setPage(p)
    setOpen(false)
  }

  const sidebar = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <img src="./icon.svg" alt="" className="h-9 w-9" />
        <div className="leading-tight">
          <div className="font-semibold text-white">Súper y Kiosco</div>
          <div className="text-[11px] text-brand-200">Demo · Sodium</div>
        </div>
      </div>

      {me.businessId === null ? (
        <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-lg bg-brand-900/60 p-1">
          {(Object.keys(businesses) as BusinessId[]).map((b) => (
            <button key={b} onClick={() => setBusiness(b)} className={cx('rounded-md px-2 py-1.5 text-xs font-medium', businessId === b ? 'bg-white text-brand-800' : 'text-brand-100 hover:bg-brand-800')}>
              {businesses[b].name}
            </button>
          ))}
        </div>
      ) : (
        <div className="mx-3 mb-3 rounded-lg bg-brand-900/60 px-3 py-2 text-xs text-brand-100">
          Negocio: <span className="font-semibold text-white">{businesses[businessId].name}</span>
        </div>
      )}

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {items.map((n) => {
          const badge = n.page === 'alertas' ? alertCount : n.page === 'comprobantes' ? pendingInvoices : 0
          return (
            <button
              key={n.page}
              onClick={() => go(n.page)}
              className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm', page === n.page ? 'bg-white/15 font-semibold text-white' : 'text-brand-100 hover:bg-white/10')}
            >
              <n.icon size={18} className="shrink-0" />
              <span className="flex-1">{n.label}</span>
              {badge > 0 && <span className="tabular rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-amber-950">{badge}</span>}
              {n.module && <span className="font-mono text-[10px] text-brand-200/70">{n.module}</span>}
            </button>
          )
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">{me.name[0]}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-medium text-white">{me.name}</div>
            <div className="flex items-center gap-1 text-[11px] text-brand-200">
              <ShieldCheck size={11} /> {roleLabel[me.role]}
            </div>
          </div>
          <button onClick={logout} className="rounded-md p-2 text-brand-200 hover:bg-white/10 hover:text-white" title="Cerrar sesión">
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </nav>
  )

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 bg-brand-800 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-800" onClick={(e) => e.stopPropagation()}>
            <button className="absolute right-3 top-4 p-1 text-brand-100" onClick={() => setOpen(false)} aria-label="Cerrar menú">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
          <button className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-500">
            <span className="font-medium text-slate-800">{businesses[businessId].legalName}</span>
            <span className="hidden sm:inline"> · Punto de venta {businesses[businessId].pointOfSale}</span>
          </div>
          <ConnectionPill />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
