import { useMemo } from 'react'
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarClock, FileSignature, FileText, Lightbulb, RefreshCw, ScanBarcode, Shirt, Store, TrendingUp, Truck, Wallet } from 'lucide-react'
import { currentSession, stockOf, useMe, useStore, type Page } from '../store'
import { clientBalance } from '../store/selectors'
import { businesses } from '../data/seed'
import { can, roleLabel } from '../lib/permissions'
import { date, daysUntil, money, todayISO } from '../lib/format'
import { byDay, dayKey, opportunities, salesIn, topProducts } from '../lib/analytics'
import { categoryStyle } from '../lib/categories'
import { lateDays } from '../lib/rental'
import { Badge, Card, IconBubble, PageHeader, cx } from '../components/ui'
import { DayBars } from '../components/charts'

export default function Inicio() {
  const me = useMe()!
  const state = useStore()
  const biz = state.businessId
  const kind = businesses[biz].kind
  const today = todayISO()
  const own = can(me, 'caja.verTodas')

  const sales8 = useMemo(() => salesIn(state.sales, biz, 8).filter((s) => own || s.userId === me.id), [state.sales, biz, own, me.id])
  const todays = sales8.filter((s) => dayKey(s.at) === today)
  const todayTotal = todays.reduce((a, s) => a + s.total, 0)
  const prevAvg = sales8.filter((s) => dayKey(s.at) !== today).reduce((a, s) => a + s.total, 0) / 7
  const cash = todays.reduce((a, s) => a + s.payments.filter((p) => p.method === 'efectivo').reduce((x, p) => x + p.amount, 0), 0)
  const top = useMemo(() => topProducts(sales8, state.products, 5), [sales8, state.products])
  const opps = useMemo(() => (can(me, 'reportes.ver') ? opportunities(state, biz).slice(0, 3) : []), [state, biz, me])

  const products = state.products.filter((p) => p.businessId === biz)
  const ids = new Set(products.map((p) => p.id))
  const expiring = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= state.expiryWarnDays).length
  const low = products.filter((p) => stockOf(state.lots, p.id) <= p.minStock).length
  const pendingInv = state.invoices.filter((i) => i.businessId === biz && i.status !== 'emitido').length
  const pendingOps = state.queue.length + state.remoteSales.length
  const session = currentSession(state)
  const receivable = state.clients.filter((c) => c.businessId === biz).reduce((a, c) => a + Math.max(0, clientBalance(state.accounts, c.id)), 0)

  // alquiler
  const pickups = state.reservations.filter((r) => r.status === 'reservada' && r.from === today)
  const returns = state.reservations.filter((r) => r.status === 'entregada' && r.to === today)
  const late = state.reservations.filter((r) => r.status === 'entregada' && r.to < today)
  const out = state.rentalItems.filter((i) => i.state === 'alquilado').length
  const cleaning = state.rentalItems.filter((i) => i.state === 'limpieza').length
  const repair = state.rentalItems.filter((i) => i.state === 'mantenimiento' || i.state === 'dañado').length
  const upcoming = state.reservations.filter((r) => r.status === 'reservada' && r.from > today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, 5)
  const openQuotes = state.quotes.filter((q) => q.businessId === biz && q.status === 'abierto')

  type Shortcut = { page: Page; icon: typeof Wallet; title: string; text: string; warn?: boolean }
  const shortcuts: Shortcut[] =
    kind === 'rental'
      ? [
          { page: 'mostrador', icon: Store, title: 'Mostrador', text: `${pickups.length} retiros · ${returns.length + late.length} devoluciones`, warn: late.length > 0 },
          { page: 'reservas', icon: CalendarCheck, title: 'Reservas', text: `${state.reservations.filter((r) => r.status === 'reservada').length} pendientes de retiro` },
          { page: 'equipos', icon: Shirt, title: 'Equipos y prendas', text: `${cleaning} en limpieza · ${repair} en revisión`, warn: repair > 0 },
          { page: 'comprobantes', icon: FileText, title: 'Comprobantes', text: pendingInv ? `${pendingInv} pendientes o rechazados` : 'Todo emitido', warn: pendingInv > 0 },
        ]
      : [
          { page: 'venta', icon: ScanBarcode, title: 'Vender', text: session ? `${session.register} abierta` : 'Abrí tu caja para empezar' },
          kind === 'hardware'
            ? { page: 'presupuestos', icon: FileSignature, title: 'Presupuestos', text: `${openQuotes.length} abiertos · ${money(openQuotes.reduce((a, q) => a + q.total, 0))}`, warn: openQuotes.length > 0 }
            : { page: 'alertas', icon: AlertTriangle, title: 'Alertas de stock', text: `${expiring} por vencer · ${low} bajo mínimo`, warn: expiring + low > 0 },
          { page: kind === 'hardware' ? 'alertas' : 'compras', icon: Truck, title: kind === 'hardware' ? 'Reposición' : 'Compras', text: `${low} productos bajo mínimo`, warn: low > 0 },
          { page: 'sincronizacion', icon: RefreshCw, title: 'Sincronización', text: pendingOps ? `${pendingOps} operaciones sin enviar` : 'Todo sincronizado', warn: pendingOps > 0 },
        ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Hola, ${me.name.split(' ')[0]}`}
        subtitle={`${roleLabel[me.role]} · ${businesses[biz].name} · ${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      />

      {kind === 'rental' ? (
        <div className="ink-surface relative overflow-hidden rounded-3xl p-6 text-white animate-rise sm:p-7">
          <div className="grid-dots absolute inset-0 opacity-60" />
          <div className="relative">
            <div className="text-sm font-semibold text-ink-300">Hoy en el mostrador</div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[
                { k: 'Retiran hoy', v: pickups.length, warn: false },
                { k: 'Devuelven hoy', v: returns.length, warn: false },
                { k: 'Devoluciones atrasadas', v: late.length, warn: late.length > 0 },
                { k: 'Unidades en la calle', v: out, warn: false },
              ].map((x) => (
                <div key={x.k} className={cx('rounded-2xl p-3 ring-1', x.warn ? 'bg-rose-400/15 ring-rose-300/30' : 'bg-white/[0.06] ring-white/10')}>
                  <div className="text-xs font-semibold text-ink-300">{x.k}</div>
                  <div className="tabular text-glow mt-1 text-3xl font-bold">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-ink-200 ring-1 ring-white/10">
              <TrendingUp size={14} className="text-brand-200" />
              Cobrado hoy: <span className="tabular text-white">{money(todayTotal)}</span> · {cleaning} prendas en limpieza
            </div>
          </div>
        </div>
      ) : (
        <div className="ink-surface relative overflow-hidden rounded-3xl p-6 text-white animate-rise sm:p-7">
          <div className="grid-dots absolute inset-0 opacity-60" />
          <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="text-sm font-semibold text-ink-300">{own ? 'Ventas de hoy' : 'Mis ventas de hoy'}</div>
              <div className="tabular text-glow mt-1 text-[clamp(1.9rem,9.5vw,3.75rem)] font-bold leading-none tracking-tight text-white wrap-any">{money(todayTotal)}</div>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-ink-200 ring-1 ring-white/10">
                <TrendingUp size={14} className="text-brand-200" />
                Promedio diario de la semana: <span className="tabular text-white">{money(prevAvg)}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3 lg:min-w-[380px]">
              {[
                { k: 'Tickets', v: String(todays.length) },
                { k: 'Promedio', v: money(todays.length ? todayTotal / todays.length : 0) },
                kind === 'hardware' ? { k: 'A cobrar (cta. cte.)', v: money(receivable) } : { k: 'Efectivo', v: `${todayTotal ? Math.round((cash / todayTotal) * 100) : 0}%` },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                  <div className="wrap-any text-xs font-semibold text-ink-300">{x.k}</div>
                  <div className="tabular wrap-any mt-1 text-lg font-bold">{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shortcuts.map((s, i) => (
          <button
            key={s.page}
            onClick={() => state.setPage(s.page)}
            style={{ animationDelay: `${i * 40}ms` }}
            className="glass group flex items-center gap-3 rounded-2xl p-4 text-left transition animate-rise hover:-translate-y-0.5 hover:shadow-lift"
          >
            <IconBubble tone={s.warn ? 'amber' : 'brand'}>
              <s.icon size={18} />
            </IconBubble>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white">{s.title}</div>
              <div className={cx('wrap-any text-xs font-medium', s.warn ? 'text-amber-200' : 'text-ink-300')}>{s.text}</div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-white" />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="p-5">
          <div className="font-bold text-white">{kind === 'rental' ? 'Cobros por día' : 'Ventas por día'}</div>
          <div className="text-xs text-ink-300">Últimos 7 días y hoy, en pesos</div>
          <DayBars data={byDay(sales8, 8)} />
        </Card>
        {kind === 'rental' ? (
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-bold text-white">Próximas reservas</span>
              <button onClick={() => state.setPage('reservas')} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-200 hover:text-white">
                Ver todas
              </button>
            </div>
            <div className="space-y-2.5">
              {upcoming.map((r) => (
                <div key={r.id} className="flex items-center gap-3">
                  <IconBubble>
                    <CalendarClock size={16} />
                  </IconBubble>
                  <div className="min-w-0 flex-1">
                    <div className="wrap-any text-sm font-semibold text-white">{state.clients.find((c) => c.id === r.clientId)?.name}</div>
                    <div className="text-xs text-ink-300">
                      {date(r.from)} · {r.days} días · {r.lines.reduce((a, l) => a + l.qty, 0)} unidades
                    </div>
                  </div>
                  <span className="tabular text-sm font-semibold text-white">{money(r.total)}</span>
                </div>
              ))}
              {late.map((r) => (
                <div key={r.id} className="rounded-xl bg-rose-400/12 px-3 py-2 text-xs text-rose-200 ring-1 ring-rose-300/25">
                  Reserva #{r.number} atrasada {lateDays(r.to, today)} día(s): {state.clients.find((c) => c.id === r.clientId)?.name}
                </div>
              ))}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="mb-4 font-bold text-white">Más vendidos</div>
            <div className="space-y-3.5">
              {top.map((t, i) => {
                const { icon: Icon, tone } = categoryStyle(t.category)
                return (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="wrap-any font-semibold text-white">{t.name}</span>
                        <span className="tabular shrink-0 font-bold text-ink-200">{money(t.total)}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className={cx('h-full rounded-full', i === 0 ? 'bg-white' : 'bg-brand-400')} style={{ width: `${(t.total / top[0].total) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 text-xs text-ink-400">Facturación de los últimos 8 días</div>
          </Card>
        )}
      </div>

      {opps.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-white">
              <Lightbulb size={17} className="text-brand-200" /> Oportunidades detectadas
            </span>
            <button onClick={() => state.setPage('oportunidades')} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-brand-200 hover:text-white">
              Ver y actuar
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {opps.map((o) => (
              <button key={o.id} onClick={() => state.setPage('oportunidades')} className="rounded-2xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition hover:bg-white/[0.08]">
                <div className="text-sm font-semibold text-white">{o.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone="brand">{money(o.value)} en juego</Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
