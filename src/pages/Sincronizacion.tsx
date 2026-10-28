import { useState } from 'react'
import { CheckCircle2, CloudOff, GitMerge, Info, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { stockOf, useOnline, useStore } from '../store'
import { dateTime, time } from '../lib/format'
import { Badge, Button, Card, Empty, Input, PageHeader, Rule, Select, cx } from '../components/ui'

export default function Sincronizacion() {
  const state = useStore()
  const online = useOnline()
  const products = state.products.filter((p) => p.businessId === state.businessId)
  const [pid, setPid] = useState(products[0]?.id ?? '')
  const [qty, setQty] = useState('3')
  const pending = state.queue.length + state.remoteSales.length

  const status = state.syncing ? 'sync' : online ? 'on' : 'off'
  const head = {
    on: { icon: Wifi, title: 'Con conexión', text: pending ? 'Enviando operaciones al servidor…' : 'Todo sincronizado con el servidor central.', cls: 'from-emerald-400/25 to-emerald-400/5 ring-1 ring-inset ring-emerald-300/30 backdrop-blur-xl' },
    off: { icon: WifiOff, title: 'Sin conexión', text: 'La caja sigue vendiendo. Las operaciones se guardan en el equipo y se envían al volver internet.', cls: 'from-rose-400/30 to-rose-400/5 ring-1 ring-inset ring-rose-300/35 backdrop-blur-xl' },
    sync: { icon: RefreshCw, title: 'Sincronizando…', text: 'Enviando operaciones y conciliando stock con las demás cajas.', cls: 'from-amber-400/25 to-amber-400/5 ring-1 ring-inset ring-amber-300/30 backdrop-blur-xl' },
  }[status]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Modo sin conexión y sincronización" tag="M4" subtitle="El módulo más importante: internet se corta unas cinco veces por semana." />

      <div className={cx('mb-4 flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r p-5 text-white shadow', head.cls)}>
        <head.icon size={36} className={state.syncing ? 'animate-spin' : ''} />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-semibold">{head.title}</div>
          <div className="text-sm text-white/90">{head.text}</div>
          <div className="mt-1 text-xs text-white/80">Última sincronización: {state.lastSyncAt ? dateTime(state.lastSyncAt) : 'todavía no en esta demo'}</div>
        </div>
        <div className="text-center">
          <div className="tabular text-4xl font-bold">{pending}</div>
          <div className="text-xs text-white/90">pendientes</div>
        </div>
        <Button variant="secondary" disabled={!online || state.syncing || !pending} onClick={() => state.syncNow()}>
          <RefreshCw size={16} /> Sincronizar ahora
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-2 font-semibold">
              <CloudOff size={17} /> Cola local de operaciones
            </span>
            <Badge tone={pending ? 'amber' : 'green'}>{pending ? `${pending} sin enviar` : 'vacía'}</Badge>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {pending === 0 ? (
              <Empty>
                No hay operaciones pendientes.
                <br />
                Cortá internet desde el panel <b>Demo</b> y hacé algunas ventas para verlas acá.
              </Empty>
            ) : (
              <>
                {state.queue.map((op) => (
                  <div key={op.id} className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-sm last:border-0">
                    <span>{op.label}</span>
                    <span className="text-xs text-ink-400">{time(op.at)}</span>
                  </div>
                ))}
                {state.remoteSales.map((r) => (
                  <div key={r.id} className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-4 py-2 text-sm last:border-0">
                    <span>
                      {r.register}: venta de {r.qty} × {state.products.find((p) => p.id === r.productId)?.name}
                    </span>
                    <span className="text-xs text-ink-400">{time(r.at)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <GitMerge size={17} /> Dos cajas vendiendo sin conexión
          </div>
          <p className="mb-3 text-sm text-ink-200">
            Simula que otra caja del local vendió el mismo producto mientras no había internet. Al sincronizar, el stock se calcula <b>sumando los movimientos</b> de ambas cajas, sin pisar
            cantidades.
          </p>
          <div className="grid grid-cols-[90px_1fr] gap-2">
            <Select aria-label="Producto vendido en la otra caja" className="col-span-2" value={pid} onChange={(e) => setPid(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (stock {stockOf(state.lots, p.id)})
                </option>
              ))}
            </Select>
            <Input aria-label="Cantidad vendida" type="number" inputMode="numeric" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button variant="secondary" disabled={!Number(qty)} onClick={() => state.simulateRemoteSale(pid, Number(qty))}>
              Venta en Caja 2
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-sky-400/12 p-3 text-xs text-sky-200">
            <div className="mb-1 flex items-center gap-1.5 font-semibold">
              <Info size={14} /> Cómo mostrarlo
            </div>
            1. En el panel Demo, cortá internet. 2. Vendé un producto desde “Vender”. 3. Acá, registrá una venta del mismo producto en la Caja 2. 4. Volvé a conectar: se sincroniza
            todo y el registro muestra la conciliación.
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="border-b border-white/10 px-4 py-3 font-semibold">Registro de sincronización</div>
        <div className="max-h-72 overflow-y-auto">
          {state.syncLog.length === 0 ? (
            <Empty>Sin eventos todavía.</Empty>
          ) : (
            state.syncLog.map((l) => (
              <div key={l.id} className="flex items-start gap-3 border-b border-white/10 px-4 py-2 text-sm last:border-0">
                <span className="mt-0.5 shrink-0">
                  {l.kind === 'ok' ? <CheckCircle2 size={16} className="text-emerald-300" /> : l.kind === 'conflicto' ? <GitMerge size={16} className="text-brand-200" /> : <Info size={16} className="text-ink-400" />}
                </span>
                <span className="flex-1">{l.text}</span>
                <span className="shrink-0 text-xs text-ink-400">{time(l.at)}</span>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        <Rule id="M4-R1">Sin conexión se puede vender, cobrar en efectivo y registrar movimientos de caja.</Rule>
        <Rule id="M4-R2">Sin conexión no se confirman pagos con tarjeta ni QR (add-on A2).</Rule>
        <Rule id="M4-R3">El stock se sincroniza sumando movimientos, no pisando cantidades.</Rule>
        <Rule id="M4-R4">Ninguna operación se pierde si se cierra la app o se apaga el equipo. Probá recargar la página sin conexión.</Rule>
        <Rule id="M4-R5">El usuario ve siempre cuántas operaciones faltan sincronizar (indicador arriba a la derecha).</Rule>
      </div>
    </div>
  )
}
