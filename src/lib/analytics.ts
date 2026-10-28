// Indicadores, reportes y oportunidades de venta. Funciones puras sobre el estado.
import type { BusinessId, Client, Product, RentalType, Sale } from '../types'
import type { State } from '../store/state'
import { clientBalance, oldestDebtDays, saleCost, stockOf } from '../store/selectors'
import { addDays, daysUntil, todayISO, toISODate } from './format'
import { DAILY_RATE, RENTAL_TYPES, lateFeeFor } from './rental'

export const dayKey = (iso: string) => toISODate(new Date(iso))

export function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => addDays(-(n - 1 - i)))
}

export function salesIn(sales: Sale[], biz: BusinessId | null, days: number) {
  const from = addDays(-(days - 1))
  return sales.filter((s) => (!biz || s.businessId === biz) && s.status === 'completada' && dayKey(s.at) >= from)
}

export function kpis(sales: Sale[], products: Product[]) {
  const cost = new Map(products.map((p) => [p.id, p.cost]))
  const total = sales.reduce((a, s) => a + s.total, 0)
  const cogs = sales.reduce((a, s) => a + saleCost(s, cost), 0)
  return { total, count: sales.length, avg: sales.length ? total / sales.length : 0, margin: total - cogs, marginPct: total ? ((total - cogs) / total) * 100 : 0 }
}

export function byDay(sales: Sale[], days: number) {
  return lastDays(days).map((d) => {
    const list = sales.filter((s) => dayKey(s.at) === d)
    return { day: d, total: list.reduce((a, s) => a + s.total, 0), count: list.length }
  })
}

export function topProducts(sales: Sale[], products: Product[], n = 8) {
  const m = new Map<string, { name: string; qty: number; total: number; category: string }>()
  for (const s of sales)
    for (const i of s.items) {
      if (!i.productId) continue
      const p = products.find((x) => x.id === i.productId)
      const prev = m.get(i.productId) ?? { name: p?.name ?? i.name, qty: 0, total: 0, category: p?.category ?? '' }
      m.set(i.productId, { ...prev, qty: prev.qty + i.qty * (i.factor ?? 1), total: prev.total + i.qty * i.unitPrice })
    }
  return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.total - a.total).slice(0, n)
}

export function byCategory(sales: Sale[], products: Product[]) {
  const cat = new Map(products.map((p) => [p.id, p.category]))
  const m = new Map<string, number>()
  for (const s of sales)
    for (const i of s.items) {
      const c = i.productId ? cat.get(i.productId) ?? 'Otros' : 'Servicios y alquileres'
      m.set(c, (m.get(c) ?? 0) + i.qty * i.unitPrice * (1 - s.discountPct / 100))
    }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

export function byPayment(sales: Sale[]) {
  const m = new Map<string, number>()
  for (const s of sales) for (const p of s.payments) m.set(p.method, (m.get(p.method) ?? 0) + p.amount)
  return [...m.entries()].map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value)
}

export function byHour(sales: Sale[]) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, count: 0 }))
  for (const s of sales) {
    const h = new Date(s.at).getHours()
    hours[h].total += s.total
    hours[h].count++
  }
  return hours
}

export function bySeller(sales: Sale[], users: State['users']) {
  const m = new Map<string, { total: number; count: number }>()
  for (const s of sales) {
    const prev = m.get(s.userId) ?? { total: 0, count: 0 }
    m.set(s.userId, { total: prev.total + s.total, count: prev.count + 1 })
  }
  return [...m.entries()].map(([id, v]) => ({ name: users.find((u) => u.id === id)?.name ?? id, ...v })).sort((a, b) => b.total - a.total)
}

/** productos que se compran juntos con más frecuencia (para armar combos) */
export function frequentPairs(sales: Sale[], products: Product[], n = 3) {
  const m = new Map<string, number>()
  for (const s of sales) {
    const ids = [...new Set(s.items.map((i) => i.productId).filter(Boolean) as string[])].sort()
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) m.set(`${ids[a]}|${ids[b]}`, (m.get(`${ids[a]}|${ids[b]}`) ?? 0) + 1)
  }
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, count]) => {
      const [a, b] = k.split('|')
      return { a: products.find((p) => p.id === a)!, b: products.find((p) => p.id === b)!, count }
    })
}

