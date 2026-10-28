import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Lock, LockOpen, Wallet } from 'lucide-react'
import { currentSession, sessionTotals, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { dateTime, money, time } from '../lib/format'
import type { CashSession } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, Select, cx, useGuard } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'

export function OpenSessionForm({ compact }: { compact?: boolean }) {
  const openSession = useStore((s) => s.openSession)
  const guard = useGuard()
  const [amount, setAmount] = useState('20000')
  const [register, setRegister] = useState('Caja 1')
  const [shift, setShift] = useState(new Date().getHours() < 14 ? 'Mañana' : 'Tarde')
  const [error, setError] = useState('')
  const invalid = amount === '' || Number(amount) < 0 ? 'Ingresá el efectivo con el que arranca la caja (puede ser 0).' : ''
  return (
    <Card className={cx('p-5', compact ? '' : 'max-w-xl')}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          guard(() => setError(invalid || (openSession(Number(amount) || 0, register, shift) ?? '')))
        }}
      >
        <div className="mb-1 flex items-center gap-2 font-semibold text-white">
          <LockOpen size={18} className="text-brand-200" aria-hidden /> Abrir caja
        </div>
        <p className="mb-4 text-sm text-ink-200">No se puede vender ni cobrar sin una caja abierta a tu nombre.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Efectivo inicial" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-300">
            {error}
          </p>
        )}
        <Button type="submit" className="mt-4 w-full sm:w-auto">
          Abrir caja
        </Button>
      </form>
    </Card>
  )
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className={cx('flex justify-between gap-3 py-1.5 text-sm', strong && 'border-t border-white/10 pt-2.5 font-semibold')}>
      <span className="text-ink-200">{label}</span>
      <span className={cx('tabular shrink-0', tone)}>{value}</span>
    </div>
  )
}

const diffText = (n: number) => (n === 0 ? 'Sin diferencia' : n > 0 ? `Sobra ${money(n)}` : `Falta ${money(-n)}`)

