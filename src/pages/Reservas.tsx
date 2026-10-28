import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarPlus, CalendarX2, CheckCircle2, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { currentSession, useStore } from '../store'
import { addDays, date, dateTime, money, todayISO } from '../lib/format'
import { DAILY_RATE, PACKS, RENTAL_TYPES, SIZES, availability, quoteRental, suggestSize } from '../lib/rental'
import type { Client, PayMethod, RentalType, Reservation, ReservationLine } from '../types'
import { Badge, Button, Card, Empty, IconButton, Input, Modal, PageHeader, Segmented, Select, cx, useGuard } from '../components/ui'
import { ClientPicker } from '../components/common'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'
import { channelLabel, linesText } from './Mostrador'
import { OpenSessionForm } from './Caja'

const statusTone = { reservada: 'blue', entregada: 'amber', devuelta: 'green', cancelada: 'slate' } as const
const statusLabel = { reservada: 'Reservada', entregada: 'En curso', devuelta: 'Devuelta', cancelada: 'Cancelada' }

export default function Reservas() {
  const state = useStore()
  const [filter, setFilter] = useState<'proximas' | 'curso' | 'historial'>('proximas')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const today = todayISO()

  // pedido de nueva reserva desde otra pantalla (mostrador o disponibilidad)
  useEffect(() => {
    if (state.reservationDraft) setCreating(true)
  }, [state.reservationDraft])

  const client = (id: string) => state.clients.find((c) => c.id === id)
  const term = q.trim().toLowerCase()
  const list = useMemo(
    () =>
      state.reservations
        .filter((r) => (filter === 'proximas' ? r.status === 'reservada' : filter === 'curso' ? r.status === 'entregada' : r.status === 'devuelta' || r.status === 'cancelada'))
        .filter((r) => !term || state.clients.find((c) => c.id === r.clientId)?.name.toLowerCase().includes(term) || String(r.number).includes(term))
        .sort((a, b) => (filter === 'historial' ? b.from.localeCompare(a.from) : a.from.localeCompare(b.from))),
    [state.reservations, state.clients, filter, term],
  )
  const shown = list.slice(0, 80)
  const r = state.reservations.find((x) => x.id === detail)

  const columns: Col<Reservation>[] = [
    {
      key: 'cliente',
      header: 'Reserva y cliente',
      mobile: 'title',
      className: 'min-w-[11rem]',
      cell: (x) => (
        <>
          <span className="tabular text-ink-300">#{x.number}</span> <span className="wrap-any font-semibold text-white">{client(x.clientId)?.name}</span>
        </>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      mobile: 'value',
      cell: (x) => <span className="tabular whitespace-nowrap font-semibold">{money(x.total + (x.lateFee ?? 0) + (x.damageFee ?? 0))}</span>,
    },
    {
      key: 'fechas',
      header: 'Fechas',
      className: 'whitespace-nowrap',
      cell: (x) => (
        <>
          {date(x.from).slice(0, 5)} → {date(x.to).slice(0, 5)} <span className="text-ink-300">({x.days} d)</span>
          {x.from === today && x.status === 'reservada' && (
            <Badge tone="amber" className="ml-2">
              Retira hoy
            </Badge>
          )}
        </>
      ),
    },
    { key: 'equipo', header: 'Equipo', className: 'wrap-any min-w-[16rem] text-ink-100', cell: (x) => linesText(x) },
    { key: 'canal', header: 'Canal', className: 'text-ink-200', cell: (x) => channelLabel[x.channel] },
    {
      key: 'estado',
      header: 'Estado',
      cell: (x) => {
        const late = x.status === 'entregada' && x.to < today
        return <Badge tone={late ? 'red' : statusTone[x.status]}>{late ? 'Devolución atrasada' : statusLabel[x.status]}</Badge>
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Reservas"
        subtitle="Reservas por fecha con seña, depósito en garantía y talles. La disponibilidad se controla por talle y por día."
        actions={
          <Button onClick={() => setCreating(true)}>
            <CalendarPlus size={16} aria-hidden /> Nueva reserva
          </Button>
        }
      />
      <div className="mb-3 space-y-3">
        <Segmented
          label="Estado de las reservas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'proximas', label: `Por retirar (${state.reservations.filter((x) => x.status === 'reservada').length})` },
            { value: 'curso', label: `En curso (${state.reservations.filter((x) => x.status === 'entregada').length})` },
            { value: 'historial', label: 'Historial' },
          ]}
        />
        <div className="relative max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input className="pl-10" type="search" aria-label="Buscar reservas" placeholder="Buscar por nombre del cliente o número de reserva" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="mb-2 text-sm text-ink-300" aria-live="polite">
        {list.length} reserva{list.length === 1 ? '' : 's'}
        {list.length > shown.length && ` · mostrando las primeras ${shown.length}`}
      </p>
      <Card>
        {list.length === 0 ? (
          <Empty
            icon={<CalendarX2 size={22} />}
            action={
              q ? (
                <Button variant="secondary" onClick={() => setQ('')}>
                  Borrar la búsqueda
                </Button>
              ) : filter === 'proximas' ? (
                <Button onClick={() => setCreating(true)}>Crear una reserva</Button>
              ) : undefined
            }
          >
            {q ? `No encontramos reservas para “${q.trim()}” en esta vista.` : filter === 'proximas' ? 'No hay reservas pendientes de retiro.' : filter === 'curso' ? 'No hay equipos en la calle ahora.' : 'Todavía no hay reservas terminadas.'}
          </Empty>
        ) : (
          <DataTable caption="Listado de reservas" columns={columns} rows={shown} rowKey={(x) => x.id} onRowClick={(x) => setDetail(x.id)} rowLabel={(x) => `Reserva ${x.number} de ${client(x.clientId)?.name}. Abrir detalle`} />
        )}
      </Card>

      {creating && (
        <NewReservation
          onClose={() => {
            setCreating(false)
            state.setReservationDraft(null)
          }}
        />
      )}
      {r && <ReservationDetail r={r} onClose={() => setDetail(null)} />}
    </div>
  )
}

function ReservationDetail({ r, onClose }: { r: Reservation; onClose: () => void }) {
  const state = useStore()
  const confirm = useConfirm()
  const guard = useGuard()
  const c = state.clients.find((x) => x.id === r.clientId)
  const charges = state.sales.filter((s) => s.reservationId === r.id)
  const items = state.rentalItems.filter((i) => r.itemIds.includes(i.id))
  const incidents = state.incidents.filter((i) => i.reservationId === r.id)
  const [error, setError] = useState('')

  const cancel = (refund: boolean) =>
    guard(async () => {
      const ok = await confirm({
        title: refund ? 'Cancelar y devolver la seña' : 'Cancelar y retener la seña',
        message: refund ? (
          <>
            Se cancela la reserva #{r.number} y se devuelve la seña de <b>{money(r.deposit)}</b> desde la caja abierta. Los equipos vuelven a quedar disponibles para esas fechas.
          </>
        ) : (
          <>
            Se cancela la reserva #{r.number} y la seña de <b>{money(r.deposit)}</b> queda retenida según la política del local. Los equipos vuelven a quedar disponibles.
          </>
        ),
        confirmLabel: refund ? 'Cancelar y devolver seña' : 'Cancelar y retener seña',
        cancelLabel: 'Volver',
        danger: true,
      })
      if (!ok) return
      const e = state.cancelReservation(r.id, refund)
      if (e) setError(e)
      else onClose()
    })

  return (
    <Modal open onClose={onClose} title={`Reserva #${r.number}`} width="max-w-2xl">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="text-xs text-ink-300">Cliente</div>
          <div className="wrap-any font-semibold text-white">{c?.name}</div>
          <div className="text-sm text-ink-200">{c?.phone}</div>
        </div>
        <div className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="text-xs text-ink-300">Fechas</div>
          <div className="font-semibold text-white">
            {date(r.from)} al {date(r.to)} · {r.days} días
          </div>
          <div className="text-sm text-ink-200">
            Canal {channelLabel[r.channel]} · creada {dateTime(r.createdAt)}
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        {r.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-3">
            <span className="text-ink-100">
              {l.qty}× {l.type} talle {l.size}
            </span>
            <span className="tabular shrink-0 text-ink-200">{money(DAILY_RATE[l.type] * l.qty)} por día</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
          <span className="text-ink-200">Alquiler {r.discountPct ? `(−${r.discountPct}% por ${r.days} días)` : ''}</span>
          <span className="tabular font-semibold text-white">{money(r.total)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-200">Seña</span>
          <span className="tabular text-white">{money(r.deposit)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-200">Depósito en garantía</span>
          <span className="tabular text-white">{money(r.guarantee)}</span>
        </div>
        {(r.lateFee || r.damageFee) && (
          <div className="flex justify-between gap-3 text-rose-200">
            <span>Recargos y daños</span>
            <span className="tabular">{money((r.lateFee ?? 0) + (r.damageFee ?? 0))}</span>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-ink-300">Unidades entregadas</div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((i) => (
              <Badge key={i.id}>
                {i.code} · {i.type} {i.size}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {incidents.length > 0 && (
        <div className="mt-3 space-y-0.5 text-sm text-rose-200">
          {incidents.map((i) => (
            <div key={i.id}>
              {i.kind} · {money(i.charge)}
            </div>
          ))}
        </div>
      )}
      {charges.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold text-ink-300">Cobros</div>
          {charges.map((s) => (
            <div key={s.id} className="flex justify-between gap-3 border-b border-white/10 py-1.5 text-sm">
              <span className="text-ink-200">
                {s.items[0].name} · {dateTime(s.at)}
              </span>
              <span className="tabular shrink-0 text-white">{money(s.total)}</span>
            </div>
          ))}
        </div>
      )}
      {r.notes && <div className="mt-3 rounded-xl bg-amber-400/12 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-300/25">{r.notes}</div>}
      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">
          {error}
        </div>
      )}
      {r.status === 'reservada' && (
        <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => cancel(false)}>
            Cancelar y retener seña
          </Button>
          <Button variant="danger" onClick={() => cancel(true)}>
            Cancelar y devolver seña
          </Button>
        </div>
      )}
    </Modal>
  )
}

function NewReservation({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const guard = useGuard()
  const draft = state.reservationDraft
  const today = todayISO()
  const session = currentSession(state)
  const [clientId, setClientId] = useState<string | undefined>(draft?.clientId)
  const [from, setFrom] = useState(draft?.from ?? addDays(1))
  const [to, setTo] = useState(addDays(2, new Date((draft?.from ?? addDays(1)) + 'T12:00:00')))
  const [lines, setLines] = useState<ReservationLine[]>(draft?.lines ?? [])
  const [channel, setChannel] = useState<Reservation['channel']>('mostrador')
  const [method, setMethod] = useState<PayMethod>('transferencia')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState<Reservation | null>(null)
  const client = state.clients.find((c) => c.id === clientId)

  const validDates = !!from && !!to && to >= from && from >= today
  const q = lines.length && validDates ? quoteRental(lines, from, to) : null
  const avail = (l: ReservationLine) => availability(state.rentalItems, state.reservations, l.type, l.size, from, validDates ? to : from, today)
  const missing = !clientId ? 'Elegí el cliente.' : !validDates ? (from < today ? 'La fecha de retiro no puede ser anterior a hoy.' : 'La devolución tiene que ser el mismo día del retiro o después.') : !lines.length ? 'Agregá al menos un equipo o prenda.' : !session ? 'Abrí una caja para cobrar la seña.' : ''
  const short = lines.filter((l) => avail(l).available < l.qty)

  const addLines = (ls: ReservationLine[]) => {
    setLines((cur) => {
      const next = cur.map((x) => ({ ...x }))
      for (const l of ls) {
        const size = suggestSize(l.type, client?.sizes, l.size)
        const same = next.find((x) => x.type === l.type && x.size === size)
        if (same) same.qty += l.qty
        else next.push({ ...l, size })
      }
      return next
    })
    setError('')
  }
  const setLine = (i: number, patch: Partial<ReservationLine>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  if (created)
    return (
      <Modal open onClose={onClose} title={`Reserva #${created.number} confirmada`}>
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden /> Seña de {money(created.deposit)} cobrada con comprobante.
          </div>
          <p className="text-sm text-ink-200">
            Se envió la confirmación por WhatsApp (simulado) con el saldo a pagar al retirar ({money(created.total - created.deposit)}) y el depósito en garantía ({money(created.guarantee)}). El día anterior sale el recordatorio automático.
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>Listo</Button>
          </div>
        </div>
      </Modal>
    )

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva reserva"
      width="max-w-3xl"
      footer={
        <>
          {missing && <p className="mr-auto self-center text-xs text-ink-300">{missing}</p>}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="success"
            disabled={!!missing || short.length > 0}
            onClick={() =>
              guard(() => {
                const res = state.createReservation({ clientId: clientId!, from, to, lines, channel, notes: notes || undefined, depositMethod: method })
                if (res.error) setError(res.error)
                else setCreated(res.reservation!)
              })
            }
          >
            Confirmar y cobrar seña
          </Button>
        </>
      }
    >
      {!session && (
        <div className="mb-4 rounded-2xl bg-amber-400/10 p-3 ring-1 ring-amber-300/25">
          <p className="mb-2 text-sm text-amber-100">Para cobrar la seña necesitás una caja abierta.</p>
          <OpenSessionForm compact />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-200 sm:text-xs">Cliente *</span>
          <ClientPicker value={clientId} onChange={(c: Client | null) => setClientId(c?.id)} />
          {client?.sizes && (
            <p className="mt-1.5 text-xs text-ink-200">
              Talles guardados: calzado {client.sizes.calzado} · altura {client.sizes.altura} cm · ropa {client.sizes.ropa}. Los packs los usan solos.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Retira *"
            type="date"
            min={today}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              if (to < e.target.value) setTo(e.target.value)
            }}
          />
          <Input label="Devuelve *" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-200 sm:text-xs">Agregar:</span>
          {PACKS.map((p) => (
            <Button key={p.name} size="sm" variant="secondary" onClick={() => addLines(p.lines)}>
              <Plus size={13} aria-hidden /> {p.name}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => addLines([{ type: 'Esquí', size: '160 cm', qty: 1 }])}>
            <Plus size={13} aria-hidden /> Línea suelta
          </Button>
        </div>
        <ul className="space-y-2">
          {lines.map((l, i) => {
            const a = avail(l)
            const enough = a.available >= l.qty
            return (
              <li key={i} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.3fr_1fr_auto_auto] md:items-center">
                  <Select aria-label={`Tipo de equipo, línea ${i + 1}`} value={l.type} onChange={(e) => setLine(i, { type: e.target.value as RentalType, size: SIZES[e.target.value as RentalType][0] })}>
                    {RENTAL_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                  <Select aria-label={`Talle, línea ${i + 1}`} value={l.size} onChange={(e) => setLine(i, { size: e.target.value })}>
                    {SIZES[l.type].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                  <div className="flex items-center gap-1" role="group" aria-label={`Cantidad, línea ${i + 1}`}>
                    <IconButton label="Quitar una unidad" onClick={() => setLine(i, { qty: Math.max(1, l.qty - 1) })}>
                      <Minus size={16} aria-hidden />
                    </IconButton>
                    <span className="tabular w-8 text-center font-bold text-white" aria-live="polite">
                      {l.qty}
                    </span>
                    <IconButton label="Agregar una unidad" onClick={() => setLine(i, { qty: l.qty + 1 })}>
                      <Plus size={16} aria-hidden />
                    </IconButton>
                  </div>
                  <IconButton label={`Quitar ${l.type} talle ${l.size}`} className="justify-self-end hover:text-rose-300" onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                    <Trash2 size={16} aria-hidden />
                  </IconButton>
                </div>
                <p className={cx('mt-2 flex items-start gap-1.5 text-sm font-medium', enough ? (a.available - l.qty <= 1 ? 'text-amber-200' : 'text-emerald-300') : 'text-rose-300')}>
                  {enough ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />}
                  {enough ? `Disponible: quedan ${a.available} de ${a.total} para esas fechas` : `No alcanza: hay ${a.available} de ${a.total} disponibles para esas fechas. Probá otro talle o cambiá las fechas.`}
                </p>
              </li>
            )
          })}
        </ul>
        {!lines.length && <p className="rounded-xl bg-white/[0.04] px-3 py-5 text-center text-sm text-ink-200 ring-1 ring-white/10">Todavía no agregaste equipos. Elegí un pack o una línea suelta.</p>}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Select label="Canal de la reserva" value={channel} onChange={(e) => setChannel(e.target.value as Reservation['channel'])}>
          <option value="mostrador">Mostrador</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="web">Web</option>
        </Select>
        <Select label={`Seña (${q ? money(q.deposit) : 'se calcula al elegir equipos'})`} value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="qr">QR</option>
        </Select>
        <Input label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: nivel principiante" />
      </div>

      {q && (
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10 md:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-300">Por día</dt>
            <dd className="tabular font-semibold text-white">{money(q.perDay)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-300">
              Total {q.days} día{q.days > 1 ? 's' : ''} {q.discountPct ? `(−${q.discountPct}%)` : ''}
            </dt>
            <dd className="tabular text-lg font-bold text-white">{money(q.total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-300">Seña ahora (30%)</dt>
            <dd className="tabular font-semibold text-white">{money(q.deposit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-300">Depósito al retirar</dt>
            <dd className="tabular font-semibold text-white">{money(q.guarantee)}</dd>
          </div>
        </dl>
      )}

      {error && (
        <div role="alert" className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">
          {error}
        </div>
      )}
    </Modal>
  )
}
