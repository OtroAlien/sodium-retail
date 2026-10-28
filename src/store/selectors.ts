// Cálculos puros sobre el estado. No modifican nada.
import type { AccountEntry, BusinessId, CashSession, Lot, Product, Sale, SaleUnit, SupplierEntry } from '../types'
import { daysUntil, todayISO } from '../lib/format'
import { businesses } from '../data/seed'

export const kindOf = (b: BusinessId) => businesses[b].kind

/** lotes vendibles de un producto, en orden de vencimiento más próximo (M2-R1) */
export function sellableLots(lots: Lot[], productId: string) {
  return lots
    .filter((l) => l.productId === productId && l.qty > 0 && (l.expiry === null || daysUntil(l.expiry) >= 0))
    .sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))
}

export const stockOf = (lots: Lot[], productId: string) => lots.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0)

export const sellableStockOf = (lots: Lot[], productId: string) => sellableLots(lots, productId).reduce((a, l) => a + l.qty, 0)

/** precio vigente: promoción si corresponde */
export function priceOf(p: Product) {
  return p.promoPrice && p.promoUntil && p.promoUntil >= todayISO() ? p.promoPrice : p.price
}

export const hasPromo = (p: Product) => priceOf(p) !== p.price

/** unidad de venta elegida; la base usa el precio vigente del producto */
export function unitOf(p: Product, unitId?: string): SaleUnit {
  const base: SaleUnit = { id: 'base', label: p.units?.[0]?.label ?? 'Unidad', factor: 1, price: priceOf(p) }
  if (!unitId || unitId === 'base') return base
  return p.units?.find((u) => u.id === unitId) ?? base
}

export function formatQty(q: number, unit?: string) {
  const n = Number.isInteger(q) ? String(q) : q.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return unit && unit !== 'u' ? `${n} ${unit}` : n
}

export function sessionTotals(session: CashSession, sales: Sale[]) {
  const own = sales.filter((s) => s.sessionId === session.id && s.status === 'completada')
  const by = (m: string) => own.reduce((a, s) => a + s.payments.filter((p) => p.method === m).reduce((x, p) => x + p.amount, 0), 0)
  const cash = by('efectivo')
  const ins = session.movements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0)
  const outs = session.movements.filter((m) => m.type === 'retiro').reduce((a, m) => a + m.amount, 0)
  const voided = sales.filter((s) => s.sessionId === session.id && s.status === 'anulada').length
  return {
    count: own.length,
    cash,
    transfer: by('transferencia'),
    card: by('tarjeta'),
    qr: by('qr'),
    account: by('cuenta_corriente'),
    ins,
    outs,
    voided,
    expected: session.openingAmount + cash + ins - outs,
  }
}

export function currentSession(s: { sessions: CashSession[]; currentUserId: string | null; businessId: BusinessId }) {
  return s.sessions.find((x) => x.userId === s.currentUserId && x.businessId === s.businessId && !x.closedAt)
}

/** saldo de cuenta corriente de un cliente: positivo = nos debe */
export const clientBalance = (accounts: AccountEntry[], clientId: string) =>
  accounts.filter((a) => a.clientId === clientId).reduce((a, e) => a + (e.type === 'cargo' ? e.amount : -e.amount), 0)

/** saldo con un proveedor: positivo = le debemos */
export const supplierBalance = (entries: SupplierEntry[], supplierId: string) =>
  entries.filter((a) => a.supplierId === supplierId).reduce((a, e) => a + (e.type === 'compra' ? e.amount : -e.amount), 0)

/** días desde el cargo impago más viejo (aproximado: primer cargo posterior al último saldo cero) */
export function oldestDebtDays(accounts: AccountEntry[], clientId: string) {
  const list = accounts.filter((a) => a.clientId === clientId).sort((a, b) => a.at.localeCompare(b.at))
  let bal = 0
  let since: string | null = null
  for (const e of list) {
    bal += e.type === 'cargo' ? e.amount : -e.amount
    if (bal > 0 && !since) since = e.at
    if (bal <= 0) since = null
  }
  return since ? Math.floor((Date.now() - new Date(since).getTime()) / 86400000) : 0
}

/** costo de la mercadería vendida (los servicios no tienen costo) */
export const saleCost = (s: Sale, costById: Map<string, number>) =>
  s.items.reduce((a, i) => a + (i.productId ? i.qty * (i.factor ?? 1) * (costById.get(i.productId) ?? 0) : 0), 0)
