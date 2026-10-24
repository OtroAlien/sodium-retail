import { useMemo, useState } from 'react'
import { Ban, WifiOff } from 'lucide-react'
import { useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { dateTime, money, todayISO, toISODate } from '../lib/format'
import { invoiceNumber } from '../lib/arca'
import type { Sale } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, Select, cx } from '../components/ui'
import Receipt, { InvoiceStatusBadge } from '../components/Receipt'

export default function Ventas() {
  const me = useMe()!
  const state = useStore()
  const [range, setRange] = useState<'hoy' | 'semana'>('hoy')
  const [selected, setSelected] = useState<Sale | null>(null)
  const [voiding, setVoiding] = useState(false)

  const sales = useMemo(() => {
    const from = range === 'hoy' ? todayISO() : toISODate(new Date(Date.now() - 7 * 86400000))
    return state.sales
      .filter((s) => s.businessId === state.businessId && toISODate(new Date(s.at)) >= from)
      .filter((s) => can(me.role, 'caja.verTodas') || s.userId === me.id)
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [state.sales, state.businessId, range, me])

  const total = sales.filter((s) => s.status === 'completada').reduce((a, s) => a + s.total, 0)
  const user = (id: string) => state.users.find((u) => u.id === id)?.name ?? '—'
  const live = selected ? state.sales.find((s) => s.id === selected.id) ?? selected : null

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Ventas"
        tag="M1"
        subtitle={can(me.role, 'caja.verTodas') ? 'Todas las ventas del negocio.' : 'Tus ventas.'}
        actions={
          <div className="flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
            {(['hoy', 'semana'] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} className={cx('rounded-md px-3 py-1 text-sm', range === r ? 'bg-brand-700 text-white' : 'text-slate-600')}>
                {r === 'hoy' ? 'Hoy' : 'Últimos 7 días'}
              </button>
            ))}
          </div>
        }
      />
      <div className="mb-3 text-sm text-slate-600">
        {sales.length} ventas · <span className="tabular font-semibold text-slate-900">{money(total)}</span> cobrado (sin anuladas)
      </div>
      <Card className="overflow-x-auto">
        {sales.length === 0 ? (
          <Empty>No hay ventas en este período. Probá registrar una desde “Vender”.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">N°</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Cajero</th>
                <th className="px-4 py-2 font-medium">Pago</th>
                <th className="px-4 py-2 font-medium">Comprobante</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 200).map((s) => {
                const inv = state.invoices.find((i) => i.id === s.invoiceId)
                return (
                  <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                    <td className="tabular px-4 py-2.5 font-medium">#{s.number}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {dateTime(s.at)}
                        {s.createdOffline && <WifiOff size={12} className="text-slate-400" aria-label="Registrada sin conexión" />}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{user(s.userId)}</td>
                    <td className="px-4 py-2.5 text-slate-600">{s.payments.length > 1 ? 'Mixto' : s.payments[0]?.method === 'efectivo' ? 'Efectivo' : 'Transferencia'}</td>
                    <td className="px-4 py-2.5">
                      {inv ? (
                        <span className="flex items-center gap-1.5">
                          <span className="text-slate-600">{inv.kind.replace('Factura ', 'Fact. ')}</span>
                          <InvoiceStatusBadge inv={inv} />
                        </span>
                      ) : s.seeded ? (
                        <span className="text-slate-400">Fact. B</span>
                      ) : (
                        <span className="text-slate-400">Interno</span>
                      )}
                    </td>
                    <td className={cx('tabular px-4 py-2.5 text-right font-medium', s.status === 'anulada' && 'text-slate-400 line-through')}>{money(s.total)}</td>
                    <td className="px-4 py-2.5">{s.status === 'anulada' ? <Badge tone="red">Anulada</Badge> : <Badge tone="green">Completada</Badge>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!live && !voiding}
        onClose={() => setSelected(null)}
        title={live ? `Venta #${live.number}` : ''}
        footer={
          live?.status === 'completada' && !live.seeded ? (
            <Button variant="danger" onClick={() => setVoiding(true)}>
              <Ban size={16} /> Anular venta
            </Button>
          ) : undefined
        }
      >
        {live && (
          <>
            {live.status === 'anulada' && (
              <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                Anulada el {dateTime(live.voidedAt!)} por {user(live.voidedBy!)} · autorizó {user(live.voidAuthorizedBy!)}
                <br />
                Motivo: {live.voidReason}
                {live.creditNoteId && (() => {
                  const nc = state.invoices.find((i) => i.id === live.creditNoteId)
                  return nc ? (
                    <div className="mt-1">
                      {nc.kind} {invoiceNumber(nc.pointOfSale, nc.number)} · <InvoiceStatusBadge inv={nc} />
                    </div>
                  ) : null
                })()}
              </div>
            )}
            {live.seeded && <div className="mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">Venta histórica de ejemplo (sin comprobante detallado).</div>}
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
  const [reason, setReason] = useState('')
  const [preset, setPreset] = useState('')
  const [authId, setAuthId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const needsAuth = !can(me.role, 'venta.anular')
  const authorizers = state.users.filter((u) => !u.blocked && can(u.role, 'venta.anular') && (u.businessId === null || u.businessId === sale.businessId))
  const finalReason = preset === 'Otro' ? reason : preset

  const submit = () => {
    let authorizer = me.id
    if (needsAuth) {
      const a = state.users.find((u) => u.id === authId)
      if (!a || a.pin !== pin) {
        setError('PIN de autorización incorrecto')
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
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Anular venta #${sale.number}`}
      footer={
        <Button variant="danger" disabled={!finalReason.trim() || (needsAuth && (!authId || pin.length < 4))} onClick={submit}>
          Confirmar anulación
        </Button>
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
        {preset === 'Otro' && <Input placeholder="Describí el motivo" value={reason} onChange={(e) => setReason(e.target.value)} />}
        {needsAuth && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="mb-2 text-sm font-medium text-amber-900">Requiere autorización de un Encargado</div>
            <div className="grid grid-cols-2 gap-2">
              <Select value={authId} onChange={(e) => setAuthId(e.target.value)}>
                <option value="">¿Quién autoriza?</option>
                {authorizers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
              <Input type="password" inputMode="numeric" maxLength={4} placeholder="PIN" value={pin} onChange={(e) => setPin(e.target.value)} />
            </div>
          </div>
        )}
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <div className="space-y-1.5">
          <Rule id="M1-R3">El stock vuelve a los mismos lotes y la venta queda registrada como anulada: nunca se borra.</Rule>
          {sale.invoiceId && <Rule id="M5-R1">La factura emitida no se modifica: se emite la nota de crédito correspondiente.</Rule>}
        </div>
      </div>
    </Modal>
  )
}