/** productos con stock que casi no salieron en el período */
export function slowMovers(state: State, biz: BusinessId, days = 30) {
  const sold = new Map<string, number>()
  for (const s of salesIn(state.sales, biz, days)) for (const i of s.items) if (i.productId) sold.set(i.productId, (sold.get(i.productId) ?? 0) + i.qty * (i.factor ?? 1))
  return state.products
    .filter((p) => p.businessId === biz)
    .map((p) => ({ p, stock: stockOf(state.lots, p.id), sold: sold.get(p.id) ?? 0 }))
    .filter((x) => x.stock > 0 && x.sold <= Math.max(1, x.stock * 0.15))
    .sort((a, b) => b.stock * b.p.cost - a.stock * a.p.cost)
}

export function clientStats(state: State, c: Client) {
  const sales = state.sales.filter((s) => s.clientId === c.id && s.status === 'completada')
  const total = sales.reduce((a, s) => a + s.total, 0)
  const last = sales.reduce((a, s) => (s.at > a ? s.at : a), '')
  const reservations = state.reservations.filter((r) => r.clientId === c.id && r.status !== 'cancelada')
  const rentalTotal = reservations.reduce((a, r) => a + r.total + (r.lateFee ?? 0) + (r.damageFee ?? 0), 0)
  const lastRental = reservations.reduce((a, r) => (r.from > a ? r.from : a), '')
  return {
    sales,
    total: c.businessId === 'alquiler' ? rentalTotal + total : total,
    visits: sales.length + reservations.length,
    avg: sales.length ? total / sales.length : 0,
    last: [last.slice(0, 10), lastRental].sort().pop() || '',
    balance: clientBalance(state.accounts, c.id),
    debtDays: oldestDebtDays(state.accounts, c.id),
    reservations,
  }
}

// ───────── Alquiler ─────────

/** ocupación por tipo: días alquilados / días disponibles en el período */
export function rentalOccupancy(state: State, days: number, offset = 0) {
  const from = addDays(-(offset + days - 1))
  const to = addDays(-offset)
  return RENTAL_TYPES.map((type) => {
    const units = state.rentalItems.filter((i) => i.type === type && i.state !== 'baja').length
    let used = 0
    for (const r of state.reservations) {
      if (r.status === 'cancelada' || r.status === 'reservada') continue
      const a = r.from > from ? r.from : from
      const b = r.to < to ? r.to : to
      if (a > b) continue
      const span = Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000) + 1
      used += span * r.lines.filter((l) => l.type === type).reduce((x, l) => x + l.qty, 0)
    }
    return { type, units, pct: units ? Math.min(100, (used / (units * days)) * 100) : 0, revenue: used * DAILY_RATE[type] }
  })
}

export function rentalRevenue(state: State, days: number, offset = 0) {
  const from = addDays(-(offset + days - 1))
  const to = addDays(-offset)
  const list = state.reservations.filter((r) => r.status !== 'cancelada' && r.from >= from && r.from <= to)
  return {
    count: list.length,
    rentals: list.reduce((a, r) => a + r.total, 0),
    late: list.reduce((a, r) => a + (r.lateFee ?? 0), 0),
    damage: list.reduce((a, r) => a + (r.damageFee ?? 0), 0),
    byChannel: (['mostrador', 'whatsapp', 'web'] as const).map((ch) => ({ label: ch, value: list.filter((r) => r.channel === ch).length })),
  }
}

// ───────── Oportunidades ─────────

export interface Opportunity {
  id: string
  kind: 'clientes' | 'stock' | 'presupuestos' | 'cobranza' | 'combo' | 'temporada' | 'upsell'
  title: string
  detail: string
  /** monto estimado en juego */
  value: number
  count: number
  action?: { label: string; run: 'promo-vencimiento' | 'promo-lenta' | 'cupon-inactivos' | 'seguimiento' | 'recordatorio-saldo' | 'preventa' | 'upsell-casco' }
  targets: string[]
}

