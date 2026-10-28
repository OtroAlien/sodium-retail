import { useMemo, useState } from 'react'
import { BarChart3, Download } from 'lucide-react'
import { useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { addDays, date, dateTime, money } from '../lib/format'
import { byCategory, byDay, byHour, byPayment, bySeller, kpis, periodChange, rentalOccupancy, rentalRevenue, salesIn, topProducts } from '../lib/analytics'
import { businesses } from '../data/seed'
import { Button, Card, Empty, PageHeader, Segmented, Stat } from '../components/ui'
import { DataTable } from '../components/DataTable'
import { HBars, SectionTitle, downloadCsv, payLabel } from '../components/common'
import { DayBars, HourStrip } from '../components/charts'
import type { PayMethod } from '../types'
import { linesText } from './Mostrador'

export default function Reportes() {
  const me = useMe()!
  const state = useStore()
  const biz = state.businessId
  const kind = businesses[biz].kind
  const [days, setDays] = useState<'7' | '30'>('30')
  const [rentalSeason, setRentalSeason] = useState(true)
  const n = Number(days)
  const sales = useMemo(() => salesIn(state.sales, biz, n), [state.sales, biz, n])
  const k = useMemo(() => kpis(sales, state.products), [sales, state.products])
  // variación sobre días completos, para no comparar el día en curso con días cerrados
  const delta = useMemo(() => periodChange(state.sales, biz, n).pct, [state.sales, biz, n])
  const top = useMemo(() => topProducts(sales, state.products, 10), [sales, state.products])
  const showCost = can(me, 'costos.ver')

  const exportSales = () =>
    downloadCsv(`ventas-${biz}-${n}dias.csv`, [
      ['Número', 'Fecha', 'Vendedor', 'Cliente', 'Medio de pago', 'Total'],
      ...sales.map((s) => [
        s.number,
        dateTime(s.at),
        state.users.find((u) => u.id === s.userId)?.name ?? '',
        state.clients.find((c) => c.id === s.clientId)?.name ?? '',
        s.payments.map((p) => payLabel[p.method]).join(' + '),
        s.total,
      ]),
    ])

  if (kind === 'rental') {
    // "temporada pasada": junio a septiembre, para ver el negocio en su pico
    const season = rentalSeason
    const rev = season ? rentalRevenue(state, 120, 31) : rentalRevenue(state, n)
    const occ = season ? rentalOccupancy(state, 120, 31) : rentalOccupancy(state, n)
    const avgOcc = occ.filter((o) => o.units).reduce((a, o) => a + o.pct, 0) / Math.max(1, occ.filter((o) => o.units).length)
    const list = state.reservations.filter((r) => r.status !== 'cancelada' && (season ? r.from >= addDays(-150) && r.from <= addDays(-31) : r.from >= addDays(-(n - 1))))
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Reportes del alquiler"
          subtitle="Ingresos, ocupación por tipo de equipo, canales de reserva, recargos y daños."
          actions={
            <>
              <Segmented
                label="Período"
                value={rentalSeason ? 'temporada' : days}
                onChange={(v) => {
                  setRentalSeason(v === 'temporada')
                  if (v !== 'temporada') setDays(v as '7' | '30')
                }}
                options={[
                  { value: 'temporada', label: 'Temporada pasada' },
                  { value: '30', label: '30 días' },
                  { value: '7', label: '7 días' },
                ]}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  downloadCsv(`reservas-${rentalSeason ? 'temporada' : `${n}dias`}.csv`, [
                    ['Reserva', 'Cliente', 'Desde', 'Hasta', 'Días', 'Equipo', 'Canal', 'Total', 'Recargos', 'Daños', 'Estado'],
                    ...list.map((r) => [r.number, state.clients.find((c) => c.id === r.clientId)?.name ?? '', r.from, r.to, r.days, linesText(r), r.channel, r.total, r.lateFee ?? 0, r.damageFee ?? 0, r.status]),
                  ])
                }
              >
                <Download size={16} /> Exportar CSV
              </Button>
            </>
          }
        />
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          <Stat label="Reservas" value={rev.count} />
          <Stat label="Ingresos por alquiler" value={money(rev.rentals)} />
          <Stat label="Recargos y daños" value={money(rev.late + rev.damage)} hint={`demoras ${money(rev.late)} · daños ${money(rev.damage)}`} />
          <Stat label="Ocupación promedio" value={`${Math.round(avgOcc)}%`} />
        </div>
        {season ? (
          <p className="mt-3 text-xs text-ink-300">Temporada de invierno: del {date(addDays(-150))} al {date(addDays(-31))}.</p>
        ) : (
          <Card className="mt-4 p-5">
            <div className="font-bold text-white">Cobros por día</div>
            <div className="text-xs text-ink-300">Señas, saldos, recargos y venta de accesorios</div>
            <DayBars data={byDay(sales, n)} />
          </Card>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <SectionTitle>Ocupación por tipo</SectionTitle>
            <Card className="p-5">
              <HBars rows={occ.filter((o) => o.units).sort((a, b) => b.pct - a.pct).map((o) => ({ label: o.type, value: o.pct, hint: `${o.units} u.` }))} format={(v) => `${Math.round(v)}%`} max={100} />
            </Card>
          </div>
          <div>
            <SectionTitle>Facturación estimada por tipo</SectionTitle>
            <Card className="p-5">
              <HBars rows={occ.filter((o) => o.revenue).sort((a, b) => b.revenue - a.revenue).map((o) => ({ label: o.type, value: o.revenue }))} />
            </Card>
          </div>
          <div>
            <SectionTitle>Reservas por canal</SectionTitle>
            <Card className="p-5">
              <HBars rows={rev.byChannel.map((c) => ({ label: c.label === 'whatsapp' ? 'WhatsApp' : c.label === 'web' ? 'Web' : 'Mostrador', value: c.value }))} format={(v) => `${v} reservas`} />
            </Card>
          </div>
          <div>
            <SectionTitle>Medios de pago</SectionTitle>
            <Card className="p-5">
              <HBars rows={byPayment(sales).map((p) => ({ label: payLabel[p.method as PayMethod], value: p.value }))} />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reportes"
        subtitle="Ventas, márgenes, rotación, horarios y medios de pago. Todo se puede exportar a planilla."
        actions={
          <>
            <Segmented label="Período" value={days} onChange={setDays} options={[{ value: '7', label: '7 días' }, { value: '30', label: '30 días' }]} />
            <Button variant="secondary" onClick={exportSales}>
              <Download size={16} /> Exportar ventas
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <Stat label="Ventas" value={money(k.total)} hint={delta === null ? '' : `${delta >= 0 ? '+' : ''}${Math.round(delta)}% vs. período anterior (días completos)`} tone={delta !== null && delta < 0 ? 'amber' : undefined} />
        <Stat label="Tickets" value={k.count} hint={`${Math.round(k.count / n)} por día`} />
        <Stat label="Ticket promedio" value={money(k.avg)} />
        {showCost ? <Stat label="Margen bruto" value={money(k.margin)} hint={`${Math.round(k.marginPct)}% sobre ventas`} /> : <Stat label="Margen bruto" value="—" hint="solo Administrador" />}
      </div>
      <Card className="mt-4 p-5">
        <div className="font-bold text-white">Ventas por día</div>
        <div className="text-xs text-ink-300">Últimos {n} días, en pesos</div>
        <DayBars data={byDay(sales, n)} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Por categoría</SectionTitle>
          <Card className="p-5">
            <HBars rows={byCategory(sales, state.products).slice(0, 8)} />
          </Card>
        </div>
        <div>
          <SectionTitle>Por medio de pago</SectionTitle>
          <Card className="p-5">
            <HBars rows={byPayment(sales).map((p) => ({ label: payLabel[p.method as PayMethod], value: p.value }))} />
          </Card>
        </div>
        <div>
          <SectionTitle>Por vendedor</SectionTitle>
          <Card className="p-5">
            <HBars rows={bySeller(sales, state.users).map((s) => ({ label: s.name, value: s.total, hint: `${s.count} ventas` }))} />
          </Card>
        </div>
        <div>
          <SectionTitle>Por hora del día</SectionTitle>
          <Card className="p-5">
            <HourStrip hours={byHour(sales)} />
          </Card>
        </div>
      </div>
      <SectionTitle
        right={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => downloadCsv(`productos-${biz}-${n}dias.csv`, [['Producto', 'Categoría', 'Unidades', 'Facturación'], ...top.map((t) => [t.name, t.category, t.qty, Math.round(t.total)])])}
          >
            <Download size={14} /> CSV
          </Button>
        }
      >
        Productos que más facturan
      </SectionTitle>
      <Card>
        {top.length === 0 ? (
          <Empty icon={<BarChart3 size={22} />}>No hay ventas en este período para armar el ranking.</Empty>
        ) : (
          <DataTable
            caption="Productos que más facturan"
            rows={top}
            rowKey={(t) => t.id}
            columns={[
              { key: 'n', header: 'Producto', mobile: 'title', className: 'wrap-any min-w-[14rem] text-white', cell: (t) => <>{t.name} <span className="text-xs font-normal text-ink-300">{t.category}</span></> },
              { key: 'fact', header: 'Facturación', align: 'right', mobile: 'value', cell: (t) => <span className="tabular whitespace-nowrap font-semibold">{money(t.total)}</span> },
              { key: 'u', header: 'Unidades', align: 'right', className: 'tabular text-ink-200', cell: (t) => Math.round(t.qty).toLocaleString('es-AR') },
              { key: 'p', header: 'Participación', align: 'right', className: 'tabular text-ink-200', cell: (t) => `${k.total ? Math.round((t.total / k.total) * 100) : 0}%` },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
