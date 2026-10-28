import { useMemo, useState } from 'react'
import { AlertOctagon, ArrowDownToLine, ArrowUpFromLine, CalendarPlus, CheckCircle2, MessageCircle, Phone, Ruler } from 'lucide-react'
import { currentSession, useStore } from '../store'
import { date, money, todayISO } from '../lib/format'
import { NEEDS_CLEANING, damageCharge, lateDays, lateFeeFor } from '../lib/rental'
import type { PayMethod, ReceiptKind, RentalIncident, Reservation } from '../types'
import { Badge, Button, Card, Empty, Modal, PageHeader, Rule, Select, cx } from '../components/ui'
import { Simulated } from '../components/common'
import { OpenSessionForm } from './Caja'

export const channelLabel = { mostrador: 'Mostrador', whatsapp: 'WhatsApp', web: 'Web' }

export function linesText(r: Reservation) {
  return r.lines.map((l) => `${l.qty > 1 ? `${l.qty}× ` : ''}${l.type} ${l.size}`).join(' · ')
}

export default function Mostrador() {
  const state = useStore()
  const today = todayISO()
  const session = currentSession(state)
  const [deliver, setDeliver] = useState<Reservation | null>(null)
  const [receive, setReceive] = useState<Reservation | null>(null)
  const [sent, setSent] = useState<string[]>([])

  const pickups = state.reservations.filter((r) => r.status === 'reservada' && r.from <= today).sort((a, b) => a.from.localeCompare(b.from))
  const returns = state.reservations.filter((r) => r.status === 'entregada' && r.to === today)
  const late = state.reservations.filter((r) => r.status === 'entregada' && r.to < today)
  const active = state.reservations.filter((r) => r.status === 'entregada' && r.to > today).sort((a, b) => a.to.localeCompare(b.to))
  const client = (id: string) => state.clients.find((c) => c.id === id)

  const remind = (r: Reservation, kind: 'retiro' | 'devolucion' | 'demora') => {
    const c = client(r.clientId)
    const body =
      kind === 'retiro'
        ? `Hola, te esperamos hoy para retirar tu reserva #${r.number}. Saldo ${money(r.total - r.deposit)} + depósito ${money(r.guarantee)} (reintegrable).`
        : kind === 'devolucion'
          ? `Hola, hoy hasta las 19 h es la devolución de la reserva #${r.number}. ¡Gracias!`
          : `Hola, la reserva #${r.number} debía volver el ${date(r.to)}. Lleva un recargo de ${money(lateFeeFor(r, today))}. Por favor acercate hoy.`
    state.sendMessage({ businessId: 'alquiler', channel: 'WhatsApp', to: c ? `${c.name} · ${c.phone}` : 'Cliente', subject: `Reserva #${r.number}`, body })
    setSent((s) => [...s, `${r.id}-${kind}`])
  }

  const row = (r: Reservation, mode: 'retiro' | 'devolucion' | 'demora' | 'curso') => {
    const c = client(r.clientId)
    const sentKey = `${r.id}-${mode}`
    return (
      <div key={r.id} className="border-t border-white/10 px-4 py-3.5 first:border-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-white">{c?.name}</span>
              <Badge>#{r.number}</Badge>
              <Badge tone="blue">{channelLabel[r.channel]}</Badge>
              {mode === 'demora' && <Badge tone="red">{lateDays(r.to, today)} día(s) de demora</Badge>}
            </div>
            <div className="mt-1 text-sm text-ink-200">
              {date(r.from)} al {date(r.to)} · {r.days} días · {linesText(r)}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-300">
              <span className="flex items-center gap-1">
                <Phone size={12} aria-hidden /> {c?.phone}
              </span>
              {c?.sizes && (
                <span className="flex items-center gap-1">
                  <Ruler size={12} aria-hidden /> calzado {c.sizes.calzado ?? '—'} · altura {c.sizes.altura ?? '—'} cm · ropa {c.sizes.ropa ?? '—'}
                </span>
              )}
            </div>
            {r.notes && <div className="mt-1.5 text-xs text-amber-200">Nota: {r.notes}</div>}
          </div>
          <div className="shrink-0 text-right text-xs">
            {mode === 'retiro' ? (
              <>
                <div className="text-ink-300">Saldo a cobrar</div>
                <div className="tabular text-lg font-bold text-white">{money(r.total - r.deposit)}</div>
                <div className="text-ink-300">+ depósito {money(r.guarantee)}</div>
              </>
            ) : mode === 'demora' ? (
              <>
                <div className="text-ink-300">Recargo acumulado</div>
                <div className="tabular text-lg font-bold text-rose-300">{money(lateFeeFor(r, today))}</div>
              </>
            ) : (
              <>
                <div className="text-ink-300">Depósito tomado</div>
                <div className="tabular text-lg font-bold text-white">{money(r.guarantee)}</div>
                <div className="text-ink-300">{r.guaranteeMethod === 'tarjeta' ? 'preautorización' : 'efectivo'}</div>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {mode === 'retiro' && (
            <Button size="sm" onClick={() => setDeliver(r)} disabled={!session}>
              <ArrowUpFromLine size={14} aria-hidden /> Entregar equipo
            </Button>
          )}
          {mode !== 'retiro' && (
            <Button size="sm" onClick={() => setReceive(r)} disabled={!session}>
              <ArrowDownToLine size={14} aria-hidden /> Recibir y revisar
            </Button>
          )}
          {!session && mode !== 'curso' && <span className="basis-full text-xs text-amber-200">Abrí una caja para poder cobrar y entregar o recibir.</span>}
          {mode !== 'curso' && (
            <Button size="sm" variant="secondary" disabled={sent.includes(sentKey)} onClick={() => remind(r, mode)}>
              <MessageCircle size={14} aria-hidden /> {sent.includes(sentKey) ? 'Aviso enviado' : 'Avisar por WhatsApp'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Mostrador"
        subtitle="Retiros, devoluciones y demoras del día. Cada entrega cobra el saldo y toma el depósito; cada devolución revisa el estado de las prendas."
        actions={
          <Button
            variant="secondary"
            onClick={() => {
              state.setReservationDraft({})
              state.setPage('reservas')
            }}
          >
            <CalendarPlus size={16} aria-hidden /> Nueva reserva
          </Button>
        }
      />
      {!session && (
        <div className="mb-5">
          <OpenSessionForm compact />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="flex items-center gap-2 font-semibold text-white">
              <ArrowUpFromLine size={17} className="text-brand-200" aria-hidden /> Retiran hoy
            </span>
            <Badge tone="brand">{pickups.length}</Badge>
          </div>
          {pickups.length ? pickups.map((r) => row(r, 'retiro')) : <Empty>No hay retiros pendientes para hoy.</Empty>}
        </Card>
        <div className="space-y-4">
          {late.length > 0 && (
            <Card className="ring-1 ring-rose-300/30">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="flex items-center gap-2 font-semibold text-rose-200">
                  <AlertOctagon size={17} aria-hidden /> Devoluciones atrasadas
                </span>
                <Badge tone="red">{late.length}</Badge>
              </div>
              {late.map((r) => (
                row(r, 'demora')
              ))}
            </Card>
          )}
          <Card>
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2 font-semibold text-white">
                <ArrowDownToLine size={17} className="text-brand-200" aria-hidden /> Devuelven hoy
              </span>
              <Badge tone="brand">{returns.length}</Badge>
            </div>
            {returns.length ? returns.map((r) => row(r, 'devolucion')) : <Empty>No hay devoluciones programadas para hoy.</Empty>}
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="font-semibold text-white">Alquileres en curso</span>
          <Badge>{active.length}</Badge>
        </div>
        {active.length ? active.map((r) => row(r, 'curso')) : <Empty>No hay equipos en la calle con devolución futura.</Empty>}
      </Card>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        <Rule id="Seña">Al reservar se cobra el 30% como seña; el saldo se cobra al retirar.</Rule>
        <Rule id="Garantía">El depósito se toma al entregar (efectivo o preautorización de tarjeta) y se devuelve al recibir, descontando cargos.</Rule>
        <Rule id="Demora">Cada día de demora cobra la tarifa diaria más un 20% de recargo.</Rule>
        <Rule id="Revisión">Las prendas vuelven a limpieza; los equipos con daño pasan a mantenimiento y no se pueden alquilar.</Rule>
      </div>

      {deliver && <DeliverModal r={deliver} onClose={() => setDeliver(null)} />}
      {receive && <ReturnModal r={receive} onClose={() => setReceive(null)} />}
    </div>
  )
}

function DeliverModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const state = useStore()
  const client = state.clients.find((c) => c.id === r.clientId)
  // asignación automática: unidades disponibles del talle, primero las menos usadas
  const initial = useMemo(() => {
    const used = new Set<string>()
    const out: { type: string; size: string; itemId: string }[] = []
    for (const l of r.lines)
      for (let k = 0; k < l.qty; k++) {
        const it = state.rentalItems
          .filter((i) => i.type === l.type && i.size === l.size && i.state === 'disponible' && !used.has(i.id))
          .sort((a, b) => a.uses - b.uses)[0]
        if (it) used.add(it.id)
        out.push({ type: l.type, size: l.size, itemId: it?.id ?? '' })
      }
    return out
  }, [r, state.rentalItems])
  const [slots, setSlots] = useState(initial)
  const [payMethod, setPayMethod] = useState<PayMethod>('efectivo')
  const [guaranteeMethod, setGuaranteeMethod] = useState<'tarjeta' | 'efectivo'>('tarjeta')
  const [kind, setKind] = useState<ReceiptKind>(client?.cuit ? 'A' : 'B')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const balance = r.total - r.deposit

  return (
    <Modal open onClose={onClose} title={done ? `Reserva #${r.number} entregada` : `Entregar reserva #${r.number}`} width="max-w-2xl">
      {done ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
            <CheckCircle2 size={16} /> Se cobró el saldo de {money(balance)} y se tomó un depósito de {money(r.guarantee)} ({guaranteeMethod === 'tarjeta' ? 'preautorización' : 'efectivo'}).
          </div>
          <p className="text-sm text-ink-300">Las unidades quedaron como “alquiladas” y la devolución está agendada para el {date(r.to)}.</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Listo</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-ink-200">
            {client?.name} · {date(r.from)} al {date(r.to)} ({r.days} días)
            {client?.sizes && <span className="text-ink-400"> · calzado {client.sizes.calzado} · ropa {client.sizes.ropa}</span>}
          </div>
          <div className="mb-4 space-y-2">
            {slots.map((s, i) => {
              const options = state.rentalItems.filter((it) => it.type === s.type && it.size === s.size && it.state === 'disponible' && (it.id === s.itemId || !slots.some((x) => x.itemId === it.id)))
              return (
                <div key={i} className="grid items-center gap-1.5 sm:grid-cols-[1fr_1.3fr] sm:gap-3">
                  <div className="text-sm font-medium text-white">
                    {s.type} <span className="text-ink-300">talle {s.size}</span>
                  </div>
                  <Select aria-label={`Unidad de ${s.type} talle ${s.size}`} value={s.itemId} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
                    <option value="">{options.length ? 'Elegir unidad…' : 'Sin unidades disponibles'}</option>
                    {options.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} · {it.brand} · {it.condition} · {it.uses} usos
                      </option>
                    ))}
                  </Select>
                </div>
              )
            })}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Select label={`Saldo ${money(balance)}`} value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod)}>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="qr">QR</option>
            </Select>
            <Select label={`Depósito ${money(r.guarantee)}`} value={guaranteeMethod} onChange={(e) => setGuaranteeMethod(e.target.value as 'tarjeta' | 'efectivo')}>
              <option value="tarjeta">Preautorización de tarjeta</option>
              <option value="efectivo">Efectivo</option>
            </Select>
            <Select label="Comprobante" value={kind} onChange={(e) => setKind(e.target.value as ReceiptKind)}>
              <option value="B">Factura B</option>
              <option value="A" disabled={!client?.cuit}>
                Factura A {client?.cuit ? '' : '(sin CUIT)'}
              </option>
              <option value="ticket">Interno</option>
            </Select>
          </div>
          {guaranteeMethod === 'tarjeta' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-300">
              La preautorización bloquea el monto en la tarjeta sin cobrarlo. <Simulated />
            </div>
          )}
          {error && <div className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-ink-300">
              A cobrar ahora: <b className="tabular text-white">{money(balance + (guaranteeMethod === 'efectivo' ? r.guarantee : 0))}</b>
            </span>
            <Button
              variant="success"
              disabled={slots.some((s) => !s.itemId)}
              onClick={() => {
                const err = state.deliverReservation(r.id, { itemIds: slots.map((s) => s.itemId), payMethod, guaranteeMethod, receiptKind: kind })
                if (err) setError(err)
                else setDone(true)
              }}
            >
              Confirmar entrega
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}

const CONDITIONS: { value: RentalIncident['kind'] | ''; label: string }[] = [
  { value: '', label: 'Bien' },
  { value: 'suciedad', label: 'Suciedad excesiva' },
  { value: 'daño leve', label: 'Daño leve' },
  { value: 'daño grave', label: 'Daño grave' },
  { value: 'faltante', label: 'No lo devolvió' },
]

function ReturnModal({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const state = useStore()
  const today = todayISO()
  const items = state.rentalItems.filter((i) => r.itemIds.includes(i.id))
  const [cond, setCond] = useState<Record<string, RentalIncident['kind'] | ''>>({})
  const [payMethod, setPayMethod] = useState<PayMethod>('tarjeta')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ extras: number; refund: number } | null>(null)
  const late = lateFeeFor(r, today)
  const damages = items.reduce((a, i) => a + (cond[i.id] ? damageCharge(cond[i.id] as RentalIncident['kind'], i.value) : 0), 0)
  const extras = late + damages
  const cash = r.guaranteeMethod === 'efectivo'

  return (
    <Modal open onClose={onClose} title={result ? `Reserva #${r.number} devuelta` : `Recibir reserva #${r.number}`} width="max-w-2xl">
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
            <CheckCircle2 size={16} />
            {cash
              ? `Devolvé ${money(result.refund)} en efectivo${result.extras ? ` (se descontaron ${money(Math.min(result.extras, r.guarantee))} de cargos)` : ''}.`
              : `Preautorización liberada.${result.extras ? ` Se cobraron ${money(result.extras)} de cargos.` : ''}`}
          </div>
          <p className="text-sm text-ink-300">Las prendas pasaron a limpieza y los equipos con daño a mantenimiento. Lo ves en Equipos y prendas.</p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Listo</Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-300">Revisá cada unidad. Los cargos se calculan solos según el valor de reposición.</p>
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="grid items-center gap-1.5 rounded-2xl bg-white/[0.03] p-2.5 ring-1 ring-white/10 sm:grid-cols-[1fr_11rem_6rem] sm:gap-3 sm:bg-transparent sm:p-0 sm:ring-0">
                <div className="text-sm">
                  <span className="font-medium text-white">
                    {i.type} {i.size}
                  </span>
                  <span className="text-ink-400">
                    {' '}
                    · {i.code} · {NEEDS_CLEANING.includes(i.type) ? 'va a limpieza' : 'revisión'}
                  </span>
                </div>
                <Select aria-label={`Estado de ${i.type} ${i.size}`} value={cond[i.id] ?? ''} onChange={(e) => setCond({ ...cond, [i.id]: e.target.value as RentalIncident['kind'] | '' })}>
                  {CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <span className={cx('tabular text-right text-sm', cond[i.id] ? 'font-semibold text-rose-300' : 'text-ink-400')}>{cond[i.id] ? money(damageCharge(cond[i.id] as RentalIncident['kind'], i.value)) : '—'}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
            <div className="flex justify-between">
              <span className="text-ink-300">Recargo por demora {late ? `(${lateDays(r.to, today)} día/s)` : ''}</span>
              <span className="tabular text-white">{money(late)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-300">Daños y limpieza</span>
              <span className="tabular text-white">{money(damages)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-300">Depósito tomado ({cash ? 'efectivo' : 'preautorización'})</span>
              <span className="tabular text-white">{money(r.guarantee)}</span>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
              <span className="text-white">{cash ? (extras > r.guarantee ? 'El cliente paga además' : 'Devolver al cliente') : 'Cobrar al cliente'}</span>
              <span className="tabular text-lg text-white">{money(cash ? Math.abs(r.guarantee - extras) : extras)}</span>
            </div>
          </div>
          {!cash && extras > 0 && (
            <div className="mt-3 max-w-xs">
              <Select label="Cobrar los cargos con" value={payMethod} onChange={(e) => setPayMethod(e.target.value as PayMethod)}>
                <option value="tarjeta">Tarjeta de la preautorización</option>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </Select>
            </div>
          )}
          {error && <div className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
          <div className="mt-5 flex justify-end">
            <Button
              variant="success"
              onClick={() => {
                const res = state.returnReservation(r.id, { inspections: items.map((i) => ({ itemId: i.id, kind: cond[i.id] || null })), payMethod })
                if (res.error) setError(res.error)
                else setResult({ extras: res.extras ?? 0, refund: res.refund ?? 0 })
              }}
            >
              Confirmar devolución
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