export function opportunities(state: State, biz: BusinessId): Opportunity[] {
  const out: Opportunity[] = []
  const today = todayISO()
  const limit = Date.now() - 30 * 86400000
  const kind = biz === 'alquiler' ? 'rental' : biz === 'ferreteria' ? 'hardware' : 'retail'

  // clientes que dejaron de venir
  const clients = state.clients.filter((c) => c.businessId === biz)
  const inactive = clients.filter((c) => {
    const last = Math.max(0, ...state.sales.filter((s) => s.clientId === c.id).map((s) => new Date(s.at).getTime()), ...state.reservations.filter((r) => r.clientId === c.id).map((r) => new Date(r.from).getTime()))
    return last < limit && new Date(c.createdAt).getTime() < limit
  })
  if (inactive.length && kind !== 'rental')
    out.push({
      id: 'inactivos',
      kind: 'clientes',
      title: `${inactive.length} cliente${inactive.length > 1 ? 's' : ''} sin comprar hace más de 30 días`,
      detail: inactive.map((c) => c.name).join(', '),
      value: inactive.length * kpis(salesIn(state.sales, biz, 30), state.products).avg,
      count: inactive.length,
      action: { label: 'Enviar cupón de 10%', run: 'cupon-inactivos' },
      targets: inactive.map((c) => c.id),
    })

  // cobranza pendiente
  const debtors = clients.filter((c) => clientBalance(state.accounts, c.id) > 0)
  const debt = debtors.reduce((a, c) => a + clientBalance(state.accounts, c.id), 0)
  if (debtors.length)
    out.push({
      id: 'cobranza',
      kind: 'cobranza',
      title: `${debtors.length} cuenta${debtors.length > 1 ? 's' : ''} corriente${debtors.length > 1 ? 's' : ''} con saldo a cobrar`,
      detail: debtors
        .sort((a, b) => clientBalance(state.accounts, b.id) - clientBalance(state.accounts, a.id))
        .slice(0, 4)
        .map((c) => c.name)
        .join(', '),
      value: debt,
      count: debtors.length,
      action: { label: 'Enviar recordatorio de saldo', run: 'recordatorio-saldo' },
      targets: debtors.map((c) => c.id),
    })

  if (kind === 'retail') {
    const ids = new Set(state.products.filter((p) => p.businessId === biz).map((p) => p.id))
    const expiring = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) >= 0 && daysUntil(l.expiry) <= 4)
    const promoIds = [...new Set(expiring.map((l) => l.productId))].filter((id) => {
      const p = state.products.find((x) => x.id === id)!
      return !(p.promoUntil && p.promoUntil >= today)
    })
    if (promoIds.length)
      out.push({
        id: 'vencimientos',
        kind: 'stock',
        title: `${promoIds.length} producto${promoIds.length > 1 ? 's' : ''} por vencer: liquidar antes de perderlos`,
        detail: promoIds.map((id) => state.products.find((p) => p.id === id)!.name).join(', '),
        value: expiring.filter((l) => promoIds.includes(l.productId)).reduce((a, l) => a + l.qty * state.products.find((p) => p.id === l.productId)!.cost, 0),
        count: promoIds.length,
        action: { label: 'Aplicar 20% off por 4 días', run: 'promo-vencimiento' },
        targets: promoIds,
      })
  }

  if (kind !== 'rental') {
    const slow = slowMovers(state, biz).slice(0, 6)
    if (slow.length)
      out.push({
        id: 'lentos',
        kind: 'stock',
        title: `${slow.length} productos con stock inmovilizado`,
        detail: slow.map((x) => `${x.p.name} (${x.stock} en stock, ${x.sold} vendidos en 30 días)`).join(' · '),
        value: slow.reduce((a, x) => a + x.stock * x.p.cost, 0),
        count: slow.length,
        action: { label: 'Promoción 15% por 7 días', run: 'promo-lenta' },
        targets: slow.map((x) => x.p.id),
      })
    const pairs = frequentPairs(salesIn(state.sales, biz, 30), state.products, 2).filter((x) => x.count >= 3)
    for (const [i, pair] of pairs.entries())
      out.push({
        id: `combo-${i}`,
        kind: 'combo',
        title: `Combo sugerido: ${pair.a.name} + ${pair.b.name}`,
        detail: `Se compraron juntos ${pair.count} veces en 30 días. Ubicarlos cerca o armar un precio de combo puede subir el ticket promedio.`,
        value: (pair.a.price + pair.b.price) * pair.count * 0.1,
        count: pair.count,
        targets: [pair.a.id, pair.b.id],
      })
  }

  if (kind === 'hardware') {
    const open = state.quotes.filter((q) => q.businessId === biz && q.status === 'abierto')
    if (open.length)
      out.push({
        id: 'presupuestos',
        kind: 'presupuestos',
        title: `${open.length} presupuestos abiertos por cerrar`,
        detail: open.map((q) => `#${q.number} ${q.clientName}`).join(' · '),
        value: open.reduce((a, q) => a + q.total, 0),
        count: open.length,
        action: { label: 'Enviar seguimiento a todos', run: 'seguimiento' },
        targets: open.map((q) => q.id),
      })
  }

  if (kind === 'rental') {
    const upcoming = new Set(state.reservations.filter((r) => r.status === 'reservada').map((r) => r.clientId))
    const lastSeason = clients.filter((c) => c.tags.includes('temporada pasada') && !upcoming.has(c.id))
    if (lastSeason.length)
      out.push({
        id: 'preventa',
        kind: 'temporada',
        title: `${lastSeason.length} clientes de la temporada pasada sin reserva`,
        detail: lastSeason.map((c) => c.name).join(', '),
        value: lastSeason.length * 160000,
        count: lastSeason.length,
        action: { label: 'Invitar a la preventa (10% off)', run: 'preventa' },
        targets: lastSeason.map((c) => c.id),
      })
    const noHelmet = state.reservations.filter((r) => r.status === 'reservada' && r.lines.some((l) => l.type === 'Esquí' || l.type === 'Snowboard') && !r.lines.some((l) => l.type === 'Casco'))
    if (noHelmet.length)
      out.push({
        id: 'casco',
        kind: 'upsell',
        title: `${noHelmet.length} reservas sin casco`,
        detail: `Ofrecer casco (${DAILY_RATE.Casco.toLocaleString('es-AR')} por día) a ${noHelmet.map((r) => `#${r.number}`).join(', ')}. Suma seguridad y facturación.`,
        value: noHelmet.reduce((a, r) => a + DAILY_RATE.Casco * r.days, 0),
        count: noHelmet.length,
        action: { label: 'Ofrecer casco por WhatsApp', run: 'upsell-casco' },
        targets: noHelmet.map((r) => r.id),
      })
    const late = state.reservations.filter((r) => r.status === 'entregada' && r.to < today)
    if (late.length)
      out.push({
        id: 'demoras',
        kind: 'cobranza',
        title: `${late.length} devolución${late.length > 1 ? 'es' : ''} atrasada${late.length > 1 ? 's' : ''} con recargo`,
        detail: late.map((r) => `#${r.number}`).join(', '),
        value: late.reduce((a, r) => a + lateFeeFor(r, today), 0),
        count: late.length,
        targets: late.map((r) => r.id),
      })
  }
  return out.sort((a, b) => b.value - a.value)
}

export const rentalTypeOrder = (t: RentalType) => RENTAL_TYPES.indexOf(t)

/** variación comparando solo días completos: los últimos n días sin hoy contra los n anteriores */
export function periodChange(sales: Sale[], biz: BusinessId | null, n: number) {
  const sum = (from: string, to: string) =>
    sales.filter((s) => (!biz || s.businessId === biz) && s.status === 'completada' && dayKey(s.at) >= from && dayKey(s.at) <= to).reduce((a, s) => a + s.total, 0)
  const cur = sum(addDays(-n), addDays(-1))
  const prev = sum(addDays(-2 * n), addDays(-n - 1))
  return { cur, prev, pct: prev ? ((cur - prev) / prev) * 100 : null }
}
