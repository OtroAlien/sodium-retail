// Reglas del alquiler de esquí y snowboard: tarifas, garantías, recargos y disponibilidad.
// Los valores son de ejemplo y se ajustan con el cliente.
import type { RentalItem, RentalType, Reservation, ReservationLine } from '../types'
import { addDays } from './format'

export const RENTAL_TYPES: RentalType[] = ['Esquí', 'Bastones', 'Botas de esquí', 'Snowboard', 'Botas de snowboard', 'Casco', 'Antiparras', 'Campera', 'Pantalón', 'Guantes']

export const SIZES: Record<RentalType, string[]> = {
  Esquí: ['140 cm', '150 cm', '160 cm', '170 cm', '180 cm'],
  Bastones: ['110 cm', '120 cm', '130 cm'],
  'Botas de esquí': ['36', '38', '40', '42', '44'],
  Snowboard: ['145 cm', '150 cm', '155 cm', '160 cm'],
  'Botas de snowboard': ['37', '39', '41', '43'],
  Casco: ['S', 'M', 'L'],
  Antiparras: ['Única'],
  Campera: ['S', 'M', 'L', 'XL'],
  Pantalón: ['S', 'M', 'L', 'XL'],
  Guantes: ['S', 'M', 'L'],
}

/** tarifa por día de cada prenda o equipo */
export const DAILY_RATE: Record<RentalType, number> = {
  Esquí: 18000,
  Bastones: 3000,
  'Botas de esquí': 12000,
  Snowboard: 20000,
  'Botas de snowboard': 12000,
  Casco: 6000,
  Antiparras: 5000,
  Campera: 10000,
  Pantalón: 9000,
  Guantes: 4000,
}

/** depósito en garantía por unidad, que se devuelve al recibir en buen estado */
export const GUARANTEE: Record<RentalType, number> = {
  Esquí: 60000,
  Bastones: 10000,
  'Botas de esquí': 40000,
  Snowboard: 70000,
  'Botas de snowboard': 40000,
  Casco: 20000,
  Antiparras: 15000,
  Campera: 30000,
  Pantalón: 25000,
  Guantes: 8000,
}

/** prendas que pasan por limpieza al volver; los equipos pasan por revisión solo si hay daño */
export const NEEDS_CLEANING: RentalType[] = ['Campera', 'Pantalón', 'Guantes', 'Casco', 'Botas de esquí', 'Botas de snowboard']

export const POLICY = {
  /** porcentaje de seña al reservar */
  depositPct: 30,
  /** recargo por día de demora, sobre la tarifa diaria */
  lateSurchargePct: 20,
  /** descuento por cantidad de días */
  dayDiscounts: [
    { minDays: 5, pct: 15 },
    { minDays: 3, pct: 10 },
  ],
  cleaningFee: 8000,
}

export const PACKS: { name: string; lines: ReservationLine[] }[] = [
  {
    name: 'Equipo completo de esquí',
    lines: [
      { type: 'Esquí', size: '160 cm', qty: 1 },
      { type: 'Bastones', size: '120 cm', qty: 1 },
      { type: 'Botas de esquí', size: '40', qty: 1 },
      { type: 'Casco', size: 'M', qty: 1 },
    ],
  },
  {
    name: 'Equipo completo de snowboard',
    lines: [
      { type: 'Snowboard', size: '155 cm', qty: 1 },
      { type: 'Botas de snowboard', size: '41', qty: 1 },
      { type: 'Casco', size: 'M', qty: 1 },
    ],
  },
  {
    name: 'Ropa de nieve',
    lines: [
      { type: 'Campera', size: 'M', qty: 1 },
      { type: 'Pantalón', size: 'M', qty: 1 },
      { type: 'Guantes', size: 'M', qty: 1 },
      { type: 'Antiparras', size: 'Única', qty: 1 },
    ],
  },
]

