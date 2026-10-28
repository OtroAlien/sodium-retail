// Proveedores y compras (add-on A1): órdenes, recepción, costos, cuenta corriente y reposición.
import type { Lot, PurchaseLine, PurchaseOrder } from '../types'
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { addDays, formatCuit, money, uid } from '../lib/format'
import { can } from '../lib/permissions'
import { currentSession, formatQty, stockOf, supplierBalance } from './selectors'

export function purchasingSlice(set: SetState, get: GetState, h: Helpers) {
  const orderText = (o: PurchaseOrder) =>
    o.lines
      .map((l) => {
        const p = get().products.find((x) => x.id === l.productId)
        return `• ${formatQty(l.qty, p?.baseUnit)} × ${p?.name ?? l.productId}`
      })
      .join('\n')

  return {
    createOrder: (supplierId, lines, status, auto) => {
      const number = get().poSeq + 1
      const order: PurchaseOrder = {
        id: uid('po-'),
        number,
        businessId: get().businessId,
        supplierId,
        at: now(),
        lines,
        total: lines.reduce((a, l) => a + l.qty * l.cost, 0),
        status,
        auto,
        userId: get().currentUserId ?? 'sistema',
      }
      set((s) => ({ orders: [order, ...s.orders], poSeq: number }))
      const sup = get().suppliers.find((s) => s.id === supplierId)
      h.audit('compra', `${auto ? 'Orden sugerida' : 'Orden de compra'} #${number} a ${sup?.name} por ${money(order.total)}`)
      h.enqueue(`Orden de compra #${number}`)
      h.notify(`Orden #${number} ${status === 'borrador' ? 'guardada en borrador' : 'creada'}.`)
      if (status === 'enviada') get().sendOrder(order.id)
      return order
    },
    sendOrder: (orderId) => {
      const o = get().orders.find((x) => x.id === orderId)
      if (!o) return
      const sup = get().suppliers.find((s) => s.id === o.supplierId)!
      set((s) => ({ orders: s.orders.map((x) => (x.id === orderId ? { ...x, status: 'enviada' } : x)) }))
      h.message({
        businessId: o.businessId,
        channel: 'Email',
        to: sup.email,
        subject: `Orden de compra #${o.number}`,
        body: `Hola ${sup.name}, les enviamos el pedido:\n${orderText(o)}\nTotal estimado: ${money(o.total)}.\nGracias.`,
      })
      h.enqueue(`Envío de orden #${o.number}`)
      h.notify(`Orden #${o.number} enviada a ${sup.name} (email simulado).`)
    },
    receiveOrder: (orderId, invoiceRef, edited) => {
      if (!can(h.me(), 'compras.gestionar')) return 'Tu usuario no puede registrar compras'
      const o = get().orders.find((x) => x.id === orderId)
      if (!o || o.status === 'recibida' || o.status === 'cancelada') return 'La orden no se puede recibir'
      const lines: PurchaseLine[] = edited ?? o.lines
      for (const l of lines) {
        if (l.qty <= 0) continue
        const p = get().products.find((x) => x.id === l.productId)!
        // A1: la compra suma stock (en lote propio si el producto vence) y actualiza el costo
        let lotId: string
        if (p.tracksLots) {
          const lot: Lot = { id: uid('l-'), productId: p.id, qty: 0, expiry: l.expiry ?? addDays(60), code: `L${Math.floor(1000 + Math.random() * 8999)}` }
          set((s) => ({ lots: [...s.lots, lot] }))
          lotId = lot.id
        } else {
          const existing = get().lots.find((x) => x.productId === p.id)
          if (existing) lotId = existing.id
          else {
            const lot: Lot = { id: uid('l-'), productId: p.id, qty: 0, expiry: null, code: 'Sin lote' }
            set((s) => ({ lots: [...s.lots, lot] }))
            lotId = lot.id
          }
        }
        h.changeLot(lotId, l.qty)
        h.addMovement({ productId: p.id, lotId, delta: l.qty, type: 'compra', refId: o.id, reason: `OC #${o.number}` })
        set((s) => ({
          products: s.products.map((x) => (x.id === p.id ? { ...x, cost: l.cost } : x)),
          supplierPrices: [{ supplierId: o.supplierId, productId: p.id, cost: l.cost, at: now() }, ...s.supplierPrices.filter((sp) => !(sp.supplierId === o.supplierId && sp.productId === p.id))],
        }))
      }
      const total = lines.reduce((a, l) => a + l.qty * l.cost, 0)
      set((s) => ({
        orders: s.orders.map((x) => (x.id === orderId ? { ...x, status: 'recibida', receivedAt: now(), invoiceRef, lines, total } : x)),
        supEntries: [{ id: uid('se-'), businessId: o.businessId, supplierId: o.supplierId, at: now(), type: 'compra', amount: total, ref: `OC #${o.number} · ${invoiceRef || 'sin factura'}` }, ...s.supEntries],
      }))
      const sup = get().suppliers.find((s) => s.id === o.supplierId)
      h.audit('compra', `Recepción OC #${o.number} de ${sup?.name}: ${lines.length} productos, ${money(total)}`)
      h.enqueue(`Recepción de compra #${o.number}`)
      h.notify(`Orden #${o.number} recibida: stock y costos actualizados.`)
      return null
    },
    cancelOrder: (orderId) => {
      const o = get().orders.find((x) => x.id === orderId)
      if (!o || o.status === 'recibida') return
      set((s) => ({ orders: s.orders.map((x) => (x.id === orderId ? { ...x, status: 'cancelada' } : x)) }))
      h.audit('compra', `Orden #${o.number} cancelada`)
      h.enqueue(`Cancelación de orden #${o.number}`)
      h.notify(`Orden #${o.number} cancelada.`)
    },
    paySupplier: (supplierId, amount, method) => {
      if (!can(h.me(), 'proveedores.pagar')) return 'Solo el Administrador registra pagos a proveedores'
      if (amount <= 0) return 'El monto debe ser mayor a cero'
      const sup = get().suppliers.find((s) => s.id === supplierId)!
      const before = supplierBalance(get().supEntries, supplierId)
      if (method === 'Efectivo de caja') {
        if (!currentSession(get())) return 'Para pagar en efectivo abrí una caja'
        get().addCashMovement('retiro', amount, `Pago a ${sup.name}`)
      }
      set((s) => ({ supEntries: [{ id: uid('se-'), businessId: sup.businessId, supplierId, at: now(), type: 'pago', amount, ref: `Pago (${method})`, method }, ...s.supEntries] }))
      h.audit('pago a proveedor', `${sup.name} (${formatCuit(sup.cuit)}): ${money(amount)} por ${method}`, money(before), money(before - amount))
      h.enqueue(`Pago a ${sup.name}`)
      h.notify(`Pago de ${money(amount)} a ${sup.name} registrado.`)
      return null
    },
    generateReorders: () => {
      const biz = get().businessId
      const state = get()
      const busy = new Set(state.orders.filter((o) => o.businessId === biz && (o.status === 'borrador' || o.status === 'enviada')).flatMap((o) => o.lines.map((l) => l.productId)))
      const bySupplier = new Map<string, PurchaseLine[]>()
      for (const p of state.products.filter((x) => x.businessId === biz)) {
        const stock = stockOf(state.lots, p.id)
        if (stock > p.minStock || busy.has(p.id)) continue
        // proveedor sugerido: el de menor último costo
        const offer = state.supplierPrices.filter((sp) => sp.productId === p.id).sort((a, b) => a.cost - b.cost)[0]
        if (!offer) continue
        const target = p.minStock * 3
        const qty = Math.max(1, Math.ceil(target - stock))
        bySupplier.set(offer.supplierId, [...(bySupplier.get(offer.supplierId) ?? []), { productId: p.id, qty, cost: offer.cost }])
      }
      for (const [supplierId, lines] of bySupplier) get().createOrder(supplierId, lines, 'borrador', true)
      return bySupplier.size
    },
  } satisfies Partial<Actions>
}
