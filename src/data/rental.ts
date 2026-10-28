// Inventario y reservas de ejemplo del alquiler de esquí y snowboard.
// Las fechas se arman alrededor de hoy para poder probar el recorrido completo.
import type { Client, RentalIncident, RentalItem, RentalType, Reservation, ReservationLine, Sale } from '../types'
import { addDays, todayISO } from '../lib/format'
import { RENTAL_TYPES, SIZES, quoteRental, suggestSize } from '../lib/rental'
import { rng } from './seed'

const UNITS_PER_SIZE: Record<RentalType, number> = {
  Esquí: 4,
  Bastones: 6,
  'Botas de esquí': 4,
  Snowboard: 3,
  'Botas de snowboard': 3,
  Casco: 6,
  Antiparras: 10,
  Campera: 5,
  Pantalón: 5,
  Guantes: 6,
}

const BRANDS: Record<RentalType, string[]> = {
  Esquí: ['Rossignol', 'Head', 'Atomic'],
  Bastones: ['Leki', 'Rossignol'],
  'Botas de esquí': ['Salomon', 'Nordica'],
  Snowboard: ['Burton', 'Nitro'],
  'Botas de snowboard': ['Burton', 'ThirtyTwo'],
  Casco: ['Smith', 'Giro'],
  Antiparras: ['Oakley', 'Smith'],
  Campera: ['Montagne', 'Columbia'],
  Pantalón: ['Montagne', 'Columbia'],
  Guantes: ['Montagne'],
}

const VALUE: Record<RentalType, number> = {
  Esquí: 520000,
  Bastones: 60000,
  'Botas de esquí': 310000,
  Snowboard: 580000,
  'Botas de snowboard': 290000,
  Casco: 120000,
  Antiparras: 95000,
  Campera: 180000,
  Pantalón: 150000,
  Guantes: 45000,
}

const PREFIX: Record<RentalType, string> = {
  Esquí: 'SK',
  Bastones: 'BA',
  'Botas de esquí': 'BE',
  Snowboard: 'SB',
  'Botas de snowboard': 'BS',
  Casco: 'CA',
  Antiparras: 'AN',
  Campera: 'CP',
  Pantalón: 'PA',
  Guantes: 'GU',
}

