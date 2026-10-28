import { useMemo, useState } from 'react'
import { PackageCheck, Plus, Send, Trash2, Truck, Wand2 } from 'lucide-react'
import { formatQty, stockOf, useMe, useStore } from '../store'
import { supplierBalance } from '../store/selectors'
import { can } from '../lib/permissions'
import { date, dateTime, formatCuit, money } from '../lib/format'
import type { PurchaseLine, PurchaseOrder, Supplier } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, Segmented, Select } from '../components/ui'
import { Simulated } from '../components/common'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'

const statusLabel = { borrador: 'Borrador', enviada: 'Enviada', recibida: 'Recibida', cancelada: 'Cancelada' } as const
const statusTone = { borrador: 'amber', enviada: 'blue', recibida: 'green', cancelada: 'slate' } as const

export default function Compras() {
  const me = useMe()!
  const state = useStore()
  const confirm = useConfirm()
  const biz = state.businessId
  const [tab, setTab] = useState<'reposicion' | 'ordenes' | 'proveedores'>('reposicion')
  const [newOrder, setNewOrder] = useState<{ supplierId?: string; lines?: PurchaseLine[] } | null>(null)
  const [receive, setReceive] = useState<PurchaseOrder | null>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [msg, setMsg] = useState('')

  const suppliers = state.suppliers.filter((s) => s.businessId === biz)
  const orders = state.orders.filter((o) => o.businessId === biz).sort((a, b) => b.at.localeCompare(a.at))
  const pName = (id: string) => state.products.find((p) => p.id === id)?.name ?? id
  const sName = (id: string) => state.suppliers.find((s) => s.id === id)?.name ?? id
  const canBuy = can(me, 'compras.gestionar')

  const reorder = useMemo(() => {
    const busy = new Set(state.orders.filter((o) => o.businessId === biz && (o.status === 'borrador' || o.status === 'enviada')).flatMap((o) => o.lines.map((l) => l.productId)))
    return state.products
      .filter((p) => p.businessId === biz)
      .map((p) => {
        const stock = stockOf(state.lots, p.id)
        const offers = state.supplierPrices.filter((sp) => sp.productId === p.id).sort((a, b) => a.cost - b.cost)
        return { p, stock, offer: offers[0], alt: offers[1], qty: Math.max(1, Math.ceil(p.minStock * 3 - stock)), busy: busy.has(p.id) }
      })
      .filter((x) => x.stock <= x.p.minStock)
  }, [state.products, state.lots, state.supplierPrices, state.orders, biz])


  type Reorder = (typeof reorder)[number]
  const reorderCols: Col<Reorder>[] = [
    { key: 'p', header: 'Producto', mobile: 'title', className: 'wrap-any min-w-[12rem] font-medium text-white', cell: (x) => x.p.name },
    { key: 'estado', header: 'Estado', mobile: 'value', cell: (x) => (x.busy ? <Badge tone="blue">Pedido en curso</Badge> : <Badge tone="amber">Sin pedir</Badge>) },
    {
      key: 'stock',
      header: 'Stock / mínimo',
      align: 'right',
      className: 'tabular whitespace-nowrap',
      cell: (x) => (
        <>
          <span className={x.stock <= 0 ? 'font-semibold text-rose-300' : 'font-semibold text-amber-200'}>{formatQty(x.stock, x.p.baseUnit)}</span>
          <span className="text-ink-300"> / {x.p.minStock}</span>
        </>
      ),
    },
    {
      key: 'prov',
      header: 'Proveedor sugerido',
      className: 'text-ink-100',
      cell: (x) => (
        <>
          {x.offer ? sName(x.offer.supplierId) : 'Sin proveedor cargado'}
          {x.offer && can(me, 'costos.ver') && <span className="text-ink-300"> · {money(x.offer.cost)}</span>}
          {x.alt && can(me, 'costos.ver') && (
            <div className="text-xs text-ink-300">
              Alternativa: {sName(x.alt.supplierId)} {money(x.alt.cost)}
            </div>
          )}
        </>
      ),
    },
    { key: 'pedir', header: 'Cantidad a pedir', align: 'right', className: 'tabular text-white', cell: (x) => formatQty(x.qty, x.p.baseUnit) },
  ]
  const orderCols: Col<PurchaseOrder>[] = [
    {
      key: 'oc',
      header: 'Orden',
      mobile: 'title',
      className: 'tabular whitespace-nowrap font-semibold text-white',
      cell: (o) => (
        <>
          #{o.number} <span className="wrap-any font-medium">{sName(o.supplierId)}</span>
          {o.auto && <div className="text-xs font-normal text-brand-200">Sugerida por el sistema</div>}
        </>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      mobile: 'value',
      cell: (o) => <span className="tabular whitespace-nowrap font-semibold text-white">{can(me, 'costos.ver') ? money(o.total) : 'Reservado'}</span>,
    },
    { key: 'fecha', header: 'Fecha', className: 'whitespace-nowrap text-ink-200', cell: (o) => dateTime(o.at) },
    {
      key: 'prod',
      header: 'Productos',
      className: 'wrap-any min-w-[16rem] text-ink-100',
      cell: (o) => `${o.lines.map((l) => `${l.qty} × ${pName(l.productId)}`).join(' · ')}`,
    },
    {
      key: 'estado',
      header: 'Estado',
      cell: (o) => (
        <>
          <Badge tone={statusTone[o.status]}>{statusLabel[o.status]}</Badge>
          {o.invoiceRef && <div className="mt-0.5 text-xs text-ink-300">{o.invoiceRef}</div>}
        </>
      ),
    },
    {
      key: 'acc',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      cell: (o) =>
        canBuy && (o.status === 'borrador' || o.status === 'enviada') ? (
          <div className="flex flex-wrap justify-end gap-2">
            {o.status === 'borrador' && (
              <Button size="sm" variant="secondary" onClick={() => state.sendOrder(o.id)}>
                <Send size={13} aria-hidden /> Enviar
              </Button>
            )}
            <Button size="sm" onClick={() => setReceive(o)}>
              <PackageCheck size={13} aria-hidden /> Recibir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                if (await confirm({ title: 'Cancelar la orden', message: `Se cancela la orden #${o.number} a ${sName(o.supplierId)}. No se puede deshacer.`, confirmLabel: 'Cancelar orden', cancelLabel: 'Volver', danger: true })) state.cancelOrder(o.id)
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Proveedores y compras"
        tag="A1"
        subtitle="Compras con o sin proveedor, actualización de stock y costo al recibir, cuenta corriente por proveedor y reposición sugerida."
        actions={
          canBuy && (
            <Button onClick={() => setNewOrder({})}>
              <Plus size={16} /> Nueva compra
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'reposicion', label: `Reposición (${reorder.length})` },
            { value: 'ordenes', label: `Órdenes (${orders.filter((o) => o.status === 'borrador' || o.status === 'enviada').length} abiertas)` },
            { value: 'proveedores', label: `Proveedores (${suppliers.length})` },
          ]}
        />
      </div>
      {msg && <div className="mb-3 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">{msg}</div>}

      {tab === 'reposicion' && (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-300">Productos en o bajo el stock mínimo. Se sugiere llevarlos a 3 veces el mínimo con el proveedor más barato.</p>
            {canBuy && (
              <Button
                disabled={!reorder.some((x) => !x.busy && x.offer)}
                onClick={() => {
                  const n = state.generateReorders()
                  setMsg(n ? `Se armaron ${n} órdenes en borrador, una por proveedor. Revisalas en Órdenes y enviálas.` : 'No hay productos nuevos para pedir.')
                  if (n) setTab('ordenes')
                }}
              >
                <Wand2 size={16} /> Armar pedidos sugeridos
              </Button>
            )}
          </div>
          <Card>
            {reorder.length === 0 ? (
              <Empty icon={<PackageCheck size={22} />}>Todo el stock está por encima del mínimo: no hace falta pedir nada por ahora.</Empty>
            ) : (
              <DataTable caption="Productos a reponer" columns={reorderCols} rows={reorder} rowKey={(x) => x.p.id} />
            )}
          </Card>
        </>
      )}

      {tab === 'ordenes' && (
        <Card>
          {orders.length === 0 ? (
            <Empty icon={<Truck size={22} />} action={canBuy && <Button onClick={() => setNewOrder({})}>Crear una compra</Button>}>
              Todavía no hay órdenes de compra.
            </Empty>
          ) : (
            <DataTable caption="Órdenes de compra" columns={orderCols} rows={orders} rowKey={(o) => o.id} />
          )}
        </Card>
      )}

      {tab === 'proveedores' && (
        <div className="grid gap-3 md:grid-cols-2">
          {suppliers.map((s) => {
            const bal = supplierBalance(state.supEntries, s.id)
            const n = state.supplierPrices.filter((sp) => sp.supplierId === s.id).length
            return (
              <button key={s.id} onClick={() => setSupplier(s)} className="glass rounded-2xl p-4 text-left transition hover:bg-white/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white">{s.name}</div>
                    <div className="text-xs text-ink-300">
                      CUIT {formatCuit(s.cuit)} · {s.paymentTerms} · entrega en {s.leadDays} días
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-300">Saldo</div>
                    <div className={`tabular font-bold ${bal > 0 ? 'text-amber-200' : 'text-emerald-300'}`}>{can(me, 'costos.ver') ? money(bal) : '—'}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.categories.map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                  <Badge tone="brand">{n} productos</Badge>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="mt-5 grid gap-1.5 sm:grid-cols-2">
        <Rule id="A1">Una compra de varios productos actualiza el stock y el costo de cada uno.</Rule>
        <Rule id="A1">El saldo de un proveedor coincide con compras menos pagos registrados.</Rule>
      </div>

      {newOrder && <NewOrderModal init={newOrder} onClose={() => setNewOrder(null)} onDone={(t) => setMsg(t)} />}
      {receive && <ReceiveModal order={receive} onClose={() => setReceive(null)} onDone={(t) => setMsg(t)} />}
      {supplier && <SupplierModal s={supplier} onClose={() => setSupplier(null)} />}
    </div>
  )
}

function NewOrderModal({ init, onClose, onDone }: { init: { supplierId?: string; lines?: PurchaseLine[] }; onClose: () => void; onDone: (t: string) => void }) {
  const state = useStore()
  const suppliers = state.suppliers.filter((s) => s.businessId === state.businessId)
  const [supplierId, setSupplierId] = useState(init.supplierId ?? suppliers[0]?.id ?? '')
  const [lines, setLines] = useState<PurchaseLine[]>(init.lines ?? [])
  const [productId, setProductId] = useState('')
  const offered = state.supplierPrices.filter((sp) => sp.supplierId === supplierId)
  const products = state.products.filter((p) => p.businessId === state.businessId)
  const total = lines.reduce((a, l) => a + l.qty * l.cost, 0)

  const addLine = () => {
    const p = products.find((x) => x.id === productId)
    if (!p || lines.some((l) => l.productId === p.id)) return
    const cost = offered.find((o) => o.productId === p.id)?.cost ?? p.cost
    setLines([...lines, { productId: p.id, qty: Math.max(1, p.minStock * 2), cost }])
    setProductId('')
  }

  return (
    <Modal open onClose={onClose} title="Nueva compra" width="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Proveedor" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex items-end gap-2">
          <Select label="Agregar producto" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Elegir…</option>
            {[...offered.map((o) => products.find((p) => p.id === o.productId)!).filter(Boolean), ...products.filter((p) => !offered.some((o) => o.productId === p.id))].map((p) => (
              <option key={p.id} value={p.id}>
                {offered.some((o) => o.productId === p.id) ? '★ ' : ''}
                {p.name}
              </option>
            ))}
          </Select>
          <Button className="h-[42px]" disabled={!productId} onClick={addLine}>
            <Plus size={15} />
          </Button>
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-400">★ productos que ya compraste a este proveedor (se completa el último costo).</p>
      <div className="mt-4 space-y-2">
        {lines.map((l, i) => (
          <div key={l.productId} className="grid grid-cols-2 items-end gap-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10 sm:grid-cols-[1fr_6rem_8rem_auto]">
            <span className="wrap-any col-span-2 text-sm font-medium text-white sm:col-span-1 sm:pb-3">{state.products.find((p) => p.id === l.productId)?.name}</span>
            <Input label="Cantidad" inputMode="numeric" type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)))} />
            <Input label="Costo unitario ($)" inputMode="decimal" type="number" min={0} value={l.cost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) || 0 } : x)))} />
            <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-ink-200 hover:text-rose-300 sm:col-span-1 sm:w-11" aria-label={`Quitar ${state.products.find((p) => p.id === l.productId)?.name ?? ""}`}>
              <Trash2 size={16} aria-hidden /> <span className="sm:hidden">Quitar</span>
            </button>
          </div>
        ))}
        {!lines.length && <p className="rounded-xl bg-white/[0.04] px-3 py-4 text-center text-sm text-ink-300 ring-1 ring-white/10">Agregá productos con cantidad y costo unitario.</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-ink-300">
          Total <b className="tabular text-white">{money(total)}</b>
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={!lines.length}
            onClick={() => {
              const o = state.createOrder(supplierId, lines, 'borrador')
              onDone(`Orden #${o.number} guardada en borrador.`)
              onClose()
            }}
          >
            Guardar borrador
          </Button>
          <Button
            disabled={!lines.length}
            onClick={() => {
              const o = state.createOrder(supplierId, lines, 'enviada')
              onDone(`Orden #${o.number} enviada al proveedor por email (simulado).`)
              onClose()
            }}
          >
            <Send size={15} /> Enviar al proveedor
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function ReceiveModal({ order, onClose, onDone }: { order: PurchaseOrder; onClose: () => void; onDone: (t: string) => void }) {
  const state = useStore()
  const [lines, setLines] = useState<PurchaseLine[]>(order.lines.map((l) => ({ ...l })))
  const [invoice, setInvoice] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal open onClose={onClose} title={`Recibir orden #${order.number}`} width="max-w-2xl">
      <p className="mb-3 text-sm text-ink-300">Controlá lo que llegó. Podés corregir cantidades y costos de la factura; los productos con vencimiento entran como lote nuevo.</p>
      <div className="space-y-2">
        {lines.map((l, i) => {
          const p = state.products.find((x) => x.id === l.productId)!
          return (
            <div key={l.productId} className="grid grid-cols-2 items-end gap-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10 sm:grid-cols-[1fr_6rem_8rem_10rem]">
              <span className="wrap-any col-span-2 text-sm font-medium text-white sm:col-span-1 sm:pb-3">{p.name}</span>
              <Input label="Recibido" inputMode="numeric" type="number" min={0} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)))} />
              <Input label="Costo unitario ($)" inputMode="decimal" type="number" min={0} value={l.cost} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) || 0 } : x)))} />
              {p.tracksLots ? (
                <Input label="Vencimiento" type="date" value={l.expiry ?? ''} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, expiry: e.target.value } : x)))} />
              ) : (
                <span className="col-span-2 text-xs text-ink-300 sm:col-span-1 sm:pb-3">Sin vencimiento</span>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-4 max-w-sm">
        <Input label="Factura del proveedor" placeholder="Ej.: FC A 0003-00012345" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
      </div>
      {error && <div className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-ink-300">
          Total recibido <b className="tabular text-white">{money(lines.reduce((a, l) => a + l.qty * l.cost, 0))}</b>
        </span>
        <Button
          variant="success"
          onClick={() => {
            const e = state.receiveOrder(order.id, invoice, lines)
            if (e) setError(e)
            else {
              onDone(`Orden #${order.number} recibida: stock y costos actualizados, y cargada a la cuenta del proveedor.`)
              onClose()
            }
          }}
        >
          <PackageCheck size={16} /> Confirmar recepción
        </Button>
      </div>
    </Modal>
  )
}

