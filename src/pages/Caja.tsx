import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Lock, LockOpen, Wallet } from 'lucide-react'
import { currentSession, sessionTotals, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { dateTime, money, time } from '../lib/format'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, Select, cx } from '../components/ui'

export function OpenSessionForm({ compact }: { compact?: boolean }) {
  const openSession = useStore((s) => s.openSession)
  const [amount, setAmount] = useState('20000')
  const [register, setRegister] = useState('Caja 1')
  const [shift, setShift] = useState(new Date().getHours() < 14 ? 'Mañana' : 'Tarde')
  const [error, setError] = useState('')
  return (
    <Card className={cx('p-5', compact ? '' : 'max-w-xl')}>
      <div className="mb-1 flex items-center gap-2 font-semibold text-ink-900">
        <LockOpen size={18} className="text-brand-600" /> Abrir caja
      </div>
      <p className="mb-4 text-sm text-ink-400">No se puede vender sin una caja abierta a tu nombre.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input label="Monto inicial en efectivo" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Select label="Caja" value={register} onChange={(e) => setRegister(e.target.value)}>
          <option>Caja 1</option>
          <option>Caja 2</option>
        </Select>
        <Select label="Turno" value={shift} onChange={(e) => setShift(e.target.value)}>
          <option>Mañana</option>
          <option>Tarde</option>
          <option>Noche</option>
        </Select>
      </div>
      {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
      <Button className="mt-4" onClick={() => setError(openSession(Number(amount) || 0, register, shift) ?? '')}>
        Abrir caja
      </Button>
    </Card>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={cx('flex justify-between py-1.5 text-sm', strong && 'border-t border-ink-900/10 pt-2.5 font-semibold')}>
      <span className="text-ink-600">{label}</span>
      <span className={cx('tabular', tone)}>{value}</span>
    </div>
  )
}

export default function Caja() {
  const me = useMe()!
  const state = useStore()
  const session = currentSession(state)
  const [mov, setMov] = useState<'retiro' | 'ingreso' | null>(null)
  const [movAmount, setMovAmount] = useState('')
  const [movReason, setMovReason] = useState('')
  const [closing, setClosing] = useState(false)
  const [counted, setCounted] = useState('')
  const [msg, setMsg] = useState('')

  const totals = session ? sessionTotals(session, state.sales) : null
  const history = useMemo(
    () =>
      state.sessions.filter((s) => s.businessId === state.businessId && (can(me.role, 'caja.verTodas') || s.userId === me.id)),
    [state.sessions, state.businessId, me],
  )
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Caja" tag="M1" subtitle="Apertura, movimientos y cierre con esperado, contado y diferencia por turno y cajero." />

      {!session ? (
        <OpenSessionForm />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Wallet size={18} className="text-brand-600" />
                <span className="font-semibold">
                  {session.register} · turno {session.shift}
                </span>
                <Badge tone="green">Abierta</Badge>
              </div>
              <span className="text-xs text-ink-400">Desde las {time(session.openedAt)} · {totals!.count} ventas</span>
            </div>
            <Row label="Monto inicial" value={money(session.openingAmount)} />
            <Row label="Ventas en efectivo" value={money(totals!.cash)} />
            <Row label="Ingresos manuales" value={money(totals!.ins)} />
            <Row label="Retiros" value={'-' + money(totals!.outs)} />
            <Row label="Efectivo esperado en caja" value={money(totals!.expected)} strong />
            <div className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-600">
              Transferencias del turno: <span className="tabular font-medium text-ink-900">{money(totals!.transfer)}</span> (no suman al efectivo)
            </div>
            {session.movements.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-semibold uppercase text-ink-400">Movimientos</div>
                {session.movements.map((m) => (
                  <div key={m.id} className="flex justify-between border-b border-ink-900/[0.06] py-1.5 text-sm last:border-0">
                    <span>
                      {time(m.at)} · {m.type === 'retiro' ? 'Retiro' : 'Ingreso'}: {m.reason}
                    </span>
                    <span className={cx('tabular', m.type === 'retiro' ? 'text-rose-600' : 'text-emerald-600')}>
                      {m.type === 'retiro' ? '-' : '+'}
                      {money(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => setMov('retiro')}>
              <ArrowUpCircle size={16} /> Registrar retiro
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setMov('ingreso')}>
              <ArrowDownCircle size={16} /> Registrar ingreso
            </Button>
            <Button variant="danger" className="w-full" onClick={() => setClosing(true)}>
              <Lock size={16} /> Cerrar caja
            </Button>
            <div className="space-y-1.5 pt-2">
              <Rule id="M1-R4">El cierre no se puede reabrir sin permiso de Encargado o superior.</Rule>
              <Rule id="M1-R5">Las diferencias quedan registradas con el turno y el cajero.</Rule>
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-8 font-semibold text-ink-900">{can(me.role, 'caja.verTodas') ? 'Cierres de todas las cajas' : 'Mis cierres'}</h2>
      {msg && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{msg}</div>}
      <Card className="overflow-x-auto">
        {history.length === 0 ? (
          <Empty>Todavía no hay cajas en este negocio. Abrí una para empezar a vender.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-5 py-3 font-bold">Caja / turno</th>
                <th className="px-5 py-3 font-bold">Cajero</th>
                <th className="px-5 py-3 font-bold">Apertura</th>
                <th className="px-5 py-3 text-right font-bold">Esperado</th>
                <th className="px-5 py-3 text-right font-bold">Contado</th>
                <th className="px-5 py-3 text-right font-bold">Diferencia</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {history.map((s) => {
                const diff = s.closedAt ? (s.countedAmount ?? 0) - (s.expectedAmount ?? 0) : null
                return (
                  <tr key={s.id} className="border-t border-ink-900/[0.06] transition-colors hover:bg-brand-50/40">
                    <td className="px-5 py-3.5">
                      {s.register} · {s.shift}
                    </td>
                    <td className="px-5 py-3.5">{userName(s.userId)}</td>
                    <td className="px-5 py-3.5 text-ink-400">{dateTime(s.openedAt)}</td>
                    <td className="tabular px-5 py-3.5 text-right">{s.closedAt ? money(s.expectedAmount!) : '—'}</td>
                    <td className="tabular px-5 py-3.5 text-right">{s.closedAt ? money(s.countedAmount!) : '—'}</td>
                    <td className={cx('tabular px-5 py-3.5 text-right font-medium', diff === null ? '' : diff === 0 ? 'text-emerald-600' : 'text-rose-600')}>
                      {diff === null ? <Badge tone="green">Abierta</Badge> : (diff > 0 ? '+' : '') + money(diff)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {s.closedAt && can(me.role, 'caja.reabrir') && (
                        <Button size="sm" variant="ghost" onClick={() => setMsg(state.reopenSession(s.id) ?? '')}>
                          Reabrir
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Modal
        open={!!mov}
        onClose={() => setMov(null)}
        title={mov === 'retiro' ? 'Retiro de efectivo' : 'Ingreso de efectivo'}
        footer={
          <Button
            disabled={!Number(movAmount) || !movReason.trim()}
            onClick={() => {
              state.addCashMovement(mov!, Number(movAmount), movReason.trim())
              setMov(null)
              setMovAmount('')
              setMovReason('')
            }}
          >
            Registrar
          </Button>
        }
      >
        <div className="space-y-3">
          <Input label="Monto" type="number" min={0} value={movAmount} onChange={(e) => setMovAmount(e.target.value)} autoFocus />
          <Input label="Motivo" placeholder={mov === 'retiro' ? 'Ej.: pago a proveedor, depósito' : 'Ej.: cambio para la caja'} value={movReason} onChange={(e) => setMovReason(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        title="Cierre de caja"
        footer={
          <Button
            variant="danger"
            disabled={counted === ''}
            onClick={() => {
              state.closeSession(Number(counted))
              setClosing(false)
              setCounted('')
            }}
          >
            Confirmar cierre
          </Button>
        }
      >
        {totals && (
          <div>
            <Row label="Efectivo esperado" value={money(totals.expected)} />
            <div className="my-3">
              <Input label="Efectivo contado en caja" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} autoFocus />
            </div>
            {counted !== '' && (
              <Row
                label="Diferencia"
                strong
                value={(Number(counted) - totals.expected > 0 ? '+' : '') + money(Number(counted) - totals.expected)}
                tone={Number(counted) === totals.expected ? 'text-emerald-600' : 'text-rose-600'}
              />
            )}
            <p className="mt-3 text-xs text-ink-400">El cierre queda en el registro de auditoría con el esperado, el contado y la diferencia.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