export const daysBetween = (from: string, to: string) =>
  Math.max(1, Math.round((new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 86400000) + 1)

export const dayDiscount = (days: number) => POLICY.dayDiscounts.find((d) => days >= d.minDays)?.pct ?? 0

export function quoteRental(lines: ReservationLine[], from: string, to: string) {
  const days = daysBetween(from, to)
  const perDay = lines.reduce((a, l) => a + DAILY_RATE[l.type] * l.qty, 0)
  const subtotal = perDay * days
  const discountPct = dayDiscount(days)
  const total = Math.round(subtotal * (1 - discountPct / 100))
  const guarantee = lines.reduce((a, l) => a + GUARANTEE[l.type] * l.qty, 0)
  const deposit = Math.round((total * POLICY.depositPct) / 100 / 100) * 100
  return { days, perDay, subtotal, discountPct, total, guarantee, deposit }
}

/** las fechas de una reserva, ambas inclusive */
const overlaps = (r: Reservation, from: string, to: string) => r.from <= to && r.to >= from

/** reservas que ocupan equipos en un rango (incluye entregadas atrasadas, que siguen afuera) */
export function activeReservations(reservations: Reservation[], from: string, to: string, today: string) {
  return reservations.filter(
    // una entrega atrasada sigue ocupando el equipo hasta hoy
    (r) => (r.status === 'reservada' && overlaps(r, from, to)) || (r.status === 'entregada' && (overlaps(r, from, to) || (r.to < today && from <= today))),
  )
}

/** unidades disponibles de un tipo y talle para todo un rango de fechas */
export function availability(items: RentalItem[], reservations: Reservation[], type: RentalType, size: string, from: string, to: string, today: string, excludeId?: string) {
  const pool = items.filter((i) => i.type === type && i.size === size && i.state !== 'baja' && i.state !== 'dañado')
  const total = pool.length
  // para hoy solo cuentan las unidades listas; para fechas futuras, también las que están en limpieza o revisión
  const notReadyToday = from <= today ? pool.filter((i) => i.state === 'limpieza' || i.state === 'mantenimiento').length : 0
  let worst = 0
  for (let d = from; d <= to; d = addDays(1, new Date(d + 'T12:00:00'))) {
    const used = activeReservations(reservations, d, d, today)
      .filter((r) => r.id !== excludeId)
      .reduce((a, r) => a + r.lines.filter((l) => l.type === type && l.size === size).reduce((x, l) => x + l.qty, 0), 0)
    worst = Math.max(worst, used)
  }
  return { total, available: Math.max(0, total - worst - notReadyToday) }
}

export function lateDays(to: string, today: string) {
  return Math.max(0, daysBetween(to, today) - 1)
}

export function lateFeeFor(r: Reservation, today: string) {
  const late = lateDays(r.to, today)
  if (!late) return 0
  const perDay = r.lines.reduce((a, l) => a + DAILY_RATE[l.type] * l.qty, 0)
  return Math.round(perDay * late * (1 + POLICY.lateSurchargePct / 100))
}

export function damageCharge(kind: 'suciedad' | 'daño leve' | 'daño grave' | 'faltante', value: number) {
  if (kind === 'suciedad') return POLICY.cleaningFee
  if (kind === 'daño leve') return Math.round(value * 0.15)
  if (kind === 'daño grave') return Math.round(value * 0.5)
  return value
}

/** talle sugerido según los datos guardados del cliente (calzado, altura y ropa) */
export function suggestSize(type: RentalType, sizes: { calzado?: string; altura?: number; ropa?: string } | undefined, fallback: string) {
  if (!sizes) return fallback
  const opts = SIZES[type]
  const nearest = (target: number) => opts.reduce((best, o) => (Math.abs(parseInt(o) - target) < Math.abs(parseInt(best) - target) ? o : best), opts[0])
  if ((type === 'Botas de esquí' || type === 'Botas de snowboard') && sizes.calzado) return nearest(Number(sizes.calzado))
  if ((type === 'Esquí' || type === 'Snowboard') && sizes.altura) return nearest(type === 'Esquí' ? sizes.altura - 12 : sizes.altura - 22)
  if (type === 'Bastones' && sizes.altura) return nearest(Math.round(sizes.altura * 0.7))
  if ((type === 'Campera' || type === 'Pantalón' || type === 'Casco' || type === 'Guantes') && sizes.ropa) {
    if (opts.includes(sizes.ropa)) return sizes.ropa
    return sizes.ropa === 'XL' ? 'L' : fallback
  }
  return fallback
}