function SupplierModal({ s, onClose }: { s: Supplier; onClose: () => void }) {
  const me = useMe()!
  const state = useStore()
  const entries = state.supEntries.filter((e) => e.supplierId === s.id).sort((a, b) => b.at.localeCompare(a.at))
  const prices = state.supplierPrices.filter((sp) => sp.supplierId === s.id)
  const bal = supplierBalance(state.supEntries, s.id)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Transferencia')
  const [error, setError] = useState('')
  const showCost = can(me, 'costos.ver')
  return (
    <Modal open onClose={onClose} title={s.name} width="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="text-xs text-ink-300">Saldo a pagar</div>
          <div className="tabular text-xl font-bold text-white">{showCost ? money(bal) : '—'}</div>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10 sm:col-span-2">
          <div className="text-ink-200">
            {s.phone} · {s.email}
          </div>
          <div className="text-ink-300">
            {s.paymentTerms} · entrega en {s.leadDays} días
          </div>
        </div>
      </div>
      {can(me, 'proveedores.pagar') && (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Input label="Registrar pago" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Monto" />
          <Select label="Medio" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option>Transferencia</option>
            <option>Cheque</option>
            <option>Efectivo de caja</option>
          </Select>
          <Button
            className="h-[42px]"
            disabled={!Number(amount)}
            onClick={() => {
              const e = state.paySupplier(s.id, Number(amount), method)
              setError(e ?? '')
              if (!e) setAmount('')
            }}
          >
            Registrar
          </Button>
        </div>
      )}
      {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Cuenta corriente</h3>
          {entries.length === 0 ? (
            <p className="text-xs text-ink-300">Sin movimientos.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex justify-between border-b border-white/10 py-1.5 text-xs">
                <span className="text-ink-300">
                  {date(e.at)} · {e.ref}
                </span>
                <span className={`tabular font-semibold ${e.type === 'compra' ? 'text-amber-200' : 'text-emerald-300'}`}>
                  {e.type === 'compra' ? '+' : '−'}
                  {showCost ? money(e.amount) : '—'}
                </span>
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Productos y último costo</h3>
          {prices.slice(0, 14).map((p) => (
            <div key={p.productId} className="flex justify-between border-b border-white/10 py-1.5 text-xs">
              <span className="wrap-any text-ink-200">{state.products.find((x) => x.id === p.productId)?.name}</span>
              <span className="tabular text-ink-300">{showCost ? money(p.cost) : '—'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
        Los pedidos se envían por email al proveedor. <Simulated />
      </div>
    </Modal>
  )
}
