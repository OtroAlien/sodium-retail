// Funciones internas que comparten todas las acciones: auditoría, cola de sincronización,
// emisión de comprobantes y el registro de una venta (mercadería o servicios).
import type { AuditAction, AuditEntry, Customer, Invoice, InvoiceKind, MpMovement, Outbox, Payment, ReceiptKind, Sale, SaleItem, StockMovement, SyncLogEntry, SyncOp } from '../types'
import { businesses } from '../data/seed'
import { money, uid } from '../lib/format'
import { caeExpiry, fakeCae, isCuitActive } from '../lib/arca'
import { clientBalance, currentSession } from './selectors'
import type { GetState, SetState } from './state'

export const now = () => new Date().toISOString()

let syncTimer: ReturnType<typeof setTimeout> | undefined

export function createHelpers(set: SetState, get: GetState) {
  const isOnline = () => get().realOnline && !get().simOffline
  const me = () => get().users.find((u) => u.id === get().currentUserId)

  const audit = (action: AuditAction, detail: string, before?: string, after?: string) => {
    const entry: AuditEntry = { id: uid('a-'), at: now(), userId: get().currentUserId ?? 'sistema', businessId: get().businessId, action, detail, before, after }
    set((s) => ({ audit: [entry, ...s.audit] }))
  }

  /** toda operación que el servidor central debe recibir pasa por la cola local (M4) */
  const enqueue = (label: string) => {
    const op: SyncOp = { id: uid('q-'), businessId: get().businessId, label, at: now() }
    set((s) => ({ queue: [...s.queue, op] }))
    if (isOnline()) {
      clearTimeout(syncTimer)
      syncTimer = setTimeout(() => get().syncNow(), 900)
    }
  }

  const log = (text: string, kind: SyncLogEntry['kind'] = 'info') => set((s) => ({ syncLog: [{ id: uid('sl-'), at: now(), text, kind }, ...s.syncLog].slice(0, 80) }))

  /** aviso de resultado que se ve en pantalla aunque el diálogo ya se haya cerrado */
  const notify = (text: string, tone: 'ok' | 'error' | 'info' = 'ok') => {
    const id = uid('t-')
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }].slice(-3) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), tone === 'error' ? 7000 : 4500)
  }

  const message = (m: Omit<Outbox, 'id' | 'at'>) => set((s) => ({ outbox: [{ ...m, id: uid('msg-'), at: now() }, ...s.outbox].slice(0, 200) }))

  /** intenta emitir un comprobante contra "ARCA" (simulado) */
  const tryIssue = (inv: Invoice): Invoice => {
    if (inv.status === 'emitido') return inv
    if (!isOnline()) return { ...inv, status: 'pendiente', lastError: 'Sin conexión a internet. Se emite al volver la conexión.' }
    if (get().arcaDown) return { ...inv, attempts: inv.attempts + 1, status: 'pendiente', lastError: 'ARCA no responde. Reintento automático.' }
    if (inv.relatedInvoiceId) {
      const orig = get().invoices.find((i) => i.id === inv.relatedInvoiceId)
      if (orig && orig.status !== 'emitido') return { ...inv, status: 'pendiente', lastError: 'Espera la emisión de la factura original.' }
    }
    if (!isCuitActive(inv.customer.cuit)) {
      return { ...inv, attempts: inv.attempts + 1, status: 'rechazado', lastError: 'Rechazado por ARCA: el CUIT del receptor figura inactivo en el padrón.' }
    }
    const key = `${inv.businessId}-${inv.kind}`
    const next = (get().invoiceSeq[key] ?? 0) + 1
    set((s) => ({ invoiceSeq: { ...s.invoiceSeq, [key]: next } }))
    return { ...inv, status: 'emitido', number: next, cae: fakeCae(), caeExpiry: caeExpiry(), issuedAt: now(), attempts: inv.attempts + 1, lastError: undefined }
  }

  const createInvoice = (sale: Sale, kind: InvoiceKind, customer: Customer, relatedInvoiceId?: string) => {
    const base: Invoice = {
      id: uid('f-'),
      businessId: sale.businessId,
      saleId: sale.id,
      kind,
      pointOfSale: businesses[sale.businessId].pointOfSale,
      number: null,
      status: 'pendiente',
      customer,
      total: sale.total,
      createdAt: now(),
      attempts: 0,
      relatedInvoiceId,
    }
    const inv = tryIssue(base)
    set((s) => ({ invoices: [inv, ...s.invoices] }))
    return inv
  }

  const changeLot = (lotId: string, delta: number) => set((s) => ({ lots: s.lots.map((l) => (l.id === lotId ? { ...l, qty: Math.round((l.qty + delta) * 1000) / 1000 } : l)) }))

  const addMovement = (m: Omit<StockMovement, 'id' | 'at' | 'userId' | 'businessId'>) =>
    set((s) => ({ movements: [{ ...m, id: uid('m-'), at: now(), userId: s.currentUserId ?? 'sistema', businessId: s.businessId }, ...s.movements] }))

  /**
   * Registra una venta ya armada: valida caja y pagos, descuenta stock por lote,
   * carga la cuenta corriente, registra el cobro digital y emite el comprobante.
   */
  const recordSale = (p: {
    items: SaleItem[]
    subtotal: number
    discountPct: number
    total: number
    payments: Payment[]
    cashReceived?: number
    receiptKind: ReceiptKind
    customer?: Customer
    clientId?: string
    source: Sale['source']
    quoteId?: string
    reservationId?: string
  }): { sale?: Sale; error?: string } => {
    const state = get()
    const u = me()
    const sess = currentSession(state)
    if (!u || !sess) return { error: 'No se puede cobrar sin una caja abierta a tu nombre.' } // M1-R1
    const paid = p.payments.reduce((a, x) => a + x.amount, 0)
    if (Math.abs(paid - p.total) > 0.01) return { error: 'Los pagos no cubren el total.' }
    const cashPart = p.payments.filter((x) => x.method === 'efectivo').reduce((a, x) => a + x.amount, 0)
    if (cashPart > 0 && (p.cashReceived ?? cashPart) < cashPart) return { error: 'El efectivo recibido es menor al monto en efectivo.' }
    const digital = p.payments.some((x) => x.method === 'tarjeta' || x.method === 'qr')
    if (digital && !isOnline()) return { error: 'Sin conexión no se pueden confirmar pagos con tarjeta ni QR (M4-R2).' }
    const ccPart = p.payments.filter((x) => x.method === 'cuenta_corriente').reduce((a, x) => a + x.amount, 0)
    const client = p.clientId ? state.clients.find((c) => c.id === p.clientId) : undefined
    if (ccPart > 0) {
      if (!client || client.creditLimit <= 0) return { error: 'El cliente no tiene cuenta corriente habilitada.' }
      const bal = clientBalance(state.accounts, client.id)
      if (bal + ccPart > client.creditLimit) return { error: `Supera el límite de cuenta corriente de ${client.name}: saldo ${money(bal)} de ${money(client.creditLimit)}.` }
    }
    if (p.receiptKind === 'A' && !p.customer?.cuit) return { error: 'La factura A requiere el CUIT del cliente.' }

    const number = state.saleSeq[state.businessId] + 1
    const payments = p.payments.map((x) => (x.method === 'tarjeta' || x.method === 'qr' ? { ...x, mpId: x.mpId ?? `MP-${Date.now().toString().slice(-8)}` } : x))
    const sale: Sale = {
      id: uid('s-'),
      number,
      businessId: state.businessId,
      sessionId: sess.id,
      userId: u.id,
      at: now(),
      items: p.items,
      subtotal: p.subtotal,
      discountPct: p.discountPct,
      total: p.total,
      payments,
      cashReceived: cashPart > 0 ? p.cashReceived ?? cashPart : undefined,
      change: cashPart > 0 ? (p.cashReceived ?? cashPart) - cashPart : undefined,
      receiptKind: p.receiptKind,
      customer: p.customer,
      clientId: p.clientId,
      status: 'completada',
      createdOffline: !isOnline(),
      source: p.source,
      quoteId: p.quoteId,
      reservationId: p.reservationId,
    }
    set((s) => ({ saleSeq: { ...s.saleSeq, [s.businessId]: number } }))

    // M1-R2: la venta descuenta stock al cerrarse
    for (const it of p.items)
      for (const a of it.allocations) {
        changeLot(a.lotId, -a.qty)
        addMovement({ productId: it.productId!, lotId: a.lotId, delta: -a.qty, type: 'venta', refId: sale.id })
      }

    set((s) => ({ sales: [sale, ...s.sales] }))
    if (p.discountPct > 0) audit('descuento', `Venta #${number}: ${p.discountPct}% de descuento`, money(p.subtotal), money(p.total))
    if (ccPart > 0 && client) {
      set((s) => ({ accounts: [{ id: uid('ae-'), businessId: s.businessId, clientId: client.id, at: now(), type: 'cargo', amount: ccPart, ref: `Venta #${number}` }, ...s.accounts] }))
      audit('cuenta corriente', `${client.name}: cargo de ${money(ccPart)} por venta #${number}`)
    }
    for (const x of payments.filter((x) => x.method === 'tarjeta' || x.method === 'qr')) {
      const mov: MpMovement = {
        id: x.mpId!,
        businessId: sale.businessId,
        at: now(),
        amount: x.amount,
        fee: Math.round(x.amount * (x.method === 'tarjeta' ? 0.0329 : 0.0099) * 100) / 100,
        method: x.method as 'tarjeta' | 'qr',
        saleId: sale.id,
        status: 'pendiente',
        match: 'ok',
        description: `Venta #${number}`,
      }
      set((s) => ({ mp: [mov, ...s.mp] }))
    }
    enqueue(`Venta #${number} · ${money(p.total)}`)

    if (p.receiptKind !== 'ticket') {
      const cust: Customer = p.receiptKind === 'A' ? p.customer! : p.customer ?? { name: 'Consumidor final', ivaCondition: 'Consumidor final' }
      const inv = createInvoice(sale, p.receiptKind === 'A' ? 'Factura A' : 'Factura B', cust)
      set((s) => ({ sales: s.sales.map((x) => (x.id === sale.id ? { ...x, invoiceId: inv.id } : x)) }))
    }
    return { sale: get().sales.find((x) => x.id === sale.id) }
  }

  return { isOnline, me, audit, enqueue, log, notify, message, tryIssue, createInvoice, changeLot, addMovement, recordSale }
}

export type Helpers = ReturnType<typeof createHelpers>
