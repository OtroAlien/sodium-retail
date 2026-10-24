import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, FileText, RefreshCw, ScanBarcode, TrendingUp, Wallet } from 'lucide-react'
import { categoryStyle } from '../lib/categories'
import { currentSession, stockOf, useMe, useStore, type Page } from '../store'
import { businesses } from '../data/seed'
import { can, roleLabel } from '../lib/permissions'
import { daysUntil, money, toISODate } from '../lib/format'
import type { BusinessId, Sale } from '../types'
import { Card, IconBubble, PageHeader, cx } from '../components/ui'

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

/** Barras de ventas por día: una sola serie (sin leyenda), barras finas, eje discreto y tooltip al pasar el mouse */
function SalesChart({ data }: { data: { day: string; total: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.total))
  const label = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })
  return (
    <div>
      <div className="relative mt-4 h-48">
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-ink-900/[0.07]" style={{ bottom: `${f * 100}%` }}>
            <span className="tabular absolute -top-2.5 left-0 bg-white pr-2 text-[10px] font-semibold text-ink-300">{money(max * f).replace(',00', '')}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-3 border-b border-ink-900/10 pl-16">
          {data.map((d, i) => {
            const isToday = i === data.length - 1
            return (
              <div key={d.day} className="relative flex h-full flex-1 cursor-default items-end justify-center" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-xl bg-ink-900 px-3 py-2 text-xs text-white shadow-xl">
                    <div className="tabular text-sm font-extrabold text-lime-400">{money(d.total)}</div>
                    <div className="capitalize text-ink-300">
                      {isToday ? 'Hoy' : label(d.day)} · {d.count} ventas
                    </div>
                  </div>
                )}
                <div
                  className={cx('w-full max-w-9 rounded-t-[4px] transition-all', isToday ? 'bg-brand-600' : hover === i ? 'bg-brand-500' : 'bg-brand-300')}
                  style={{ height: `${Math.max(1.5, (d.total / max) * 100)}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-3 pl-16">
        {data.map((d, i) => (
          <div key={d.day} className={cx('flex-1 text-center text-[11px] capitalize', i === data.length - 1 ? 'font-extrabold text-ink-900' : 'font-medium text-ink-400')}>
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
  const prevAvg = chart.slice(0, -1).reduce((a, d) => a + d.total, 0) / 7
  const cashPct = todayTotal ? Math.round((cash / todayTotal) * 100) : 0

  const top = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; category: string }>()
    for (const s of bizSales)
      for (const i of s.items) {
        const p = state.products.find((x) => x.id === i.productId)
        m.set(i.productId, { name: i.name, category: p?.category ?? '', qty: (m.get(i.productId)?.qty ?? 0) + i.qty })
      }
    return [...m.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
  }, [bizSales, state.products])

  const products = state.products.filter((p) => p.businessId === biz)
  const ids = new Set(products.map((p) => p.id))
  const expiring = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= state.expiryWarnDays).length
  const low = products.filter((p) => stockOf(state.lots, p.id) <= p.minStock).length
  const pendingInv = state.invoices.filter((i) => i.businessId === biz && i.status !== 'emitido').length
  const pendingOps = state.queue.length + state.remoteSales.length
  const session = currentSession(state)

  const shortcuts: { page: Page; icon: typeof Wallet; title: string; text: string; warn?: boolean }[] = [
    { page: 'venta', icon: ScanBarcode, title: 'Vender', text: session ? `${session.register} abierta` : 'Abrí tu caja para empezar' },
    { page: 'alertas', icon: AlertTriangle, title: 'Alertas de stock', text: `${expiring} por vencer · ${low} bajo mínimo`, warn: expiring + low > 0 },
    { page: 'comprobantes', icon: FileText, title: 'Comprobantes', text: pendingInv ? `${pendingInv} pendientes o rechazados` : 'Todo emitido', warn: pendingInv > 0 },
    { page: 'sincronizacion', icon: RefreshCw, title: 'Sincronización', text: pendingOps ? `${pendingOps} operaciones sin enviar` : 'Todo sincronizado', warn: pendingOps > 0 },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hola, ${me.name.split(' ')[0]} 👋`}
        subtitle={`${roleLabel[me.role]} · ${businesses[biz].name} · ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      {/* Hero: la cifra del día, lo primero que se mira */}
      <div className="ink-surface relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl animate-rise sm:p-7">
        <div className="grid-dots absolute inset-0 opacity-60" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="text-sm font-semibold text-ink-300">{can(me.role, 'caja.verTodas') ? 'Ventas de hoy' : 'Mis ventas de hoy'}</div>
            <div className="tabular mt-1 text-5xl font-extrabold tracking-tight text-lime-400 sm:text-6xl">{money(todayTotal)}</div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-ink-200 ring-1 ring-white/10">
              <TrendingUp size={14} className="text-lime-400" />
              Promedio diario de la semana: <span className="tabular text-white">{money(prevAvg)}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:min-w-[380px]">
            {[
              { k: 'Tickets', v: String(todays.length) },
              { k: 'Promedio', v: money(todays.length ? todayTotal / todays.length : 0) },
              { k: 'Efectivo', v: `${cashPct}%` },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                <div className="text-[11px] font-semibold text-ink-300">{x.k}</div>
                <div className="tabular mt-1 whitespace-nowrap text-base font-extrabold sm:text-lg">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((s, i) => (
          <button
            key={s.page}
            onClick={() => state.setPage(s.page)}
            style={{ animationDelay: `${i * 40}ms` }}
            className="group flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-soft ring-1 ring-ink-900/[0.06] transition animate-rise hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200"
          >
            <IconBubble tone={s.warn ? 'amber' : 'brand'}>
              <s.icon size={18} />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-ink-900">{s.title}</div>
              <div className={cx('truncate text-xs font-medium', s.warn ? 'text-amber-600' : 'text-ink-400')}>{s.text}</div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-ink-200 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="font-bold text-ink-900">Ventas por día</div>
          <div className="text-xs text-ink-400">Últimos 7 días y hoy, en pesos</div>
          <SalesChart data={chart} />
        </Card>
        <Card className="p-5">
          <div className="mb-4 font-bold text-ink-900">Más vendidos</div>
          <div className="space-y-3.5">
            {top.map((t, i) => {
              const { icon: Icon, tone } = categoryStyle(t.category)
              return (
                <div key={t.name} className="flex items-center gap-3">
                  <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-semibold text-ink-900">{t.name}</span>
                      <span className="tabular shrink-0 font-bold text-ink-700">{t.qty} u.</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-900/[0.05]">
                      <div className={cx('h-full rounded-full', i === 0 ? 'bg-brand-500' : 'bg-brand-300')} style={{ width: `${(t.qty / top[0].qty) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 text-[11px] text-ink-300">Unidades vendidas en los últimos 8 días</div>
        </Card>
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
    <Card className="mt-4 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-bold text-ink-900">Ambos negocios</span>
        <span className="rounded-full bg-ink-900 px-2.5 py-0.5 text-[11px] font-bold text-lime-400">Vista previa add-on A3</span>
        <span className="text-xs text-ink-400">Solo visible para el Administrador</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-400">
            <tr>
              <th className="py-1.5 font-bold">Negocio</th>
              <th className="py-1.5 text-right font-bold">Hoy</th>
              <th className="py-1.5 text-right font-bold">Tickets hoy</th>
              <th className="py-1.5 text-right font-bold">8 días</th>
              <th className="py-1.5 text-right font-bold">Participación</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.b} className="border-t border-ink-900/[0.06]">
                <td className="py-2 font-bold">{businesses[r.b].name}</td>
                <td className="tabular py-2 text-right">{money(r.hoy.total)}</td>
                <td className="tabular py-2 text-right">{r.hoy.count}</td>
                <td className="tabular py-2 text-right">{money(r.semana.total)}</td>
                <td className="tabular py-2 text-right text-ink-400">{sum('semana') ? Math.round((r.semana.total / sum('semana')) * 100) : 0}%</td>
              </tr>
            ))}
            <tr className="border-t border-ink-900/10 font-semibold">
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
