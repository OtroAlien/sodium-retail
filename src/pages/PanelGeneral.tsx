import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, DatabaseBackup, MessageCircle, ServerCog } from 'lucide-react'
import { useOnline, useStore, type Page } from '../store'
import { clientBalance, stockOf, supplierBalance } from '../store/selectors'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { dateTime, daysUntil, money, todayISO } from '../lib/format'
import { kpis, periodChange, salesIn } from '../lib/analytics'
import type { BusinessId } from '../types'
import { Badge, Button, Card, PageHeader, Segmented, cx } from '../components/ui'
import { SectionTitle, Simulated } from '../components/common'
import { CompareBars } from '../components/charts'
import { BusinessDot } from '../components/Layout'

interface Alert {
  biz: BusinessId
  text: string
  page: Page
  severity: 'red' | 'amber'
}

export default function PanelGeneral() {
  const state = useStore()
  const online = useOnline()
  const [period, setPeriod] = useState<'1' | '7' | '30'>('7')
  const [summary, setSummary] = useState('')
  const n = Number(period)
  const today = todayISO()

  const data = useMemo(
    () =>
      BUSINESS_IDS.map((b) => {
        const k = kpis(salesIn(state.sales, b, n), state.products)
        const change = n > 1 ? periodChange(state.sales, b, n).pct : null
        const prods = state.products.filter((p) => p.businessId === b)
        const ids = new Set(prods.map((p) => p.id))
        const low = prods.filter((p) => stockOf(state.lots, p.id) <= p.minStock).length
        const expiring = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= 3).length
        const receivable = state.clients.filter((c) => c.businessId === b).reduce((a, c) => a + Math.max(0, clientBalance(state.accounts, c.id)), 0)
        const payable = state.suppliers.filter((s) => s.businessId === b).reduce((a, s) => a + Math.max(0, supplierBalance(state.supEntries, s.id)), 0)
        const invoices = state.invoices.filter((i) => i.businessId === b && i.status !== 'emitido').length
        const openSessions = state.sessions.filter((s) => s.businessId === b && !s.closedAt).length
        const quotes = state.quotes.filter((q) => q.businessId === b && q.status === 'abierto' && q.validUntil >= today)
        const late = b === 'alquiler' ? state.reservations.filter((r) => r.status === 'entregada' && r.to < today).length : 0
        const pickups = b === 'alquiler' ? state.reservations.filter((r) => r.status === 'reservada' && r.from === today).length : 0
        return { b, k, change, low, expiring, receivable, payable, invoices, openSessions, quotes, late, pickups }
      }),
    [state, n, today],
  )

  const total = data.reduce((a, d) => a + d.k.total, 0)
  const totalChange = n > 1 ? periodChange(state.sales, null, n) : null
  const margin = data.reduce((a, d) => a + d.k.margin, 0)
  const receivable = data.reduce((a, d) => a + d.receivable, 0)
  const payable = data.reduce((a, d) => a + d.payable, 0)

  const alerts: Alert[] = []
  for (const d of data) {
    if (d.late) alerts.push({ biz: d.b, text: `${d.late} devolución(es) atrasada(s) con recargo`, page: 'mostrador', severity: 'red' })
    if (d.expiring) alerts.push({ biz: d.b, text: `${d.expiring} lotes vencidos o por vencer en 3 días`, page: 'alertas', severity: 'red' })
    if (d.low) alerts.push({ biz: d.b, text: `${d.low} productos en o bajo el mínimo`, page: businesses[d.b].kind === 'rental' ? 'productos' : 'compras', severity: 'amber' })
    if (d.invoices) alerts.push({ biz: d.b, text: `${d.invoices} comprobantes pendientes o rechazados`, page: 'comprobantes', severity: 'amber' })
    if (d.quotes.length) alerts.push({ biz: d.b, text: `${d.quotes.length} presupuestos abiertos por ${money(d.quotes.reduce((a, q) => a + q.total, 0))}`, page: 'presupuestos', severity: 'amber' })
  }
  const pending = state.queue.length + state.remoteSales.length

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Panel general"
        tag="A3"
        subtitle="Los cuatro negocios juntos: resultados, comparación y alertas. La operación de cada local sigue separada; desde acá se entra al detalle de cada uno."
        actions={
          <>
            <Segmented
              value={period}
              onChange={setPeriod}
              options={[
                { value: '1', label: 'Hoy' },
                { value: '7', label: '7 días' },
                { value: '30', label: '30 días' },
              ]}
            />
            <Button variant="secondary" onClick={() => setSummary(state.runAutomation('resumen-diario'))}>
              <MessageCircle size={16} /> Enviarme el resumen
            </Button>
          </>
        }
      />
      {summary && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
          {summary} Lo ves en Automatizaciones › Mensajes. <Simulated />
        </div>
      )}

      <div className="ink-surface relative overflow-hidden rounded-3xl p-6 animate-rise sm:p-7">
        <div className="grid-dots absolute inset-0 opacity-60" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="text-sm font-semibold text-ink-300">Ventas de los cuatro negocios · {n === 1 ? 'hoy' : `últimos ${n} días`}</div>
            <div className="tabular text-glow mt-1 text-[clamp(1.9rem,9.5vw,3.75rem)] font-bold leading-none tracking-tight text-white wrap-any">{money(total)}</div>
            {totalChange?.pct != null && (
              <div className="mt-3 inline-flex rounded-full bg-white/[0.08] px-3 py-1 text-xs font-semibold text-ink-200 ring-1 ring-white/10">
                {totalChange.pct >= 0 ? '+' : ''}
                {Math.round(totalChange.pct)}% en los últimos {n} días completos contra los {n} anteriores
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3 lg:min-w-[420px]">
            {[
              { k: 'Margen bruto', v: money(margin) },
              { k: 'A cobrar (clientes)', v: money(receivable) },
              { k: 'A pagar (proveedores)', v: money(payable) },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
                <div className="wrap-any text-xs font-semibold text-ink-300">{x.k}</div>
                <div className="tabular wrap-any mt-1 text-lg font-bold text-white">{x.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-5">
          <div className="mb-1 font-bold text-white">Comparación de ventas</div>
          <div className="mb-5 text-xs text-ink-300">{n === 1 ? 'Hoy' : `Últimos ${n} días`}, en pesos</div>
          <CompareBars rows={data.map((d) => ({ label: businesses[d.b].name, color: businesses[d.b].color, value: d.k.total, hint: `${d.k.count} tickets` }))} />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-white">
              <AlertTriangle size={17} className="text-amber-200" /> Alertas de todos los negocios
            </span>
            <Badge tone={alerts.length ? 'amber' : 'green'}>{alerts.length}</Badge>
          </div>
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto">
            {alerts.map((a, i) => (
              <button key={i} onClick={() => state.goTo(a.biz, a.page)} className="flex w-full items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-sm ring-1 ring-white/10 transition hover:bg-white/10">
                <BusinessDot id={a.biz} />
                <span className="w-28 shrink-0 wrap-any text-xs font-semibold text-ink-300">{businesses[a.biz].name}</span>
                <span className={cx('flex-1', a.severity === 'red' ? 'text-rose-200' : 'text-ink-100')}>{a.text}</span>
                <ArrowRight size={14} className="text-ink-400" />
              </button>
            ))}
            {!alerts.length && <p className="text-sm text-ink-300">Sin alertas.</p>}
          </div>
        </Card>
      </div>

      <SectionTitle>Cada negocio</SectionTitle>
      <div className="grid gap-3 md:grid-cols-2">
        {data.map((d) => {
          const biz = businesses[d.b]
          const change = d.change
          return (
            <Card key={d.b} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-lg font-bold text-white">
                    <BusinessDot id={d.b} className="h-2.5 w-2.5" />
                    {biz.name}
                  </div>
                  <div className="text-xs text-ink-300">
                    {biz.legalName} · PV {biz.pointOfSale} · {d.openSessions ? `${d.openSessions} caja(s) abierta(s)` : 'sin cajas abiertas'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular text-xl font-bold text-white">{money(d.k.total)}</div>
                  {change !== null && (
                    <div className={cx('text-xs font-semibold', change >= 0 ? 'text-emerald-300' : 'text-amber-200')}>
                      {change >= 0 ? '+' : ''}
                      {Math.round(change)}% vs. anterior
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { k: 'Tickets', v: String(d.k.count) },
                  { k: 'Promedio', v: money(d.k.avg) },
                  { k: 'Margen', v: `${Math.round(d.k.marginPct)}%` },
                  { k: 'A cobrar', v: money(d.receivable) },
                ].map((x) => (
                  <div key={x.k} className="rounded-xl bg-white/[0.04] px-1 py-2 ring-1 ring-white/10">
                    <div className="text-[11px] text-ink-300">{x.k}</div>
                    <div className="tabular wrap-any text-sm font-semibold text-white">{x.v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {biz.kind === 'rental' ? (
                  <>
                    <Badge tone="brand">{d.pickups} retiros hoy</Badge>
                    {d.late > 0 && <Badge tone="red">{d.late} atrasadas</Badge>}
                  </>
                ) : (
                  <>
                    {d.low > 0 && <Badge tone="amber">{d.low} bajo mínimo</Badge>}
                    {d.expiring > 0 && <Badge tone="red">{d.expiring} por vencer</Badge>}
                    {d.quotes.length > 0 && <Badge tone="blue">{d.quotes.length} presupuestos</Badge>}
                  </>
                )}
                {d.invoices > 0 && <Badge tone="amber">{d.invoices} comprobantes</Badge>}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => state.goTo(d.b, 'inicio')}>
                  Ver detalle <ArrowRight size={14} />
                </Button>
                <Button size="sm" variant="secondary" onClick={() => state.goTo(d.b, 'reportes')}>
                  Reportes
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <SectionTitle>Estado del sistema</SectionTitle>
      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-2 font-semibold text-white">
            <DatabaseBackup size={17} className="text-brand-200" /> Copias de seguridad
          </div>
          <p className="mt-2 text-sm text-ink-300">Última copia automática: {dateTime(state.lastBackupAt)}. Se guardan 30 días de copias.</p>
          <Simulated className="mt-2">Simulado</Simulated>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 font-semibold text-white">
            <ServerCog size={17} className="text-brand-200" /> Sincronización y ARCA
          </div>
          <p className="mt-2 text-sm text-ink-300">
            {online ? 'Conectado' : 'Sin conexión'} · {pending ? `${pending} operaciones por sincronizar` : 'todo sincronizado'} · ARCA {state.arcaDown ? 'sin respuesta (contingencia activa)' : 'operativo'}.
          </p>
        </Card>
        <Card className="p-5">
          <div className="font-semibold text-white">Entornos</div>
          <p className="mt-2 text-sm text-ink-300">Producción y pruebas separados. Cada negocio con sus datos aislados, su CUIT y su certificado de ARCA.</p>
          <div className="mt-2 flex gap-1.5">
            <Badge tone="green">Producción</Badge>
            <Badge>Pruebas</Badge>
          </div>
        </Card>
      </div>
    </div>
  )
}
