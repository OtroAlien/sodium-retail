// Alquiler de esquí y snowboard: reservas, entrega, devolución, garantías, limpieza y mantenimiento.
import type { RentalIncident, RentalItem, RentalState, Reservation } from '../types'
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { date, money, todayISO, uid } from '../lib/format'
import { can } from '../lib/permissions'
import { NEEDS_CLEANING, availability, damageCharge, lateDays, lateFeeFor, quoteRental } from '../lib/rental'
import { currentSession } from './selectors'

export function rentalSlice(set: SetState, get: GetState, h: Helpers) {
  const clientName = (id: string) => get().clients.find((c) => c.id === id)?.name ?? 'Cliente'
  const clientTo = (id: string) => {
    const c = get().clients.find((x) => x.id === id)
    return c ? `${c.name} · ${c.phone}` : 'Cliente'
  }
  const setItems = (ids: string[], patch: (i: RentalItem) => Partial<RentalItem>) =>
    set((s) => ({ rentalItems: s.rentalItems.map((i) => (ids.includes(i.id) ? { ...i, ...patch(i) } : i)) }))

  return {
    createReservation: ({ clientId, from, to, lines, channel, notes, depositMethod }) => {
      const today = todayISO()
      if (!lines.length) return { error: 'Agregá al menos una prenda o equipo.' }
      if (from < today) return { error: 'La fecha de retiro no puede ser anterior a hoy.' }
      if (to < from) return { error: 'La devolución tiene que ser posterior al retiro.' }
      const state = get()
      for (const l of lines) {
        const a = availability(state.rentalItems, state.reservations, l.type, l.size, from, to, today)
        if (a.available < l.qty) return { error: `No hay disponibilidad de ${l.type} talle ${l.size} para esas fechas: quedan ${a.available}.` }
      }
      const q = quoteRental(lines, from, to)
      const number = state.reservationSeq + 1
      const id = uid('rv-')
      // la seña se cobra al reservar, con comprobante
      const res = get().chargeService({
        lines: [{ name: `Seña reserva #${number} (${q.days} día${q.days > 1 ? 's' : ''})`, qty: 1, unitPrice: q.deposit }],
        payments: [{ method: depositMethod, amount: q.deposit }],
        receiptKind: 'B',
        clientId,
        source: 'alquiler',
        reservationId: id,
      })
      if (res.error) return { error: res.error }
      const r: Reservation = {
        id,
        number,
        clientId,
        from,
        to,
        lines,
        days: q.days,
        subtotal: q.subtotal,
        discountPct: q.discountPct,
        total: q.total,
        deposit: q.deposit,
        guarantee: q.guarantee,
        status: 'reservada',
        channel,
        createdAt: now(),
        itemIds: [],
        notes,
      }
      set((s) => ({ reservations: [r, ...s.reservations], reservationSeq: number }))
      h.message({
        businessId: 'alquiler',
        channel: 'WhatsApp',
        to: clientTo(clientId),
        subject: `Reserva #${number} confirmada`,
        body: `¡Listo! Tu reserva #${number} quedó confirmada del ${date(from)} al ${date(to)}. Seña recibida: ${money(q.deposit)}. Saldo al retirar: ${money(q.total - q.deposit)} + depósito en garantía de ${money(q.guarantee)} (reintegrable). Te esperamos.`,
      })
      h.audit('reserva', `Reserva #${number} de ${clientName(clientId)}: ${q.days} días, ${money(q.total)} · seña ${money(q.deposit)}`)
      h.enqueue(`Reserva #${number}`)
      h.notify(`Reserva #${number} confirmada y seña cobrada.`)
      return { reservation: r }
    },

    deliverReservation: (id, { itemIds, payMethod, guaranteeMethod, receiptKind }) => {
      const r = get().reservations.find((x) => x.id === id)
      if (!r || r.status !== 'reservada') return 'La reserva no está pendiente de entrega'
      if (r.from > todayISO()) return 'Todavía no es la fecha de retiro'
      if (!currentSession(get())) return 'Para entregar abrí una caja: se cobra el saldo y el depósito'
      const needed = r.lines.reduce((a, l) => a + l.qty, 0)
      if (itemIds.length !== needed) return `Asigná ${needed} unidades (hay ${itemIds.length})`
      const items = get().rentalItems.filter((i) => itemIds.includes(i.id))
      if (items.some((i) => i.state !== 'disponible')) return 'Hay unidades asignadas que no están disponibles'
      if (guaranteeMethod === 'tarjeta' && !h.isOnline()) return 'Sin conexión no se puede preautorizar la tarjeta: tomá el depósito en efectivo'
      const balance = r.total - r.deposit
      if (balance > 0) {
        const client = get().clients.find((c) => c.id === r.clientId)
        const res = get().chargeService({
          lines: [{ name: `Alquiler reserva #${r.number} · ${r.days} día${r.days > 1 ? 's' : ''} (saldo)`, qty: 1, unitPrice: balance }],
          payments: [{ method: payMethod, amount: balance }],
          receiptKind,
          clientId: r.clientId,
          customer: receiptKind === 'A' && client?.cuit ? { cuit: client.cuit, name: client.name, ivaCondition: client.ivaCondition, address: client.address } : undefined,
          source: 'alquiler',
          reservationId: r.id,
        })
        if (res.error) return res.error
      }
      if (guaranteeMethod === 'efectivo') get().addCashMovement('ingreso', r.guarantee, `Depósito en garantía reserva #${r.number}`)
      setItems(itemIds, () => ({ state: 'alquilado', stateSince: todayISO() }))
      set((s) => ({ reservations: s.reservations.map((x) => (x.id === id ? { ...x, status: 'entregada', deliveredAt: now(), itemIds, guaranteeMethod } : x)) }))
      h.audit('entrega', `Reserva #${r.number}: ${itemIds.length} unidades entregadas · garantía ${money(r.guarantee)} (${guaranteeMethod === 'tarjeta' ? 'preautorización' : 'efectivo'})`)
      h.enqueue(`Entrega reserva #${r.number}`)
      h.notify(`Reserva #${r.number} entregada.`)
      return null
    },

    returnReservation: (id, { inspections, payMethod }) => {
      const r = get().reservations.find((x) => x.id === id)
      if (!r || r.status !== 'entregada') return { error: 'La reserva no está entregada' }
      if (!currentSession(get())) return { error: 'Para recibir abrí una caja: puede haber cargos o devolución de depósito' }
      const today = todayISO()
      const late = lateFeeFor(r, today)
      const incidents: RentalIncident[] = []
      const lines: { name: string; qty: number; unitPrice: number }[] = []
      if (late) lines.push({ name: `Recargo por devolución tardía (${lateDays(r.to, today)} día${lateDays(r.to, today) > 1 ? 's' : ''}) · reserva #${r.number}`, qty: 1, unitPrice: late })
      for (const ins of inspections) {
        if (!ins.kind) continue
        const item = get().rentalItems.find((i) => i.id === ins.itemId)!
        const charge = damageCharge(ins.kind, item.value)
        incidents.push({ id: uid('inc-'), reservationId: r.id, itemId: item.id, kind: ins.kind, charge, at: now() })
        lines.push({ name: `${ins.kind[0].toUpperCase()}${ins.kind.slice(1)} · ${item.type} ${item.code}`, qty: 1, unitPrice: charge })
      }
      const extras = lines.reduce((a, l) => a + l.unitPrice, 0)
      const cashGuarantee = r.guaranteeMethod === 'efectivo'
      if (extras > 0) {
        // con depósito en efectivo los cargos se descuentan de lo que se devuelve
        const method = cashGuarantee ? 'efectivo' : payMethod
        if ((method === 'tarjeta' || method === 'qr') && !h.isOnline()) return { error: 'Sin conexión no se puede cobrar con tarjeta: elegí efectivo' }
        const res = get().chargeService({ lines, payments: [{ method, amount: extras }], receiptKind: 'B', clientId: r.clientId, source: 'alquiler', reservationId: r.id })
        if (res.error) return { error: res.error }
      }
      const refund = Math.max(0, r.guarantee - extras)
      if (cashGuarantee) get().addCashMovement('retiro', r.guarantee, `Devolución de depósito reserva #${r.number}${extras ? ` (se entregan ${money(refund)} y ${money(Math.min(extras, r.guarantee))} cubren cargos)` : ''}`)

      // estado de cada unidad según la revisión
      const nextState = (item: RentalItem, kind: RentalIncident['kind'] | null): RentalState => {
        if (kind === 'faltante') return 'baja'
        if (kind === 'daño grave') return 'dañado'
        if (kind === 'daño leve') return 'mantenimiento'
        if (kind === 'suciedad' || NEEDS_CLEANING.includes(item.type)) return 'limpieza'
        return 'disponible'
      }
      const kindById = new Map(inspections.map((i) => [i.itemId, i.kind]))
      setItems(r.itemIds, (i) => ({ state: nextState(i, kindById.get(i.id) ?? null), stateSince: today, uses: i.uses + 1, notes: kindById.get(i.id) ? `Devolución #${r.number}: ${kindById.get(i.id)}` : i.notes }))
      const damage = incidents.reduce((a, x) => a + x.charge, 0)
      set((s) => ({
        reservations: s.reservations.map((x) => (x.id === id ? { ...x, status: 'devuelta', returnedAt: now(), lateFee: late || undefined, damageFee: damage || undefined, guaranteeReturned: refund } : x)),
        incidents: [...incidents, ...s.incidents],
      }))
      h.audit('devolución', `Reserva #${r.number}: recargos ${money(late)}, daños ${money(damage)}, depósito devuelto ${money(cashGuarantee ? refund : r.guarantee)}`)
      h.enqueue(`Devolución reserva #${r.number}`)
      h.notify(`Reserva #${r.number} devuelta.`)
      return { extras, refund }
    },

    cancelReservation: (id, refundDeposit) => {
      const r = get().reservations.find((x) => x.id === id)
      if (!r || r.status !== 'reservada') return 'Solo se cancelan reservas pendientes'
      if (refundDeposit) {
        if (!currentSession(get())) return 'Para devolver la seña abrí una caja'
        get().addCashMovement('retiro', r.deposit, `Devolución de seña reserva #${r.number}`)
      }
      set((s) => ({ reservations: s.reservations.map((x) => (x.id === id ? { ...x, status: 'cancelada' } : x)) }))
      h.audit('reserva', `Reserva #${r.number} cancelada · seña ${refundDeposit ? 'devuelta' : 'retenida según política'}`)
      h.enqueue(`Cancelación reserva #${r.number}`)
      h.notify(`Reserva #${r.number} cancelada.`)
      return null
    },

    setItemState: (itemId, state, note) => {
      if (!can(h.me(), 'equipos.gestionar') && state !== 'disponible') return
      const it = get().rentalItems.find((i) => i.id === itemId)
      if (!it) return
      setItems([itemId], () => ({ state, stateSince: todayISO(), notes: note ?? it.notes, lastServiceAt: it.state === 'mantenimiento' && state === 'disponible' ? todayISO() : it.lastServiceAt }))
      h.audit('equipos', `${it.type} ${it.code} (${it.size})${note ? `: ${note}` : ''}`, it.state, state)
      h.enqueue(`Equipo ${it.code}: ${state}`)
      h.notify(`${it.type} ${it.code}: ahora ${state}.`)
    },
    finishCleaning: (itemIds) => {
      const ids = get().rentalItems.filter((i) => itemIds.includes(i.id) && i.state === 'limpieza').map((i) => i.id)
      if (!ids.length) return
      setItems(ids, () => ({ state: 'disponible', stateSince: todayISO(), notes: undefined }))
      h.audit('equipos', `${ids.length} prenda${ids.length > 1 ? 's' : ''} lista${ids.length > 1 ? 's' : ''} después de limpieza`, 'limpieza', 'disponible')
      h.enqueue(`Limpieza terminada (${ids.length})`)
      h.notify(`${ids.length} prenda${ids.length > 1 ? 's' : ''} lista${ids.length > 1 ? 's' : ''} para alquilar.`)
    },
  } satisfies Partial<Actions>
}