export default function Caja() {
  const me = useMe()!
  const state = useStore()
  const guard = useGuard()
  const confirm = useConfirm()
  const session = currentSession(state)
  const [mov, setMov] = useState<'retiro' | 'ingreso' | null>(null)
  const [movAmount, setMovAmount] = useState('')
  const [movReason, setMovReason] = useState('')
  const [closing, setClosing] = useState(false)
  const [counted, setCounted] = useState('')
  const [error, setError] = useState('')

  const totals = session ? sessionTotals(session, state.sales) : null
  const history = useMemo(() => state.sessions.filter((s) => s.businessId === state.businessId && (can(me, 'caja.verTodas') || s.userId === me.id)), [state.sessions, state.businessId, me])
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id

  const columns: Col<CashSession>[] = [
    { key: 'caja', header: 'Caja y turno', mobile: 'title', className: 'font-semibold text-white', cell: (s) => `${s.register} · ${s.shift}` },
    {
      key: 'dif',
      header: 'Diferencia',
      align: 'right',
      mobile: 'value',
      cell: (s) => {
        if (!s.closedAt) return <Badge tone="green">Abierta</Badge>
        const diff = (s.countedAmount ?? 0) - (s.expectedAmount ?? 0)
        return <span className={cx('tabular whitespace-nowrap font-semibold', diff === 0 ? 'text-emerald-300' : 'text-rose-300')}>{diffText(diff)}</span>
      },
    },
    { key: 'cajero', header: 'Cajero', cell: (s) => userName(s.userId) },
    { key: 'apertura', header: 'Apertura', className: 'whitespace-nowrap text-ink-200', cell: (s) => dateTime(s.openedAt) },
    { key: 'esperado', header: 'Esperado', align: 'right', className: 'tabular', cell: (s) => (s.closedAt ? money(s.expectedAmount!) : 'En curso') },
    { key: 'contado', header: 'Contado', align: 'right', className: 'tabular', cell: (s) => (s.closedAt ? money(s.countedAmount!) : 'En curso') },
    {
      key: 'acc',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      cell: (s) =>
        s.closedAt && can(me, 'caja.reabrir') ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              guard(async () => {
                const ok = await confirm({
                  title: 'Reabrir la caja',
                  message: `Se reabre ${s.register} (turno ${s.shift}) de ${userName(s.userId)} y el cierre anterior queda anulado. Queda registrado en la auditoría.`,
                  confirmLabel: 'Reabrir caja',
                  danger: true,
                })
                if (!ok) return
                const e = state.reopenSession(s.id)
                setError(e ?? '')
              })
            }
          >
            Reabrir
          </Button>
        ) : null,
    },
  ]

  const movAmountN = Number(movAmount)
  const movHint = !movAmountN || movAmountN < 0 ? 'Ingresá un monto mayor a cero.' : !movReason.trim() ? 'Escribí el motivo del movimiento.' : mov === 'retiro' && totals && movAmountN > totals.expected ? `Es más que el efectivo esperado en caja (${money(totals.expected)}).` : ''
  const closeDiff = totals && counted !== '' ? Number(counted) - totals.expected : null

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Caja" tag="M1" subtitle="Apertura, movimientos y cierre con esperado, contado y diferencia por turno y cajero." />

      {!session ? (
        <OpenSessionForm />
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_300px]">
          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Wallet size={18} className="text-brand-200" aria-hidden />
                <span className="font-semibold">
                  {session.register} · turno {session.shift}
                </span>
                <Badge tone="green">Abierta</Badge>
              </div>
              <span className="text-xs text-ink-300">
                Desde las {time(session.openedAt)} · {totals!.count} ventas
              </span>
            </div>
            <Row label="Efectivo inicial" value={money(session.openingAmount)} />
            <Row label="Ventas en efectivo" value={money(totals!.cash)} />
            <Row label="Ingresos manuales" value={money(totals!.ins)} />
            <Row label="Retiros" value={'−' + money(totals!.outs)} />
            <Row label="Efectivo esperado en caja" value={money(totals!.expected)} strong />
            <div className="mt-3 rounded-xl bg-white/[0.06] px-3 py-2.5 text-sm text-ink-200">
              <div className="mb-1.5 text-xs font-semibold text-ink-300">Otros medios del turno (no suman al efectivo)</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                {(
                  [
                    ['Transferencia', totals!.transfer],
                    ['Tarjeta', totals!.card],
                    ['QR', totals!.qr],
                    ['Cuenta corriente', totals!.account],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-ink-300">{k}</dt>
                    <dd className="tabular font-semibold text-white">{money(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {session.movements.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-300">Movimientos manuales</div>
                {session.movements.map((m) => (
                  <div key={m.id} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm last:border-0">
                    <span className="wrap-any min-w-0">
                      {time(m.at)} · {m.type === 'retiro' ? 'Retiro' : 'Ingreso'}: {m.reason}
                    </span>
                    <span className={cx('tabular shrink-0', m.type === 'retiro' ? 'text-rose-300' : 'text-emerald-300')}>
                      {m.type === 'retiro' ? '−' : '+'}
                      {money(m.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => setMov('retiro')}>
              <ArrowUpCircle size={16} aria-hidden /> Registrar retiro
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setMov('ingreso')}>
              <ArrowDownCircle size={16} aria-hidden /> Registrar ingreso
            </Button>
            <Button variant="danger" className="w-full" onClick={() => setClosing(true)}>
              <Lock size={16} aria-hidden /> Cerrar caja
            </Button>
            <div className="space-y-1.5 pt-2">
              <Rule id="M1-R4">El cierre no se puede reabrir sin permiso de Encargado o superior.</Rule>
              <Rule id="M1-R5">Las diferencias quedan registradas con el turno y el cajero.</Rule>
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-2 mt-8 text-lg font-bold text-white">{can(me, 'caja.verTodas') ? 'Cierres de todas las cajas' : 'Mis cierres'}</h2>
      {error && (
        <div role="alert" className="mb-2 rounded-xl bg-amber-400/12 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-300/25">
          {error}
        </div>
      )}
      <Card>
        {history.length === 0 ? (
          <Empty icon={<Wallet size={22} />}>Todavía no hay cajas abiertas en este negocio. Abrí una para empezar a vender.</Empty>
        ) : (
          <DataTable caption="Cierres de caja" columns={columns} rows={history} rowKey={(s) => s.id} />
        )}
      </Card>

      <Modal
        open={!!mov}
        onClose={() => setMov(null)}
        title={mov === 'retiro' ? 'Retiro de efectivo' : 'Ingreso de efectivo'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMov(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!!movHint}
              onClick={() =>
                guard(() => {
                  state.addCashMovement(mov!, movAmountN, movReason.trim())
                  setMov(null)
                  setMovAmount('')
                  setMovReason('')
                })
              }
            >
              Registrar {mov}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Monto" type="number" inputMode="decimal" min={0} value={movAmount} onChange={(e) => setMovAmount(e.target.value)} />
          <Input label="Motivo" placeholder={mov === 'retiro' ? 'Ej.: pago a proveedor, depósito' : 'Ej.: cambio para la caja'} value={movReason} onChange={(e) => setMovReason(e.target.value)} />
          {movHint && <p className="text-xs text-ink-300">{movHint}</p>}
        </div>
      </Modal>

      <Modal
        open={closing}
        onClose={() => setClosing(false)}
        title="Cierre de caja"
        footer={
          <>
            <Button variant="secondary" onClick={() => setClosing(false)}>
              Volver
            </Button>
            <Button
              variant="danger"
              disabled={counted === '' || Number(counted) < 0}
              onClick={() =>
                guard(() => {
                  state.closeSession(Number(counted))
                  setClosing(false)
                  setCounted('')
                })
              }
            >
              Confirmar cierre
            </Button>
          </>
        }
      >
        {totals && (
          <div>
            <Row label="Efectivo esperado" value={money(totals.expected)} />
            <div className="my-3">
              <Input label="Efectivo contado en caja" type="number" inputMode="decimal" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} hint="Contá los billetes y monedas que hay ahora en la caja." />
            </div>
            {closeDiff !== null && <Row label="Diferencia" strong value={diffText(closeDiff)} tone={closeDiff === 0 ? 'text-emerald-300' : 'text-rose-300'} />}
            <p className="mt-3 text-sm text-ink-200">Al cerrar no se puede vender hasta abrir otra caja. El cierre queda en la auditoría con lo esperado, lo contado y la diferencia.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
