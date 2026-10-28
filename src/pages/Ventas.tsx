import { useMemo, useState } from 'react'
import { Ban, ReceiptText, WifiOff } from 'lucide-react'
import { useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { dateTime, money, todayISO, toISODate } from '../lib/format'
import { invoiceNumber } from '../lib/arca'
import type { Sale } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, Segmented, Select, cx, useGuard } from '../components/ui'
import Receipt, { InvoiceStatusBadge } from '../components/Receipt'
import { payLabel } from '../components/common'
import { DataTable, type Col } from '../components/DataTable'

export default function Ventas() {
  const me = useMe()!
  const state = useStore()
  const [range, setRange] = useState<'hoy' | 'semana'>('hoy')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)

  const sales = useMemo(() => {
    const from = range === 'hoy' ? todayISO() : toISODate(new Date(Date.now() - 6 * 86400000))
    return state.sales
      .filter((s) => s.businessId === state.businessId && toISODate(new Date(s.at)) >= from)
      .filter((s) => can(me, 'caja.verTodas') || s.userId === me.id)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [state.sales, state.businessId, range, me])

  const total = sales.filter((s) => s.status === 'completada').reduce((a, s) => a + s.total, 0)
  const user = (id: string) => state.users.find((u) => u.id === id)?.name ?? '—'
  const live = selected ? (state.sales.find((s) => s.id === selected.id) ?? selected) : null
  const shown = sales.slice(0, 200)

  const columns: Col<Sale>[] = [
    { key: 'n', header: 'N°', mobile: 'title', cell: (s) => <span className="tabular font-bold">#{s.number}</span> },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      mobile: 'value',
      cell: (s) => <span className={cx('tabular whitespace-nowrap font-semibold', s.status === 'anulada' && 'text-ink-400 line-through')}>{money(s.total)}</span>,
    },
    {
      key: 'fecha',
      header: 'Fecha',
      className: 'whitespace-nowrap',
      cell: (s) => (
        <span className="inline-flex items-center gap-1.5">
          {dateTime(s.at)}
          {s.createdOffline && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-300">
              <WifiOff size={12} aria-hidden /> sin conexión
            </span>
          )}
        </span>
      ),
    },
    { key: 'cajero', header: 'Cajero', cell: (s) => user(s.userId) },
    {
      key: 'pago',
      header: 'Pago',
      cell: (s) => (
        <>
          {s.payments.length > 1 ? 'Mixto' : payLabel[s.payments[0]?.method ?? 'efectivo']}
          {s.clientId && <div className="text-xs text-ink-300">{state.clients.find((c) => c.id === s.clientId)?.name}</div>}
        </>
      ),
    },
    {
      key: 'comp',
      header: 'Comprobante',
      cell: (s) => {
        const inv = state.invoices.find((i) => i.id === s.invoiceId)
        return inv ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <span>{inv.kind}</span>
            <InvoiceStatusBadge inv={inv} />
          </span>
        ) : (
          <span className="text-ink-300">{s.seeded ? 'Factura B' : 'Comprobante interno'}</span>
        )
      },
    },
    { key: 'estado', header: 'Estado', cell: (s) => (s.status === 'anulada' ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Completada</Badge>) },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Ventas"
        tag="M1"
        subtitle={can(me, 'caja.verTodas') ? 'Todas las ventas del negocio. Tocá una para ver el comprobante o anularla.' : 'Tus ventas. Tocá una para ver el comprobante.'}
        actions={
          <Segmented
            label="Período"
            value={range}
            onChange={setRange}
            options={[
              { value: 'hoy', label: 'Hoy' },
              { value: 'semana', label: 'Últimos 7 días' },
            ]}
          />
        }
      />
      <p className="mb-3 text-sm text-ink-200" aria-live="polite">
        {sales.length} ventas · <span className="tabular font-semibold text-white">{money(total)}</span> cobrado (sin anuladas)
        {sales.length > shown.length && ` · mostrando las últimas ${shown.length}`}
      </p>
      <Card>
        {sales.length === 0 ? (
          <Empty
            icon={<ReceiptText size={22} />}
            action={
              range === 'hoy' && (
                <Button variant="secondary" onClick={() => setRange('semana')}>
                  Ver los últimos 7 días
                </Button>
              )
            }
          >
            No hay ventas {range === 'hoy' ? 'registradas hoy' : 'en este período'}. Cuando cobres desde “Vender” aparecen acá.
          </Empty>
        ) : (
          <DataTable caption="Listado de ventas" columns={columns} rows={shown} rowKey={(s) => s.id} onRowClick={setSelected} rowLabel={(s) => `Venta ${s.number}, ${money(s.total)}. Abrir detalle`} />
        )}
      </Card>

      <Modal
        open={!!live && !voiding}
        onClose={() => setSelected(null)}
        title={live ? `Venta #${live.number}` : ''}
        footer={
          live?.status === 'completada' && !live.seeded ? (
            <Button variant="danger" onClick={() => setVoiding(true)}>
              <Ban size={16} aria-hidden /> Anular venta
            </Button>
          ) : undefined
        }
      >
        {live && (
          <>
            {live.status === 'anulada' && (
              <div className="mb-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">
                Anulada el {dateTime(live.voidedAt!)} por {user(live.voidedBy!)} · autorizó {user(live.voidAuthorizedBy!)}
                <br />
                Motivo: {live.voidReason}
                {live.creditNoteId &&
                  (() => {
                    const nc = state.invoices.find((i) => i.id === live.creditNoteId)
                    return nc ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {nc.kind} {invoiceNumber(nc.pointOfSale, nc.number)} <InvoiceStatusBadge inv={nc} />
                      </div>
                    ) : null
                  })()}
              </div>
            )}
            {live.seeded && <div className="mb-3 rounded-xl bg-white/[0.06] px-3 py-2 text-xs text-ink-200">Venta histórica de ejemplo: se puede consultar, pero no anular.</div>}
            <Receipt sale={live} />
          </>
        )}
      </Modal>

      {live && <VoidModal open={voiding} sale={live} onClose={() => setVoiding(false)} />}
    </div>
  )
}