export function buildRental(clients: Client[]) {
  const rand = rng(77)
  const today = todayISO()
  const items: RentalItem[] = []
  for (const type of RENTAL_TYPES) {
    let n = 0
    for (const size of SIZES[type]) {
      for (let k = 0; k < UNITS_PER_SIZE[type]; k++) {
        n++
        const uses = Math.floor(5 + rand() * 60)
        items.push({
          id: `ri-${PREFIX[type]}-${n}`,
          code: `${PREFIX[type]}-${String(n).padStart(3, '0')}`,
          type,
          size,
          brand: BRANDS[type][n % BRANDS[type].length],
          condition: uses > 50 ? 'regular' : uses > 35 ? 'bueno' : uses > 15 ? 'muy bueno' : 'nuevo',
          state: 'disponible',
          uses,
          value: VALUE[type],
          lastServiceAt: addDays(-Math.floor(10 + rand() * 120)),
          stateSince: addDays(-3),
        })
      }
    }
  }

  const rentalClients = clients.filter((c) => c.businessId === 'alquiler')
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const personLines = (sizes?: Client['sizes']): ReservationLine[] => {
    const snow = rand() < 0.35
    const lines: ReservationLine[] = snow
      ? [
          { type: 'Snowboard', size: pick(SIZES.Snowboard), qty: 1 },
          { type: 'Botas de snowboard', size: pick(SIZES['Botas de snowboard']), qty: 1 },
        ]
      : [
          { type: 'Esquí', size: pick(SIZES['Esquí']), qty: 1 },
          { type: 'Bastones', size: pick(SIZES.Bastones), qty: 1 },
          { type: 'Botas de esquí', size: pick(SIZES['Botas de esquí']), qty: 1 },
        ]
    if (rand() < 0.6) lines.push({ type: 'Casco', size: pick(SIZES.Casco), qty: 1 })
    if (rand() < 0.5) lines.push({ type: 'Campera', size: pick(SIZES.Campera), qty: 1 }, { type: 'Pantalón', size: pick(SIZES['Pantalón']), qty: 1 })
    if (rand() < 0.4) lines.push({ type: 'Antiparras', size: 'Única', qty: 1 })
    if (rand() < 0.35) lines.push({ type: 'Guantes', size: pick(SIZES.Guantes), qty: 1 })
    // con datos del cliente, los talles salen de sus medidas guardadas
    return lines.map((l) => ({ ...l, size: suggestSize(l.type, sizes, l.size) }))
  }

  const reservations: Reservation[] = []
  const incidents: RentalIncident[] = []
  let number = 3100

  const make = (from: string, days: number, status: Reservation['status'], clientId: string, channel: Reservation['channel'], extra: Partial<Reservation> = {}) => {
    const to = addDays(days - 1, new Date(from + 'T12:00:00'))
    const people = rand() < 0.3 ? 2 : 1
    const lines: ReservationLine[] = []
    const sizes = rentalClients.find((c) => c.id === clientId)?.sizes
    for (let p = 0; p < people; p++)
      for (const l of personLines(p === 0 ? sizes : undefined)) {
        const same = lines.find((x) => x.type === l.type && x.size === l.size)
        if (same) same.qty++
        else lines.push({ ...l })
      }
    const q = quoteRental(lines, from, to)
    const r: Reservation = {
      id: `rv-${number}`,
      number: number++,
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
      status,
      channel,
      createdAt: addDays(-Math.floor(3 + rand() * 20), new Date(from + 'T12:00:00')),
      itemIds: [],
      seeded: true,
      ...extra,
    }
    reservations.push(r)
    return r
  }

  // historial: temporada de invierno (junio a septiembre) con mucho movimiento y semanas recientes más tranquilas
  for (let d = 150; d >= 3; d--) {
    const winter = d > 30
    // pico de julio (vacaciones de invierno)
    const peak = d > 85 && d < 115
    const count = winter ? 2 + Math.floor(rand() * (peak ? 6 : 3)) : rand() < 0.3 ? 1 : 0
    for (let k = 0; k < count; k++) {
      const from = addDays(-d)
      const len = Math.min(d - 1, 1 + Math.floor(rand() * 5))
      const r = make(from, len, 'devuelta', pick(rentalClients).id, pick(['mostrador', 'mostrador', 'whatsapp', 'web']))
      r.deliveredAt = from + 'T09:30:00'
      r.returnedAt = addDays(r.days - 1, new Date(from + 'T12:00:00')) + 'T18:10:00'
      r.guaranteeMethod = rand() < 0.6 ? 'tarjeta' : 'efectivo'
      r.guaranteeReturned = r.guarantee
      if (rand() < 0.1) r.lateFee = Math.round((r.total / r.days) * 1.2)
      if (rand() < 0.08) {
        const charge = 8000 + Math.floor(rand() * 4) * 15000
        r.damageFee = charge
        r.guaranteeReturned = Math.max(0, r.guarantee - charge)
        incidents.push({ id: `inc-${r.id}`, reservationId: r.id, itemId: '', kind: charge > 20000 ? 'daño leve' : 'suciedad', charge, at: r.returnedAt })
      }
    }
  }

  // situación actual para el recorrido del mostrador
  const take = (type: RentalType, size: string) => items.find((i) => i.type === type && i.size === size && i.state === 'disponible')
  const deliver = (r: Reservation) => {
    for (const l of r.lines)
      for (let k = 0; k < l.qty; k++) {
        const it = take(l.type, l.size)
        if (it) {
          it.state = 'alquilado'
          it.stateSince = r.from
          r.itemIds.push(it.id)
        }
      }
    r.deliveredAt = r.from + 'T09:15:00'
    r.guaranteeMethod = 'tarjeta'
  }

  const c = (i: number) => rentalClients[i % rentalClients.length].id
  // en curso, vuelven en los próximos días
  deliver(make(addDays(-2), 4, 'entregada', c(0), 'whatsapp'))
  deliver(make(addDays(-1), 3, 'entregada', c(5), 'mostrador'))
  // vuelven hoy
  deliver(make(addDays(-3), 4, 'entregada', c(1), 'mostrador'))
  deliver(make(addDays(-1), 2, 'entregada', c(9), 'web'))
  // atrasada: debía volver ayer
  deliver(make(addDays(-4), 4, 'entregada', c(4), 'whatsapp', { notes: 'No responde el teléfono desde ayer' }))
  // retiran hoy
  make(today, 3, 'reservada', c(2), 'web')
  make(today, 2, 'reservada', c(10), 'whatsapp')
  make(today, 5, 'reservada', c(6), 'mostrador', { notes: 'Convenio hotel: facturar a la empresa' })
  // próximas
  make(addDays(1), 3, 'reservada', c(7), 'web')
  make(addDays(2), 2, 'reservada', c(11), 'whatsapp')
  make(addDays(4), 5, 'reservada', c(3), 'mostrador', { notes: 'Viaje de egresados: 1 docente + alumnos, confirmar talles' })
  make(addDays(6), 3, 'reservada', c(8), 'web')
  make(addDays(9), 7, 'reservada', c(1), 'whatsapp')

  // estados del inventario: prendas en limpieza, equipos en revisión y uno dañado
  const set = (code: string, state: RentalItem['state'], days: number, notes?: string) => {
    const it = items.find((i) => i.code === code)
    if (it && it.state === 'disponible') {
      it.state = state
      it.stateSince = addDays(-days)
      it.notes = notes
    }
  }
  set('CP-004', 'limpieza', 1)
  set('CP-011', 'limpieza', 2)
  set('PA-006', 'limpieza', 1)
  set('GU-009', 'limpieza', 0)
  set('CA-002', 'limpieza', 1)
  set('SK-007', 'mantenimiento', 2, 'Encerado y afilado de cantos')
  set('SB-005', 'mantenimiento', 1, 'Revisar fijación trasera')
  set('BE-013', 'dañado', 4, 'Hebilla rota, presupuesto de repuesto pendiente')

  return { items, reservations, incidents, reservationSeq: number }
}

