// Asistente de consultas (A4) simulado: interpreta la pregunta por palabras clave y responde
// con datos reales del estado. Es de solo lectura y respeta los permisos del usuario.
// En producción la interpretación la haría un modelo de IA sobre las mismas consultas.
import type { State } from '../store/state'
import type { User } from '../types'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { can } from './permissions'
import { addDays, date, daysUntil, money, todayISO } from './format'
import { byHour, clientStats, kpis, rentalOccupancy, salesIn, topProducts } from './analytics'
import { clientBalance, formatQty, stockOf } from '../store/selectors'
import { lateFeeFor } from './rental'

export interface Answer {
  text: string
  table?: { headers: string[]; rows: (string | number)[][] }
  how: string
  denied?: boolean
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

function period(q: string): { days: number; label: string } {
  if (has(q, 'hoy')) return { days: 1, label: 'hoy' }
  if (has(q, 'ayer')) return { days: 2, label: 'ayer y hoy' }
  if (has(q, 'mes', '30')) return { days: 30, label: 'los últimos 30 días' }
  return { days: 7, label: 'los últimos 7 días' }
}

export const SUGGESTIONS: Record<string, string[]> = {
  retail: ['¿Cuánto vendimos hoy?', '¿Cuáles son los productos más vendidos del mes?', '¿Qué se vence esta semana?', '¿Qué hay que reponer?', '¿Cuál es la hora pico?', '¿Qué margen tuvimos este mes?'],
  hardware: ['¿Cuánto vendimos esta semana?', '¿Qué presupuestos siguen abiertos?', '¿Quiénes nos deben en cuenta corriente?', '¿Qué hay que reponer?', '¿Cuáles son los mejores clientes?', '¿Qué margen tuvimos este mes?'],
  rental: ['¿Qué reservas retiran mañana?', '¿Hay devoluciones atrasadas?', '¿Qué equipos tienen más ocupación?', '¿Cuánto cobramos esta semana?', '¿Cuáles son los mejores clientes?'],
  admin: ['Compará los negocios este mes'],
}

export function answer(question: string, state: State, me: User): Answer {
  const q = question.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const biz = state.businessId
  const name = businesses[biz].name
  const today = todayISO()

  // comparación entre negocios: solo quien tiene acceso al panel conjunto
  if (has(q, 'compar', 'todos los negocios', 'cada negocio', 'negocios')) {
    if (!can(me, 'panel.conjunto')) return { text: 'Solo el Administrador puede consultar datos de otros negocios.', how: 'El asistente usa los mismos permisos que tu usuario.', denied: true }
    const p = period(q)
    const rows = BUSINESS_IDS.map((b) => {
      const k = kpis(salesIn(state.sales, b, p.days), state.products)
      return [businesses[b].name, money(k.total), k.count, money(k.avg)]
    })
    return {
      text: `Así se comparan los cuatro negocios en ${p.label}:`,
      table: { headers: ['Negocio', 'Ventas', 'Tickets', 'Ticket promedio'], rows },
      how: `Sumé las ventas completadas de cada negocio (sin anuladas) en ${p.label}.`,
    }
  }

  if (has(q, 'margen', 'ganancia', 'rentab', 'costo')) {
    if (!can(me, 'costos.ver')) return { text: 'Tu usuario no tiene permiso para ver costos ni márgenes.', how: 'El asistente usa los mismos permisos que tu usuario (sección 06 de la propuesta).', denied: true }
    const p = period(q)
    const k = kpis(salesIn(state.sales, biz, p.days), state.products)
    return {
      text: `En ${p.label}, ${name} vendió ${money(k.total)} con un margen bruto de ${money(k.margin)} (${Math.round(k.marginPct)}%).`,
      how: 'Margen bruto = ventas − costo de la mercadería vendida, con el costo actual de cada producto. Los servicios no tienen costo cargado.',
    }
  }

  if (has(q, 'venc')) {
    const ids = new Set(state.products.filter((x) => x.businessId === biz).map((x) => x.id))
    const lots = state.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) <= 7).sort((a, b) => a.expiry!.localeCompare(b.expiry!))
    if (!lots.length) return { text: 'No hay lotes que venzan en los próximos 7 días.', how: 'Revisé los lotes con stock y fecha de vencimiento.' }
    return {
      text: `Hay ${lots.length} lotes vencidos o por vencer en los próximos 7 días:`,
      table: { headers: ['Producto', 'Lote', 'Vence', 'Unidades'], rows: lots.map((l) => [state.products.find((x) => x.id === l.productId)!.name, l.code, daysUntil(l.expiry!) < 0 ? `venció ${date(l.expiry!)}` : date(l.expiry!), l.qty]) },
      how: 'Lotes con stock y vencimiento dentro de 7 días. Sugerencia: aplicar la promo automática desde Oportunidades.',
    }
  }

  if (has(q, 'repon', 'stock', 'falta', 'pedir', 'minimo')) {
    const low = state.products.filter((x) => x.businessId === biz && stockOf(state.lots, x.id) <= x.minStock)
    if (!low.length) return { text: 'Todo el stock está por encima del mínimo.', how: 'Comparé el stock de cada producto con su stock mínimo.' }
    return {
      text: `Hay ${low.length} productos en o bajo el stock mínimo:`,
      table: { headers: ['Producto', 'Stock', 'Mínimo'], rows: low.slice(0, 12).map((x) => [x.name, formatQty(stockOf(state.lots, x.id), x.baseUnit), x.minStock]) },
      how: 'Stock actual contra stock mínimo. Desde Proveedores y compras se arman los pedidos sugeridos con un clic.',
    }
  }

  if (has(q, 'presupuesto')) {
    const open = state.quotes.filter((x) => x.businessId === biz && x.status === 'abierto' && x.validUntil >= today)
    if (!open.length) return { text: 'No hay presupuestos abiertos.', how: 'Presupuestos en estado abierto y dentro de su validez.' }
    return {
      text: `Hay ${open.length} presupuestos abiertos por ${money(open.reduce((a, x) => a + x.total, 0))}:`,
      table: { headers: ['N°', 'Cliente', 'Total', 'Vence'], rows: open.map((x) => [`#${x.number}`, x.clientName, money(x.total), date(x.validUntil)]) },
      how: 'Presupuestos en estado abierto y dentro de su validez.',
    }
  }

  if (has(q, 'deben', 'deuda', 'saldo', 'cuenta corriente', 'cobrar')) {
    const debtors = state.clients.filter((c) => c.businessId === biz && clientBalance(state.accounts, c.id) > 0).sort((a, b) => clientBalance(state.accounts, b.id) - clientBalance(state.accounts, a.id))
    if (!debtors.length) return { text: 'Ningún cliente tiene saldo pendiente.', how: 'Saldo = cargos − pagos de cuenta corriente.' }
    return {
      text: `${debtors.length} clientes tienen saldo por ${money(debtors.reduce((a, c) => a + clientBalance(state.accounts, c.id), 0))}:`,
      table: { headers: ['Cliente', 'Saldo', 'Límite'], rows: debtors.map((c) => [c.name, money(clientBalance(state.accounts, c.id)), money(c.creditLimit)]) },
      how: 'Saldo de cuenta corriente = cargos por ventas − pagos registrados.',
    }
  }

  if (has(q, 'reserva', 'retira', 'manana')) {
    const day = has(q, 'manana') ? addDays(1) : today
    const list = state.reservations.filter((r) => r.status === 'reservada' && r.from === day)
    return {
      text: list.length ? `${list.length} reservas retiran ${day === today ? 'hoy' : 'mañana'}:` : `No hay retiros ${day === today ? 'hoy' : 'mañana'}.`,
      table: list.length ? { headers: ['Reserva', 'Cliente', 'Días', 'Saldo a cobrar'], rows: list.map((r) => [`#${r.number}`, state.clients.find((c) => c.id === r.clientId)?.name ?? '', r.days, money(r.total - r.deposit)]) } : undefined,
      how: 'Reservas confirmadas con fecha de retiro en el día pedido.',
    }
  }

  if (has(q, 'atrasad', 'devol', 'demora')) {
    const late = state.reservations.filter((r) => r.status === 'entregada' && r.to < today)
    return {
      text: late.length ? `Hay ${late.length} devoluciones atrasadas:` : 'No hay devoluciones atrasadas.',
      table: late.length ? { headers: ['Reserva', 'Cliente', 'Debía volver', 'Recargo'], rows: late.map((r) => [`#${r.number}`, state.clients.find((c) => c.id === r.clientId)?.name ?? '', date(r.to), money(lateFeeFor(r, today))]) } : undefined,
      how: 'Reservas entregadas con fecha de devolución anterior a hoy. Recargo = tarifa diaria + 20% por día.',
    }
  }

  if (has(q, 'ocupa', 'equipo')) {
    const occ = rentalOccupancy(state, 120, 31).sort((a, b) => b.pct - a.pct)
    return {
      text: 'Ocupación por tipo de equipo en la temporada pasada (junio a septiembre):',
      table: { headers: ['Tipo', 'Unidades', 'Ocupación'], rows: occ.map((o) => [o.type, o.units, `${Math.round(o.pct)}%`]) },
      how: 'Días alquilados sobre días disponibles de cada tipo.',
    }
  }

  if (has(q, 'hora', 'pico', 'horario')) {
    const h = byHour(salesIn(state.sales, biz, 30))
    const best = h.reduce((a, x) => (x.total > a.total ? x : a), h[0])
    return { text: `La hora pico de ${name} es de ${best.hour} a ${best.hour + 1} h, con ${money(best.total)} vendidos en ese horario en los últimos 30 días.`, how: 'Ventas agrupadas por la hora de cada ticket.' }
  }

  if (has(q, 'mejores clientes', 'clientes', 'cliente')) {
    const top = state.clients
      .filter((c) => c.businessId === biz)
      .map((c) => ({ c, st: clientStats(state, c) }))
      .sort((a, b) => b.st.total - a.st.total)
      .slice(0, 6)
    return {
      text: `Los clientes que más facturan en ${name}:`,
      table: { headers: ['Cliente', 'Facturado', 'Visitas', 'Última visita'], rows: top.map(({ c, st }) => [c.name, money(st.total), st.visits, st.last ? date(st.last) : '—']) },
      how: 'Ventas y alquileres de cada cliente registrado.',
    }
  }

  if (has(q, 'mas vendid', 'top', 'mejores producto', 'producto')) {
    const p = period(q)
    const top = topProducts(salesIn(state.sales, biz, p.days), state.products, 8)
    return {
      text: `Los productos que más facturaron en ${p.label}:`,
      table: { headers: ['Producto', 'Unidades', 'Facturación'], rows: top.map((t) => [t.name, Math.round(t.qty), money(t.total)]) },
      how: `Suma de las ventas completadas de ${p.label}, por producto.`,
    }
  }

  if (has(q, 'vend', 'factur', 'cobr', 'ventas', 'cuanto')) {
    const p = period(q)
    const list = salesIn(state.sales, biz, p.days).filter((s) => can(me, 'caja.verTodas') || s.userId === me.id)
    const k = kpis(list, state.products)
    return {
      text: `${can(me, 'caja.verTodas') ? name : 'Vos'} ${p.days === 1 ? 'llevás' : 'sumó'} ${money(k.total)} en ${p.label}, en ${k.count} tickets (promedio ${money(k.avg)}).`,
      how: `Ventas completadas de ${p.label}${can(me, 'caja.verTodas') ? '' : ', solo las tuyas porque tu rol ve únicamente su caja'}.`,
    }
  }

  return {
    text: 'Todavía no sé responder eso. Probá con alguna de las preguntas sugeridas: ventas, productos, vencimientos, stock, clientes, cuentas corrientes, presupuestos o reservas.',
    how: 'En producción, un modelo de IA interpreta la pregunta libre y arma la consulta de solo lectura.',
  }
}