function VoidModal({ open, sale, onClose }: { open: boolean; sale: Sale; onClose: () => void }) {
  const me = useMe()!
  const state = useStore()
  const guard = useGuard()
  const [reason, setReason] = useState('')
  const [preset, setPreset] = useState('')
  const [authId, setAuthId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const needsAuth = !can(me, 'venta.anular')
  const authorizers = state.users.filter((u) => !u.blocked && can(u, 'venta.anular') && (u.businessId === null || u.businessId === sale.businessId))
  const finalReason = preset === 'Otro' ? reason : preset
  const missing = !finalReason.trim() ? 'Elegí el motivo de la anulación.' : needsAuth && !authId ? 'Elegí quién autoriza.' : needsAuth && pin.length < 4 ? 'Ingresá el PIN de 4 dígitos de quien autoriza.' : ''

  const submit = () =>
    guard(() => {
      let authorizer = me.id
      if (needsAuth) {
        const a = state.users.find((u) => u.id === authId)
        if (!a || a.pin !== pin) {
          setError('El PIN no coincide con el de la persona elegida. Revisalo e intentá de nuevo.')
          return
        }
        authorizer = a.id
      }
      const err = state.voidSale(sale.id, finalReason, authorizer)
      if (err) setError(err)
      else {
        setReason('')
        setPreset('')
        setPin('')
        setError('')
        onClose()
      }
    })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Anular venta #${sale.number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Volver
          </Button>
          <Button variant="danger" disabled={!!missing} onClick={submit}>
            Confirmar anulación
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label="Motivo (obligatorio)" value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="">Elegir…</option>
          <option>Error de carga</option>
          <option>El cliente se arrepintió</option>
          <option>Devolución de producto</option>
          <option>Cobro duplicado</option>
          <option>Otro</option>
        </Select>
        {preset === 'Otro' && <Input label="Describí el motivo" value={reason} onChange={(e) => setReason(e.target.value)} />}
        {needsAuth && (
          <div className="rounded-xl border border-amber-300/25 bg-amber-400/12 p-3">
            <div className="mb-2 text-sm font-semibold text-amber-200">Requiere autorización de un Encargado</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select label="¿Quién autoriza?" value={authId} onChange={(e) => setAuthId(e.target.value)}>
                <option value="">Elegir…</option>
                {authorizers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Input label="PIN de quien autoriza" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">
            {error}
          </div>
        )}
        {missing && !error && <p className="text-xs text-ink-300">{missing}</p>}
        <div className="space-y-1.5">
          <Rule id="M1-R3">El stock vuelve a los mismos lotes y la venta queda registrada como anulada: nunca se borra.</Rule>
          {sale.invoiceId && <Rule id="M5-R1">La factura emitida no se modifica: se emite la nota de crédito correspondiente.</Rule>}
        </div>
      </div>
    </Modal>
  )
}