/** cobros históricos de las reservas (seña + saldo + recargos), para reportes y caja */
export function rentalSales(reservations: Reservation[], startNumber: number): Sale[] {
  const rand = rng(91)
  const out: Sale[] = []
  let n = startNumber
  const limit = addDays(-30)
  for (const r of reservations) {
    if (!r.seeded || r.status === 'reservada' || r.from < limit) continue
    const extras = (r.lateFee ?? 0) + (r.damageFee ?? 0)
    const parts: [string, number, string][] = [
      [`Seña reserva #${r.number}`, r.deposit, r.createdAt],
      [`Alquiler reserva #${r.number} · ${r.days} días (saldo)`, r.total - r.deposit, r.from],
    ]
    if (r.status === 'devuelta' && extras) parts.push([`Recargos y daños reserva #${r.number}`, extras, r.to])
    for (const [name, amount, day] of parts) {
      if (amount <= 0 || day > todayISO()) continue
      n++
      const at = new Date(day + 'T12:00:00')
      at.setHours(9 + Math.floor(rand() * 9), Math.floor(rand() * 60))
      const r1 = rand()
      const method = r1 < 0.35 ? 'efectivo' : r1 < 0.6 ? 'transferencia' : r1 < 0.9 ? 'tarjeta' : 'qr'
      out.push({
        id: `s-hist-alq-r-${n}`,
        number: n,
        businessId: 'alquiler',
        sessionId: 'hist',
        userId: rand() < 0.5 ? 'u-nico' : 'u-juli',
        at: at.toISOString(),
        items: [{ name, qty: 1, unitPrice: amount, allocations: [] }],
        subtotal: amount,
        discountPct: 0,
        total: amount,
        payments: [{ method, amount }],
        receiptKind: 'B',
        clientId: r.clientId,
        status: 'completada',
        createdOffline: false,
        source: 'alquiler',
        reservationId: r.id,
        seeded: true,
      })
    }
  }
  return out
}
