// Caja y ventas (M1), comprobantes (M5) y cobros digitales (A2).
import type { CashSession, SaleItem } from '../types'
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { money, uid } from '../lib/format'
import { can, discountCap } from '../lib/permissions'
import { currentSession, sellableLots, sellableStockOf, sessionTotals, stockOf, unitOf } from './selectors'

export function salesSlice(set: SetState, get: GetState, h: Helpers) {
  return {
    openSession: (amount, register, shift) => {
      const u = h.me()
      if (!u) return 'Sin sesión'
      if (get().sessions.some((s) => s.userId === u.id && s.businessId === get().businessId && !s.closedAt)) return 'Ya tenés una caja abierta'
      const session: CashSession = { id: uid('c-'), businessId: get().businessId, userId: u.id, register, shift, openedAt: now(), openingAmount: amount, movements: [] }
      set((s) => ({ sessions: [session, ...s.sessions] }))
      h.audit('apertura de caja', `${register} · turno ${shift} · monto inicial ${money(amount)}`)
      h.enqueue(`Apertura de caja (${register})`)
      h.notify(`Caja abierta: ${register}, turno ${shift}.`)
      return null
    },
    addCashMovement: (type, amount, reason) => {
      const sess = currentSession(get())
      if (!sess) return
      const mov = { id: uid('cm-'), type, amount, reason, at: now() }
      set((s) => ({ sessions: s.sessions.map((x) => (x.id === sess.id ? { ...x, movements: [...x.movements, mov] } : x)) }))
      h.audit('movimiento de caja', `${type === 'retiro' ? 'Retiro' : 'Ingreso'} de ${money(amount)}: ${reason}`)
      h.enqueue(`${type === 'retiro' ? 'Retiro' : 'Ingreso'} de caja ${money(amount)}`)
      h.notify(`${type === 'retiro' ? 'Retiro' : 'Ingreso'} de ${money(amount)} registrado.`)
    },
    closeSession: (counted) => {
      const sess = currentSession(get())
      if (!sess) return
      const { expected } = sessionTotals(sess, get().sales)
      set((s) => ({
        sessions: s.sessions.map((x) => (x.id === sess.id ? { ...x, closedAt: now(), expectedAmount: expected, countedAmount: counted, closedBy: s.currentUserId ?? undefined } : x)),
      }))
      // M1-R5: la diferencia queda registrada con turno y cajero
      h.audit('cierre de caja', `${sess.register} · turno ${sess.shift} · diferencia ${money(counted - expected)}`, `Esperado ${money(expected)}`, `Contado ${money(counted)}`)
      h.enqueue(`Cierre de caja (${sess.register})`)
      h.notify(`Caja cerrada. Diferencia: ${money(counted - expected)}.`)
    },
    reopenSession: (id) => {
      const u = h.me()
      if (!can(u, 'caja.reabrir')) return 'Reabrir un cierre requiere Encargado o superior' // M1-R4
      const sess = get().sessions.find((s) => s.id === id)
      if (!sess?.closedAt) return 'La caja no está cerrada'
      if (get().sessions.some((s) => s.userId === sess.userId && s.businessId === sess.businessId && !s.closedAt)) return 'Ese usuario ya tiene otra caja abierta'
      set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, closedAt: undefined, reopenedBy: u!.id } : x)) }))
      h.audit('reapertura de caja', `${sess.register} · turno ${sess.shift}`, `Cerrada, contado ${money(sess.countedAmount ?? 0)}`, 'Abierta')
      h.enqueue(`Reapertura de caja (${sess.register})`)
      h.notify(`Caja reabierta.`)
      return null
    },

    completeSale: ({ cart, discountPct, payments, cashReceived, receiptKind, customer, clientId, quoteId }) => {
      const state = get()
      const u = h.me()
      if (cart.length === 0) return { error: 'El ticket está vacío.' }
      if (discountPct > discountCap(u)) return { error: `Tu usuario permite hasta ${discountCap(u)}% de descuento.` }

      // reserva de stock por lote, vencimiento más próximo primero (M2-R1), sin vencidos (M2-R3)
      const items: SaleItem[] = []
      for (const line of cart) {
        const p = state.products.find((x) => x.id === line.productId)!
        const unit = unitOf(p, line.unitId)
        const need = Math.round(line.qty * unit.factor * 1000) / 1000
        let left = need
        const allocations: SaleItem['allocations'] = []
        for (const lot of sellableLots(state.lots, p.id)) {
          if (left <= 0) break
          const take = Math.min(lot.qty, left)
          allocations.push({ lotId: lot.id, qty: take })
          left = Math.round((left - take) * 1000) / 1000
        }
        if (left > 0) {
          const blocked = stockOf(state.lots, p.id) - sellableStockOf(state.lots, p.id)
          return { error: `Stock insuficiente de ${p.name}: hay ${sellableStockOf(state.lots, p.id)} ${p.baseUnit ?? 'u'} disponibles${blocked > 0 ? ` (${blocked} vencidos, no se pueden vender)` : ''}.` }
        }
        const isBase = unit.id === 'base'
        items.push({
          productId: p.id,
          name: isBase ? p.name : `${p.name} (${unit.label})`,
          qty: line.qty,
          unitPrice: line.price ?? unit.price,
          allocations,
          unitLabel: isBase ? undefined : unit.label,
          factor: unit.factor === 1 ? undefined : unit.factor,
        })
      }
      const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
      const total = Math.round(subtotal * (1 - discountPct / 100) * 100) / 100
      const res = h.recordSale({ items, subtotal, discountPct, total, payments, cashReceived, receiptKind, customer, clientId, source: quoteId ? 'presupuesto' : 'pos', quoteId })
      if (res.sale && quoteId) {
        set((s) => ({ quotes: s.quotes.map((q) => (q.id === quoteId ? { ...q, status: 'aceptado', saleId: res.sale!.id } : q)), posDraft: null }))
        h.audit('presupuesto', `Presupuesto convertido en venta #${res.sale.number}`)
      }
      return res
    },

    chargeService: ({ lines, payments, receiptKind, clientId, customer, source, reservationId, cashReceived }) => {
      const items: SaleItem[] = lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, allocations: [] }))
      const total = Math.round(items.reduce((a, i) => a + i.qty * i.unitPrice, 0) * 100) / 100
      return h.recordSale({ items, subtotal: total, discountPct: 0, total, payments, receiptKind, customer, clientId, source, reservationId, cashReceived })
    },

    voidSale: (saleId, reason, authorizerId) => {
      const u = h.me()
      const sale = get().sales.find((s) => s.id === saleId)
      if (!u || !sale) return 'Venta inexistente'
      if (sale.status === 'anulada') return 'La venta ya está anulada'
      const auth = get().users.find((x) => x.id === authorizerId)
      if (!can(auth, 'venta.anular')) return 'La anulación requiere autorización de un Encargado o superior'
      if (!reason.trim()) return 'El motivo es obligatorio'

      // M1-R3: devuelve stock a los mismos lotes y deja el movimiento, nunca se borra
      for (const it of sale.items)
        for (const a of it.allocations) {
          h.changeLot(a.lotId, a.qty)
          h.addMovement({ productId: it.productId!, lotId: a.lotId, delta: a.qty, type: 'anulacion', refId: sale.id, reason })
        }
      set((s) => ({
        sales: s.sales.map((x) => (x.id === saleId ? { ...x, status: 'anulada', voidReason: reason, voidedBy: u.id, voidAuthorizedBy: auth!.id, voidedAt: now() } : x)),
      }))
      // la cuenta corriente y los cobros digitales también se revierten
      const cc = sale.payments.filter((p) => p.method === 'cuenta_corriente').reduce((a, p) => a + p.amount, 0)
      if (cc > 0 && sale.clientId)
        set((s) => ({ accounts: [{ id: uid('ae-'), businessId: sale.businessId, clientId: sale.clientId!, at: now(), type: 'pago', amount: cc, ref: `Anulación venta #${sale.number}` }, ...s.accounts] }))
      const mpIds = sale.payments.map((p) => p.mpId).filter(Boolean)
      if (mpIds.length) set((s) => ({ mp: s.mp.map((m) => (mpIds.includes(m.id) ? { ...m, status: 'rechazado', description: `${m.description} · devuelto al anular` } : m)) }))
      h.audit('anulación', `Venta #${sale.number} (${money(sale.total)}) · motivo: ${reason} · autorizó ${auth!.name}`, 'Completada', 'Anulada')
      h.enqueue(`Anulación venta #${sale.number}`)
      h.notify(`Venta #${sale.number} anulada.`)

      // M5-R1: un comprobante emitido no se modifica, se corrige con nota de crédito
      const inv = get().invoices.find((i) => i.id === sale.invoiceId)
      if (inv && inv.status !== 'rechazado') {
        const nc = h.createInvoice(sale, inv.kind === 'Factura A' ? 'Nota de crédito A' : 'Nota de crédito B', inv.customer, inv.id)
        set((s) => ({ sales: s.sales.map((x) => (x.id === saleId ? { ...x, creditNoteId: nc.id } : x)) }))
      }
      return null
    },

    retryPendingInvoices: () => {
      const pending = get()
        .invoices.filter((i) => i.status === 'pendiente')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      if (!pending.length || !h.isOnline()) return
      let issued = 0
      for (const inv of pending) {
        const res = h.tryIssue(get().invoices.find((i) => i.id === inv.id)!)
        if (res.status === 'emitido') issued++
        set((s) => ({ invoices: s.invoices.map((i) => (i.id === inv.id ? res : i)) }))
      }
      if (issued) h.log(`Contingencia regularizada: ${issued} comprobante${issued > 1 ? 's' : ''} emitido${issued > 1 ? 's' : ''} con CAE.`, 'ok')
    },

    sendReceiptEmail: (saleId, email) => {
      const sale = get().sales.find((s) => s.id === saleId)
      if (!sale) return
      const inv = get().invoices.find((i) => i.id === sale.invoiceId)
      h.message({
        businessId: sale.businessId,
        channel: 'Email',
        to: email,
        subject: inv ? `${inv.kind} N° ${inv.pointOfSale}-${inv.number ?? 'pendiente'}` : `Comprobante de compra #${sale.number}`,
        body: `Gracias por tu compra. Adjuntamos el comprobante por ${money(sale.total)}.${inv?.cae ? ` CAE ${inv.cae}.` : ''}`,
      })
      h.enqueue(`Comprobante por email a ${email}`)
      h.notify(`Comprobante enviado a ${email} (email simulado).`)
    },

    reconcileMp: () => {
      const biz = get().businessId
      // las operaciones de más de un día se acreditan (simulación del plazo de Mercado Pago)
      const limit = Date.now() - 86400000
      let credited = 0
      set((s) => ({
        mp: s.mp.map((m) => {
          if (m.businessId === biz && m.status === 'pendiente' && new Date(m.at).getTime() < limit) {
            credited++
            return { ...m, status: 'acreditado' }
          }
          return m
        }),
      }))
      const mine = get().mp.filter((m) => m.businessId === biz)
      const noSale = mine.filter((m) => m.match === 'sin venta').length
      const diff = mine.filter((m) => m.match === 'diferencia').length
      const digitalSales = get().sales.filter((s) => s.businessId === biz && s.status === 'completada' && s.payments.some((p) => p.mpId))
      const missing = digitalSales.filter((s) => Date.now() - new Date(s.at).getTime() < 10 * 86400000 && !mine.some((m) => m.saleId === s.id)).length
      h.audit('sincronización', `Conciliación Mercado Pago: ${credited} acreditadas, ${noSale} pagos sin venta, ${missing} ventas sin pago, ${diff} con diferencia`)
      return `Conciliación lista: ${credited} acreditaciones nuevas · ${noSale} pago${noSale === 1 ? '' : 's'} sin venta · ${missing} venta${missing === 1 ? '' : 's'} sin acreditación · ${diff} con importe distinto.`
    },
  } satisfies Partial<Actions>
}
