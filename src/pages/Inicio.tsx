import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, FileText, RefreshCw, ScanBarcode, Wallet } from 'lucide-react'
import { currentSession, stockOf, useMe, useStore, type Page } from '../store'
import { businesses } from '../data/seed'
import { can, roleLabel } from '../lib/permissions'
import { daysUntil, money, toISODate } from '../lib/format'
import type { BusinessId, Sale } from '../types'
import { Card, PageHeader, Stat, cx } from '../components/ui'

const dayKey = (iso: string) => toISODate(new Date(iso))

function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return toISODate(d)
  })
}

function totalsFor(sales: Sale[], biz: BusinessId, days: string[]) {
  const set = new Set(days)
  const own = sales.filter((s) => s.businessId === biz && s.status === 'completada' && set.has(dayKey(s.at)))
  return { total: own.reduce((a, s) => a + s.total, 0), count: own.length }
}

/** Barras de ventas por día: una sola serie, sin leyenda, con tooltip al pasar el mouse */
function SalesChart({ data }: { data: { day: string; total: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.total))
  const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
  return (
    <div>
      <div className="relative flex h-44 items-end gap-2 border-b border-slate-200 pt-6">
        {data.map((d, i) => (
          <div key={d.day} className="relative flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow">
                <div className="font-semibold">{money(d.total)}</div>
                <div className="text-slate-300">
                  {label(d.day)} · {d.count} ventas
                </div>
              </div>
            )}
            <div
              className={cx('w-full max-w-10 rounded-t transition-colors', i === data.length - 1 ? 'bg-brand-700' : hover === i ? 'bg-brand-600' : 'bg-brand-500/70')}
              style={{ height: `${Math.max(2, (d.total / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {data.map((d, i) => (
          <div key={d.day} className={cx('flex-1 text-center text-[11px] capitalize', i === data.length - 1 ? 'font-semibold text-slate-700' : 'text-slate-500')}>
            {i === data.length - 1 ? 'Hoy' : new Date(d.day + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Inicio() {
  const me = useMe()!
  const state = useStore()
  const biz = state.businessId
  const days = useMemo(() => lastDays(8), [])
  const today = days[days.length - 1]

  const bizSales = useMemo(
    () => state.sales.filter((s) => s.businessId === biz && s.status === 'completada' && (can(me.role, 'caja.verTodas') || s.userId === me.id)),
    [state.sales, biz, me],
  )
  const todays = bizSales.filter((s) => dayKey(s.at) === today)
  const todayTotal = todays.reduce((a, s) => a + s.total, 0)
  const cash = todays.reduce((a, s) => a + s.payments.filter((p) => p.method === 'efectivo').reduce((x, p) => x + p.amount, 0), 0)
  const chart = days.map((d) => {
    const list = bizSales.filter((s) => dayKey(s.at) === d)
    return { day: d, total: list.reduce((a, s) => a + s.total, 0), count: list.length }
  })

  const top = useMemo(() => {
    const m = new Map<string, { name: string; qty: number }>()
    for (const s of bizSales) for (const i of s.items) m.set(i.productId, { name: i.name, qty: (m.get(i.productId)?.qty ?? 0) + i.qty })
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [bizSales])

  const products = state.products.filter((p) => p.businessId === biz)
  const ids = new Set(products.map((p) => p.id))
  const expiring = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= state.expiryWarnDays).length
  const low = products.filter((p) => stockOf(state.lots, p.id) <= p.minStock).length
  const pendingInv = state.invoices.filter((i) => i.businessId === biz && i.status !== 'emitido').length
  const pendingOps = state.queue.length + state.remoteSales.length
  const session = currentSession(state)

  const shortcuts: { page: Page; icon: typeof Wallet; title: string; text: string; tone?: string }[] = [
    { page: 'venta', icon: ScanBarcode, title: 'Vender', text: session ? `${session.register} abierta` : 'Abrí tu caja para empezar' },
    { page: 'alertas', icon: AlertTriangle, title: 'Alertas de stock', text: `${expiring} por vencer o vencidos · ${low} bajo mínimo`, tone: expiring + low ? 'text-amber-600' : undefined },
    { page: 'comprobantes', icon: FileText, title: 'Comprobantes', text: pendingInv ? `${pendingInv} pendientes o rechazados` : 'Todo emitido', tone: pendingInv ? 'text-amber-600' : undefined },
    { page: 'sincronizacion', icon: RefreshCw, title: 'Sincronización', text: pendingOps ? `${pendingOps} operaciones sin enviar` : 'Todo sincronizado', tone: pendingOps ? 'text-amber-600' : undefined },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hola, ${me.name.split(' ')[0]}`}
        subtitle={`${roleLabel[me.role]} · ${businesses[biz].name} · ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={can(me.role, 'caja.verTodas') ? 'Ventas de hoy' : 'Mis ventas de hoy'} value={money(todayTotal)} />
        <Stat label="Tickets" value={todays.length} />
        <Stat label="Ticket promedio" value={money(todays.length ? todayTotal / todays.length : 0)} />
        <Stat label="Efectivo / transferencia" value={money(cash)} hint={`${money(todayTotal - cash)} por transferencia`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card className="p-4">
          <div className="mb-1 font-semibold">Ventas por día</div>
          <div className="text-xs text-slate-500">Últimos 7 días y hoy, en pesos</div>
          <SalesChart data={chart} />
        </Card>
        <Card className="p-4">
          <div className="mb-3 font-semibold">Más vendidos (8 días)</div>
          {top.map((t, i) => (
            <div key={t.name} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="w-4 text-xs text-slate-400">{i + 1}</span>
              <span className="flex-1 truncate">{t.name}</span>
              <span className="tabular font-medium text-slate-700">{t.qty} u.</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {shortcuts.map((s) => (
          <button key={s.page} onClick={() => state.setPage(s.page)} className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-brand-500">
            <div className="flex items-center justify-between">
              <s.icon size={20} className="text-brand-600" />
              <ArrowRight size={16} className="text-slate-300 group-hover:text-brand-600" />
            </div>
            <div className="mt-2 font-medium">{s.title}</div>
            <div className={cx('text-xs', s.tone ?? 'text-slate-500')}>{s.text}</div>
          </button>
        ))}
      </div>

      {can(me.role, 'panel.conjunto') && <BothBusinesses days={days} />}
    </div>
  )
}

function BothBusinesses({ days }: { days: string[] }) {
  const sales = useStore((s) => s.sales)
  const today = [days[days.length - 1]]
  const rows = (Object.keys(businesses) as BusinessId[]).map((b) => ({ b, hoy: totalsFor(sales, b, today), semana: totalsFor(sales, b, days) }))
  const sum = (k: 'hoy' | 'semana') => rows.reduce((a, r) => a + r[k].total, 0)
  return (
    <Card className="mt-4 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-semibold">Ambos negocios</span>
        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-200">Vista previa add-on A3</span>
        <span className="text-xs text-slate-500">Solo visible para el Administrador</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5 font-medium">Negocio</th>
              <th className="py-1.5 text-right font-medium">Hoy</th>
              <th className="py-1.5 text-right font-medium">Tickets hoy</th>
              <th className="py-1.5 text-right font-medium">8 días</th>
              <th className="py-1.5 text-right font-medium">Participación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.b} className="border-t border-slate-100">
                <td className="py-2 font-medium">{businesses[r.b].name}</td>
                <td className="tabular py-2 text-right">{money(r.hoy.total)}</td>
                <td className="tabular py-2 text-right">{r.hoy.count}</td>
                <td className="tabular py-2 text-right">{money(r.semana.total)}</td>
                <td className="tabular py-2 text-right text-slate-500">{sum('semana') ? Math.round((r.semana.total / sum('semana')) * 100) : 0}%</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 font-semibold">
              <td className="py-2">Total</td>
              <td className="tabular py-2 text-right">{money(sum('hoy'))}</td>
              <td className="tabular py-2 text-right">{rows.reduce((a, r) => a + r.hoy.count, 0)}</td>
              <td className="tabular py-2 text-right">{money(sum('semana'))}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
