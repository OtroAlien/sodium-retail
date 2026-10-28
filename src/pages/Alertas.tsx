import { useMemo } from 'react'
import { AlertOctagon, CalendarClock, CheckCircle2, PackageMinus, Truck } from 'lucide-react'
import { formatQty, stockOf, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, daysUntil } from '../lib/format'
import type { Product } from '../types'
import { Badge, Button, Card, Empty, Input, PageHeader, Rule } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'

export default function Alertas() {
  const me = useMe()!
  const state = useStore()
  const confirm = useConfirm()
  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const lots = state.lots.filter((l) => byId.has(l.productId) && l.qty > 0 && l.expiry)
  const expired = lots.filter((l) => daysUntil(l.expiry!) < 0)
  const soon = lots.filter((l) => daysUntil(l.expiry!) >= 0 && daysUntil(l.expiry!) <= state.expiryWarnDays).sort((a, b) => a.expiry!.localeCompare(b.expiry!))
  const low = products.map((p) => ({ p, stock: stockOf(state.lots, p.id) })).filter((x) => x.stock <= x.p.minStock).sort((a, b) => a.stock - b.stock)
  // la ferretería no trabaja con vencimientos: se muestra solo la reposición
  const hasExpiry = products.some((p) => p.tracksLots)

  const lowCols: Col<{ p: Product; stock: number }>[] = [
    { key: 'p', header: 'Producto', mobile: 'title', className: 'wrap-any min-w-[14rem] font-medium text-white', cell: ({ p }) => p.name },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      mobile: 'value',
      cell: ({ p, stock }) => (
        <span className={`tabular whitespace-nowrap font-semibold ${stock <= 0 ? 'text-rose-300' : 'text-amber-200'}`}>
          {stock <= 0 ? 'Agotado' : formatQty(stock, p.baseUnit)}
        </span>
      ),
    },
    { key: 'cat', header: 'Categoría', className: 'text-ink-200', cell: ({ p }) => p.category },
    { key: 'min', header: 'Mínimo', align: 'right', className: 'tabular text-ink-200', cell: ({ p }) => formatQty(p.minStock, p.baseUnit) },
  ]

  if (!hasExpiry)
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader
          title="Stock y reposición"
          tag="M2"
          subtitle="Productos y variantes en o bajo el stock mínimo, con el stock expresado en su unidad (unidades, metros, kilos)."
          actions={
            <Button onClick={() => state.setPage('compras')}>
              <Truck size={16} aria-hidden /> Armar pedidos a proveedores
            </Button>
          }
        />
        <Card>
          {low.length === 0 ? (
            <Empty icon={<CheckCircle2 size={22} />}>Todo el stock está por encima del mínimo.</Empty>
          ) : (
            <DataTable caption="Productos bajo el stock mínimo" columns={lowCols} rows={low} rowKey={({ p }) => p.id} />
          )}
        </Card>
        <div className="mt-4 max-w-2xl">
          <Rule id="A1">La reposición sugiere cantidad y proveedor más barato, y arma las órdenes de compra con un clic.</Rule>
        </div>
      </div>
    )

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Stock y vencimientos"
        tag="M2"
        subtitle="Alertas de stock mínimo y de vencimiento próximo."
        actions={<Input className="w-24" label="Avisar con (días)" type="number" inputMode="numeric" min={1} max={60} value={state.expiryWarnDays} onChange={(e) => state.setExpiryWarnDays(Number(e.target.value))} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-semibold text-rose-200">
            <AlertOctagon size={18} aria-hidden /> Vencidos <Badge tone="red">{expired.length}</Badge>
          </div>
          {expired.length === 0 ? (
            <Empty icon={<CheckCircle2 size={22} />}>Sin productos vencidos.</Empty>
          ) : (
            expired.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="wrap-any text-sm font-semibold">{byId.get(l.productId)!.name}</div>
                  <div className="text-xs text-ink-200">
                    Lote {l.code} · venció el {date(l.expiry!)} · {l.qty} unidades
                  </div>
                </div>
                {can(me, 'stock.ajustar') && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (await confirm({ title: 'Dar de baja el lote', message: `Se descuentan ${l.qty} unidades de ${byId.get(l.productId)!.name} (lote ${l.code}) por vencimiento. Queda registrado en la auditoría.`, confirmLabel: 'Dar de baja', danger: true })) state.writeOffLot(l.id)
                    }}
                  >
                    Dar de baja
                  </Button>
                )}
              </div>
            ))
          )}
          <div className="p-3">
            <Rule id="M2-R3">Un producto vencido no se puede vender y se da de baja con motivo.</Rule>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-semibold text-amber-200">
            <CalendarClock size={18} aria-hidden /> Por vencer <Badge tone="amber">{soon.length}</Badge>
          </div>
          {soon.length === 0 ? (
            <Empty icon={<CheckCircle2 size={22} />}>Nada vence en los próximos {state.expiryWarnDays} días.</Empty>
          ) : (
            soon.map((l) => {
              const d = daysUntil(l.expiry!)
              return (
                <div key={l.id} className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <div className="wrap-any text-sm font-semibold">{byId.get(l.productId)!.name}</div>
                    <div className="text-xs text-ink-200">
                      Lote {l.code} · {date(l.expiry!)} · {l.qty} unidades
                    </div>
                  </div>
                  <Badge tone={d <= 2 ? 'red' : 'amber'}>{d === 0 ? 'Vence hoy' : d === 1 ? 'Vence mañana' : `En ${d} días`}</Badge>
                </div>
              )
            })
          )}
          <div className="p-3">
            <Rule id="M2-R1">La venta descuenta primero del lote que vence antes.</Rule>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 font-semibold text-white">
            <PackageMinus size={18} aria-hidden /> Bajo el mínimo <Badge>{low.length}</Badge>
          </div>
          {low.length === 0 ? (
            <Empty icon={<CheckCircle2 size={22} />}>Todo el stock está por encima del mínimo.</Empty>
          ) : (
            low.map(({ p, stock }) => (
              <div key={p.id} className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3 last:border-0">
                <div className="min-w-0">
                  <div className="wrap-any text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-ink-200">Mínimo {p.minStock}</div>
                </div>
                <span className={`tabular shrink-0 text-sm font-semibold ${stock <= 0 ? 'text-rose-300' : 'text-amber-200'}`}>{stock <= 0 ? 'Agotado' : `${stock} u.`}</span>
              </div>
            ))
          )}
          {low.length > 0 && (
            <div className="p-3">
              <Button variant="secondary" className="w-full" onClick={() => state.setPage('compras')}>
                <Truck size={16} aria-hidden /> Armar pedidos a proveedores
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
