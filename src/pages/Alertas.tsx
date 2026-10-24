import { useMemo } from 'react'
import { AlertOctagon, CalendarClock, PackageMinus } from 'lucide-react'
import { stockOf, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, daysUntil } from '../lib/format'
import { Badge, Button, Card, Empty, PageHeader, Rule } from '../components/ui'

export default function Alertas() {
  const me = useMe()!
  const state = useStore()
  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const lots = state.lots.filter((l) => byId.has(l.productId) && l.qty > 0 && l.expiry)
  const expired = lots.filter((l) => daysUntil(l.expiry!) < 0)
  const soon = lots.filter((l) => daysUntil(l.expiry!) >= 0 && daysUntil(l.expiry!) <= state.expiryWarnDays).sort((a, b) => a.expiry!.localeCompare(b.expiry!))
  const low = products.map((p) => ({ p, stock: stockOf(state.lots, p.id) })).filter((x) => x.stock <= x.p.minStock).sort((a, b) => a.stock - b.stock)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Stock y vencimientos"
        tag="M2"
        subtitle="Alertas de stock mínimo y de vencimiento próximo."
        actions={
          <label className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-200">
            Avisar con
            <input
              type="number"
              min={1}
              max={60}
              value={state.expiryWarnDays}
              onChange={(e) => state.setExpiryWarnDays(Number(e.target.value))}
              className="tabular w-12 rounded border border-slate-300 px-1 py-0.5 text-right"
            />
            días de anticipación
          </label>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-rose-700">
            <AlertOctagon size={18} /> Vencidos <Badge tone="red">{expired.length}</Badge>
          </div>
          {expired.length === 0 ? (
            <Empty>Sin productos vencidos.</Empty>
          ) : (
            expired.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{byId.get(l.productId)!.name}</div>
                  <div className="text-xs text-slate-500">
                    Lote {l.code} · venció {date(l.expiry!)} · {l.qty} u.
                  </div>
                </div>
                {can(me.role, 'stock.ajustar') && (
                  <Button size="sm" variant="danger" onClick={() => state.writeOffLot(l.id)}>
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
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-amber-700">
            <CalendarClock size={18} /> Por vencer <Badge tone="amber">{soon.length}</Badge>
          </div>
          {soon.length === 0 ? (
            <Empty>Nada vence en los próximos {state.expiryWarnDays} días.</Empty>
          ) : (
            soon.map((l) => {
              const d = daysUntil(l.expiry!)
              return (
                <div key={l.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{byId.get(l.productId)!.name}</div>
                    <div className="text-xs text-slate-500">
                      Lote {l.code} · {date(l.expiry!)} · {l.qty} u.
                    </div>
                  </div>
                  <Badge tone={d <= 2 ? 'red' : 'amber'}>{d === 0 ? 'hoy' : `${d} d`}</Badge>
                </div>
              )
            })
          )}
          <div className="p-3">
            <Rule id="M2-R1">La venta descuenta primero del lote que vence antes.</Rule>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 font-semibold text-slate-800">
            <PackageMinus size={18} /> Stock bajo el mínimo <Badge>{low.length}</Badge>
          </div>
          {low.length === 0 ? (
            <Empty>Todo el stock está por encima del mínimo.</Empty>
          ) : (
            low.map(({ p, stock }) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 last:border-0">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">Mínimo {p.minStock}</div>
                </div>
                <span className={`tabular text-sm font-semibold ${stock <= 0 ? 'text-rose-600' : 'text-amber-600'}`}>{stock} u.</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  )
}
