// Estado de la demo. Simula la base local de la caja (M4): todo se guarda en el
// navegador, así que cerrar la app o apagar el equipo no pierde nada (M4-R4).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AuditAction,
  AuditEntry,
  BusinessId,
  CashSession,
  Customer,
  Invoice,
  InvoiceKind,
  Lot,
  Payment,
  PriceChange,
  Product,
  ReceiptKind,
  RemoteSale,
  Sale,
  SaleItem,
  StockMovement,
  SyncLogEntry,
  SyncOp,
  User,
} from './types'
import { buildSeed, businesses, seedUsers } from './data/seed'
import { daysUntil, money, uid } from './lib/format'
import { can, discountCap } from './lib/permissions'
import { caeExpiry, fakeCae, isCuitActive } from './lib/arca'

export type Page =
  | 'inicio'
  | 'venta'
  | 'caja'
  | 'ventas'
  | 'productos'
  | 'alertas'
  | 'comprobantes'
  | 'sincronizacion'
  | 'auditoria'
  | 'usuarios'

export interface CartLine {
  productId: string
  qty: number
}

interface State {
  users: User[]
  products: Product[]
  lots: Lot[]
  movements: StockMovement[]
  priceHistory: PriceChange[]
  sessions: CashSession[]
  sales: Sale[]
  invoices: Invoice[]
  audit: AuditEntry[]
  queue: SyncOp[]
  syncLog: SyncLogEntry[]
  remoteSales: RemoteSale[]
  saleSeq: Record<BusinessId, number>
  invoiceSeq: Record<string, number>

  currentUserId: string | null
  businessId: BusinessId
  page: Page

  // conectividad y simulaciones de la demo
  realOnline: boolean
  simOffline: boolean
  arcaDown: boolean
  syncing: boolean
  lastSyncAt: string | null
  expiryWarnDays: number

  login: (userId: string, pin: string) => string | null
  logout: () => void
  setBusiness: (b: BusinessId) => void
  setPage: (p: Page) => void
  setRealOnline: (v: boolean) => void
  setSimOffline: (v: boolean) => void
  setArcaDown: (v: boolean) => void
  setExpiryWarnDays: (n: number) => void
  resetDemo: () => void

  openSession: (amount: number, register: string, shift: string) => string | null
  addCashMovement: (type: 'retiro' | 'ingreso', amount: number, reason: string) => void
  closeSession: (counted: number) => void
  reopenSession: (id: string) => string | null

  completeSale: (p: {
    cart: CartLine[]
    discountPct: number
    payments: Payment[]
    cashReceived?: number
    receiptKind: ReceiptKind
    customer?: Customer
  }) => { sale?: Sale; error?: string }
  voidSale: (saleId: string, reason: string, authorizerId: string) => string | null

  adjustStock: (p: { productId: string; lotId: string | 'nuevo'; delta: number; reason: string; expiry?: string | null }) => string | null
  writeOffLot: (lotId: string) => void
  updatePrice: (productId: string, price: number) => void
  bulkPrice: (category: string | null, pct: number) => number
  addProduct: (p: Omit<Product, 'id' | 'businessId'>, qty: number, expiry: string | null) => void
  importProducts: (rows: { name: string; category: string; barcode: string | null; cost: number; price: number; minStock: number; qty: number }[]) => number
  assignBarcode: (productId: string, code: string) => string | null

  toggleBlock: (userId: string) => void
  addUser: (u: Omit<User, 'id' | 'blocked'>) => void

  retryPendingInvoices: () => void
  syncNow: () => Promise<void>
  simulateRemoteSale: (productId: string, qty: number) => void
}

const now = () => new Date().toISOString()

function initialData() {
  const seed = buildSeed()
  const saleSeq = {
    kiosco: seed.sales.filter((s) => s.businessId === 'kiosco').length,
    super: seed.sales.filter((s) => s.businessId === 'super').length,
  }
  return {
    users: seedUsers,
    products: seed.products,
    lots: seed.lots,
    movements: [] as StockMovement[],
    priceHistory: [] as PriceChange[],
    sessions: [] as CashSession[],
    sales: seed.sales,
    invoices: [] as Invoice[],
    audit: [] as AuditEntry[],
    queue: [] as SyncOp[],
    syncLog: [] as SyncLogEntry[],
    remoteSales: [] as RemoteSale[],
    saleSeq,
    invoiceSeq: { 'kiosco-Factura B': 1840, 'kiosco-Factura A': 212, 'kiosco-Nota de crédito B': 37, 'kiosco-Nota de crédito A': 4, 'super-Factura B': 5321, 'super-Factura A': 640, 'super-Nota de crédito B': 88, 'super-Nota de crédito A': 9 } as Record<string, number>,
  }
}

/** lotes vendibles de un producto, en orden de vencimiento más próximo (M2-R1) */
export function sellableLots(lots: Lot[], productId: string) {
  return lots
    .filter((l) => l.productId === productId && l.qty > 0 && (l.expiry === null || daysUntil(l.expiry) >= 0))
    .sort((a, b) => (a.expiry ?? '9999') .localeCompare(b.expiry ?? '9999'))
}

export const stockOf = (lots: Lot[], productId: string) =>
  lots.filter((l) => l.productId === productId).reduce((a, l) => a + l.qty, 0)

export const sellableStockOf = (lots: Lot[], productId: string) =>
  sellableLots(lots, productId).reduce((a, l) => a + l.qty, 0)

export function sessionTotals(session: CashSession, sales: Sale[]) {
  const own = sales.filter((s) => s.sessionId === session.id && s.status === 'completada')
  const cash = own.reduce((a, s) => a + s.payments.filter((p) => p.method === 'efectivo').reduce((x, p) => x + p.amount, 0), 0)
  const transfer = own.reduce((a, s) => a + s.payments.filter((p) => p.method === 'transferencia').reduce((x, p) => x + p.amount, 0), 0)
  const ins = session.movements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0)
  const outs = session.movements.filter((m) => m.type === 'retiro').reduce((a, m) => a + m.amount, 0)
  const voided = sales.filter((s) => s.sessionId === session.id && s.status === 'anulada').length
  return { count: own.length, cash, transfer, ins, outs, voided, expected: session.openingAmount + cash + ins - outs }
}

let syncTimer: ReturnType<typeof setTimeout> | undefined

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const isOnline = () => get().realOnline && !get().simOffline
      const me = () => get().users.find((u) => u.id === get().currentUserId)

      const audit = (action: AuditAction, detail: string, before?: string, after?: string) => {
        const entry: AuditEntry = { id: uid('a-'), at: now(), userId: get().currentUserId ?? 'sistema', businessId: get().businessId, action, detail, before, after }
        set((s) => ({ audit: [entry, ...s.audit] }))
      }

      /** toda operación que el servidor central debe recibir pasa por la cola local */
      const enqueue = (label: string) => {
        const op: SyncOp = { id: uid('q-'), businessId: get().businessId, label, at: now() }
        set((s) => ({ queue: [...s.queue, op] }))
        if (isOnline()) {
          clearTimeout(syncTimer)
          syncTimer = setTimeout(() => get().syncNow(), 900)
        }
      }

      const log = (text: string, kind: SyncLogEntry['kind'] = 'info') =>
        set((s) => ({ syncLog: [{ id: uid('sl-'), at: now(), text, kind }, ...s.syncLog].slice(0, 80) }))

      /** intenta emitir un comprobante contra "ARCA" */
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

      const changeLot = (lotId: string, delta: number) =>
        set((s) => ({ lots: s.lots.map((l) => (l.id === lotId ? { ...l, qty: l.qty + delta } : l)) }))

      const addMovement = (m: Omit<StockMovement, 'id' | 'at' | 'userId' | 'businessId'>) =>
        set((s) => ({
          movements: [{ ...m, id: uid('m-'), at: now(), userId: s.currentUserId ?? 'sistema', businessId: s.businessId }, ...s.movements],
        }))

      return {
        ...initialData(),
        currentUserId: null,
        businessId: 'kiosco',
        page: 'inicio',
        realOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
        simOffline: false,
        arcaDown: false,
        syncing: false,
        lastSyncAt: null,
        expiryWarnDays: 7,

        login: (userId, pin) => {
          const u = get().users.find((x) => x.id === userId)
          if (!u) return 'Usuario inexistente'
          if (u.blocked) return 'Usuario bloqueado. Consultá con el administrador.' // M3-R2
          if (u.pin !== pin) return 'PIN incorrecto'
          set({ currentUserId: u.id, businessId: u.businessId ?? get().businessId, page: u.role === 'cajero' ? 'venta' : 'inicio' })
          audit('inicio de sesión', `${u.name} ingresó al sistema`)
          return null
        },
        logout: () => set({ currentUserId: null }),
        setBusiness: (b) => {
          if (me()?.businessId && me()?.businessId !== b) return
          set({ businessId: b })
        },
        setPage: (page) => set({ page }),
        setRealOnline: (v) => {
          set({ realOnline: v })
          if (isOnline()) get().syncNow()
        },
        setSimOffline: (v) => {
          set({ simOffline: v })
          log(v ? 'Se cortó la conexión. La caja sigue operando y guarda todo en el equipo.' : 'Volvió la conexión.', 'info')
          if (!v) setTimeout(() => get().syncNow(), 400)
        },
        setArcaDown: (v) => {
          set({ arcaDown: v })
          if (!v) get().retryPendingInvoices()
        },
        setExpiryWarnDays: (n) => set({ expiryWarnDays: Math.max(1, Math.min(60, n)) }),
        resetDemo: () => set({ ...initialData(), currentUserId: null, page: 'inicio', simOffline: false, arcaDown: false, lastSyncAt: null }),

        // ───────── M1 · Caja ─────────
        openSession: (amount, register, shift) => {
          const u = me()
          if (!u) return 'Sin sesión'
          if (get().sessions.some((s) => s.userId === u.id && s.businessId === get().businessId && !s.closedAt)) return 'Ya tenés una caja abierta'
          const session: CashSession = { id: uid('c-'), businessId: get().businessId, userId: u.id, register, shift, openedAt: now(), openingAmount: amount, movements: [] }
          set((s) => ({ sessions: [session, ...s.sessions] }))
          audit('apertura de caja', `${register} · turno ${shift} · monto inicial ${money(amount)}`)
          enqueue(`Apertura de caja (${register})`)
          return null
        },
        addCashMovement: (type, amount, reason) => {
          const sess = currentSession(get())
          if (!sess) return
          const mov = { id: uid('cm-'), type, amount, reason, at: now() }
          set((s) => ({ sessions: s.sessions.map((x) => (x.id === sess.id ? { ...x, movements: [...x.movements, mov] } : x)) }))
          audit('movimiento de caja', `${type === 'retiro' ? 'Retiro' : 'Ingreso'} de ${money(amount)}: ${reason}`)
          enqueue(`${type === 'retiro' ? 'Retiro' : 'Ingreso'} de caja ${money(amount)}`)
        },
        closeSession: (counted) => {
          const sess = currentSession(get())
          if (!sess) return
          const { expected } = sessionTotals(sess, get().sales)
          set((s) => ({
            sessions: s.sessions.map((x) =>
              x.id === sess.id ? { ...x, closedAt: now(), expectedAmount: expected, countedAmount: counted, closedBy: s.currentUserId ?? undefined } : x,
            ),
          }))
          // M1-R5: la diferencia queda registrada con turno y cajero
          audit('cierre de caja', `${sess.register} · turno ${sess.shift} · diferencia ${money(counted - expected)}`, `Esperado ${money(expected)}`, `Contado ${money(counted)}`)
          enqueue(`Cierre de caja (${sess.register})`)
        },
        reopenSession: (id) => {
          const u = me()
          if (!can(u?.role, 'caja.reabrir')) return 'Reabrir un cierre requiere Encargado o superior' // M1-R4
          const sess = get().sessions.find((s) => s.id === id)
          if (!sess?.closedAt) return 'La caja no está cerrada'
          if (get().sessions.some((s) => s.userId === sess.userId && s.businessId === sess.businessId && !s.closedAt)) return 'Ese usuario ya tiene otra caja abierta'
          set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, closedAt: undefined, reopenedBy: u!.id } : x)) }))
          audit('reapertura de caja', `${sess.register} · turno ${sess.shift}`, `Cerrada, contado ${money(sess.countedAmount ?? 0)}`, 'Abierta')
          enqueue(`Reapertura de caja (${sess.register})`)
          return null
        },

        completeSale: ({ cart, discountPct, payments, cashReceived, receiptKind, customer }) => {
          const state = get()
          const u = me()
          const sess = currentSession(state)
          if (!u || !sess) return { error: 'No se puede vender sin una caja abierta a tu nombre.' } // M1-R1
          if (cart.length === 0) return { error: 'El ticket está vacío.' }
          if (discountPct > discountCap(u.role)) return { error: `Tu rol permite hasta ${discountCap(u.role)}% de descuento.` }

          // reserva de stock por lote, vencimiento más próximo primero (M2-R1), sin vencidos (M2-R3)
          const items: SaleItem[] = []
          for (const line of cart) {
            const p = state.products.find((x) => x.id === line.productId)!
            let left = line.qty
            const allocations: SaleItem['allocations'] = []
            for (const lot of sellableLots(state.lots, p.id)) {
              if (left <= 0) break
              const take = Math.min(lot.qty, left)
              allocations.push({ lotId: lot.id, qty: take })
              left -= take
            }
            if (left > 0) {
              const blocked = stockOf(state.lots, p.id) - sellableStockOf(state.lots, p.id)
              return { error: `Stock insuficiente de ${p.name}: hay ${sellableStockOf(state.lots, p.id)} disponibles${blocked > 0 ? ` (${blocked} vencidos, no se pueden vender)` : ''}.` }
            }
            items.push({ productId: p.id, name: p.name, qty: line.qty, unitPrice: p.price, allocations })
          }

          const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
          const total = Math.round(subtotal * (1 - discountPct / 100) * 100) / 100
          const paid = payments.reduce((a, p) => a + p.amount, 0)
          if (Math.abs(paid - total) > 0.01) return { error: 'Los pagos no cubren el total.' }
          const cashPart = payments.filter((p) => p.method === 'efectivo').reduce((a, p) => a + p.amount, 0)
          if (cashPart > 0 && (cashReceived ?? cashPart) < cashPart) return { error: 'El efectivo recibido es menor al monto en efectivo.' }
          if (receiptKind === 'A' && !customer?.cuit) return { error: 'La factura A requiere el CUIT del cliente.' }

          const number = state.saleSeq[state.businessId] + 1
          const sale: Sale = {
            id: uid('s-'),
            number,
            businessId: state.businessId,
            sessionId: sess.id,
            userId: u.id,
            at: now(),
            items,
            subtotal,
            discountPct,
            total,
            payments,
            cashReceived: cashPart > 0 ? cashReceived ?? cashPart : undefined,
            change: cashPart > 0 ? (cashReceived ?? cashPart) - cashPart : undefined,
            receiptKind,
            customer,
            status: 'completada',
            createdOffline: !isOnline(),
          }
          set((s) => ({ saleSeq: { ...s.saleSeq, [s.businessId]: number } }))

          // M1-R2: la venta descuenta stock al cerrarse
          for (const it of items)
            for (const a of it.allocations) {
              changeLot(a.lotId, -a.qty)
              addMovement({ productId: it.productId, lotId: a.lotId, delta: -a.qty, type: 'venta', refId: sale.id })
            }

          set((s) => ({ sales: [sale, ...s.sales] }))
          if (discountPct > 0) audit('descuento', `Venta #${number}: ${discountPct}% de descuento`, money(subtotal), money(total))
          enqueue(`Venta #${number} · ${money(total)}`)

          if (receiptKind !== 'ticket') {
            const cust: Customer = receiptKind === 'A' ? customer! : customer ?? { name: 'Consumidor final', ivaCondition: 'Consumidor final' }
            const inv = createInvoice(sale, receiptKind === 'A' ? 'Factura A' : 'Factura B', cust)
            sale.invoiceId = inv.id
            set((s) => ({ sales: s.sales.map((x) => (x.id === sale.id ? { ...x, invoiceId: inv.id } : x)) }))
          }
          return { sale: get().sales.find((x) => x.id === sale.id) }
        },

        voidSale: (saleId, reason, authorizerId) => {
          const u = me()
          const sale = get().sales.find((s) => s.id === saleId)
          if (!u || !sale) return 'Venta inexistente'
          if (sale.status === 'anulada') return 'La venta ya está anulada'
          const auth = get().users.find((x) => x.id === authorizerId)
          if (!can(auth?.role, 'venta.anular')) return 'La anulación requiere autorización de un Encargado o superior'
          if (!reason.trim()) return 'El motivo es obligatorio'

          // M1-R3: devuelve stock a los mismos lotes y deja el movimiento, nunca se borra
          for (const it of sale.items)
            for (const a of it.allocations) {
              changeLot(a.lotId, a.qty)
              addMovement({ productId: it.productId, lotId: a.lotId, delta: a.qty, type: 'anulacion', refId: sale.id, reason })
            }
          set((s) => ({
            sales: s.sales.map((x) => (x.id === saleId ? { ...x, status: 'anulada', voidReason: reason, voidedBy: u.id, voidAuthorizedBy: auth!.id, voidedAt: now() } : x)),
          }))
          audit('anulación', `Venta #${sale.number} (${money(sale.total)}) · motivo: ${reason} · autorizó ${auth!.name}`, 'Completada', 'Anulada')
          enqueue(`Anulación venta #${sale.number}`)

          // M5-R1: un comprobante emitido no se modifica, se corrige con nota de crédito
          const inv = get().invoices.find((i) => i.id === sale.invoiceId)
          if (inv && inv.status !== 'rechazado') {
            const nc = createInvoice(sale, inv.kind === 'Factura A' ? 'Nota de crédito A' : 'Nota de crédito B', inv.customer, inv.id)
            set((s) => ({ sales: s.sales.map((x) => (x.id === saleId ? { ...x, creditNoteId: nc.id } : x)) }))
          }
          return null
        },

        // ───────── M2 · Catálogo y stock ─────────
        adjustStock: ({ productId, lotId, delta, reason, expiry }) => {
          if (!can(me()?.role, 'stock.ajustar')) return 'Tu rol no permite ajustar stock'
          if (!reason) return 'El motivo es obligatorio' // M2-R2
          if (!delta) return 'La cantidad no puede ser cero'
          const p = get().products.find((x) => x.id === productId)!
          let targetId = lotId
          if (lotId === 'nuevo') {
            const lot: Lot = { id: uid('l-'), productId, qty: 0, expiry: expiry ?? null, code: expiry ? `L${Math.floor(1000 + Math.random() * 8999)}` : 'Sin lote' }
            set((s) => ({ lots: [...s.lots, lot] }))
            targetId = lot.id
          }
          const before = stockOf(get().lots, productId)
          changeLot(targetId, delta)
          addMovement({ productId, lotId: targetId, delta, type: reason === 'Ingreso de mercadería' ? 'ingreso' : 'ajuste', reason })
          audit('ajuste de stock', `${p.name}: ${delta > 0 ? '+' : ''}${delta} · ${reason}`, String(before), String(before + delta))
          enqueue(`Ajuste de stock ${p.name} (${delta > 0 ? '+' : ''}${delta})`)
          return null
        },
        writeOffLot: (lotId) => {
          const lot = get().lots.find((l) => l.id === lotId)
          if (!lot || lot.qty <= 0) return
          get().adjustStock({ productId: lot.productId, lotId, delta: -lot.qty, reason: 'Vencido' })
        },
        updatePrice: (productId, price) => {
          if (!can(me()?.role, 'precios.editar')) return
          const p = get().products.find((x) => x.id === productId)!
          if (p.price === price || price <= 0) return
          // M2-R4: rige desde que se guarda y conserva el historial
          const change: PriceChange = { id: uid('pc-'), productId, oldPrice: p.price, newPrice: price, at: now(), userId: get().currentUserId! }
          set((s) => ({ products: s.products.map((x) => (x.id === productId ? { ...x, price } : x)), priceHistory: [change, ...s.priceHistory] }))
          audit('cambio de precio', p.name, money(p.price), money(price))
          enqueue(`Precio ${p.name} → ${money(price)}`)
        },
        bulkPrice: (category, pct) => {
          if (!can(me()?.role, 'precios.editar') || !pct) return 0
          const targets = get().products.filter((p) => p.businessId === get().businessId && (!category || p.category === category))
          const changes: PriceChange[] = []
          const updated = new Map<string, number>()
          for (const p of targets) {
            const price = Math.max(10, Math.round((p.price * (1 + pct / 100)) / 10) * 10)
            if (price === p.price) continue
            updated.set(p.id, price)
            changes.push({ id: uid('pc-'), productId: p.id, oldPrice: p.price, newPrice: price, at: now(), userId: get().currentUserId!, note: `Masivo ${pct > 0 ? '+' : ''}${pct}%` })
          }
          set((s) => ({
            products: s.products.map((x) => (updated.has(x.id) ? { ...x, price: updated.get(x.id)! } : x)),
            priceHistory: [...changes, ...s.priceHistory],
          }))
          audit('cambio de precio', `Cambio masivo ${pct > 0 ? '+' : ''}${pct}% en ${category ?? 'todas las categorías'} (${changes.length} productos)`)
          enqueue(`Cambio masivo de precios (${changes.length} productos)`)
          return changes.length
        },
        addProduct: (p, qty, expiry) => {
          const product: Product = { ...p, id: uid('p-'), businessId: get().businessId }
          const lot: Lot = { id: uid('l-'), productId: product.id, qty: 0, expiry, code: expiry ? `L${Math.floor(1000 + Math.random() * 8999)}` : 'Sin lote' }
          set((s) => ({ products: [...s.products, product], lots: [...s.lots, lot] }))
          if (qty) {
            changeLot(lot.id, qty)
            addMovement({ productId: product.id, lotId: lot.id, delta: qty, type: 'apertura', reason: 'Stock de apertura' })
          }
          audit('alta de producto', `${product.name} · ${money(product.price)} · stock inicial ${qty}`)
          enqueue(`Alta de producto ${product.name}`)
        },
        importProducts: (rows) => {
          const biz = get().businessId
          const products: Product[] = []
          const lots: Lot[] = []
          for (const r of rows) {
            const id = uid('p-')
            products.push({ id, businessId: biz, name: r.name, category: r.category || 'Sin categoría', barcode: r.barcode, cost: r.cost, price: r.price, minStock: r.minStock, tracksLots: false })
            lots.push({ id: uid('l-'), productId: id, qty: r.qty, expiry: null, code: 'Sin lote' })
          }
          set((s) => ({ products: [...s.products, ...products], lots: [...s.lots, ...lots] }))
          audit('importación', `Importación de planilla: ${rows.length} productos`)
          enqueue(`Importación de ${rows.length} productos`)
          return rows.length
        },
        assignBarcode: (productId, code) => {
          if (!can(me()?.role, 'codigo.asignar')) return 'Asignar códigos requiere Encargado o superior'
          const clash = get().products.find((p) => p.businessId === get().businessId && p.barcode === code)
          if (clash) return `Ese código ya pertenece a ${clash.name}`
          const p = get().products.find((x) => x.id === productId)!
          set((s) => ({ products: s.products.map((x) => (x.id === productId ? { ...x, barcode: code } : x)) }))
          audit('código de barras', `${p.name} ← ${code}`, p.barcode ?? 'sin código', code)
          enqueue(`Código de barras ${p.name}`)
          return null
        },

        // ───────── M3 · Usuarios ─────────
        toggleBlock: (userId) => {
          if (!can(me()?.role, 'usuarios.gestionar') || userId === get().currentUserId) return
          const u = get().users.find((x) => x.id === userId)!
          set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, blocked: !x.blocked } : x)) }))
          audit('usuarios', `${u.blocked ? 'Desbloqueo' : 'Bloqueo'} de ${u.name}`, u.blocked ? 'Bloqueado' : 'Activo', u.blocked ? 'Activo' : 'Bloqueado')
          enqueue(`Usuario ${u.name}`)
        },
        addUser: (u) => {
          if (!can(me()?.role, 'usuarios.gestionar')) return
          set((s) => ({ users: [...s.users, { ...u, id: uid('u-'), blocked: false }] }))
          audit('usuarios', `Alta de ${u.name} (${u.role})`)
          enqueue(`Alta de usuario ${u.name}`)
        },

        // ───────── M5 · Facturación ─────────
        retryPendingInvoices: () => {
          const pending = get()
            .invoices.filter((i) => i.status === 'pendiente')
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          if (!pending.length || !isOnline()) return
          let issued = 0
          for (const inv of pending) {
            const res = tryIssue(get().invoices.find((i) => i.id === inv.id)!)
            if (res.status === 'emitido') issued++
            set((s) => ({ invoices: s.invoices.map((i) => (i.id === inv.id ? res : i)) }))
          }
          if (issued) log(`Contingencia regularizada: ${issued} comprobante${issued > 1 ? 's' : ''} emitido${issued > 1 ? 's' : ''} con CAE.`, 'ok')
        },

        // ───────── M4 · Sincronización ─────────
        syncNow: async () => {
          if (!isOnline() || get().syncing) return
          if (!get().queue.length && !get().remoteSales.length) {
            get().retryPendingInvoices()
            return
          }
          set({ syncing: true })
          await new Promise((r) => setTimeout(r, 1400))
          if (!isOnline()) {
            set({ syncing: false })
            return
          }
          const ops = get().queue.length

          // M4-R3: las ventas de otras cajas se suman como movimientos, no pisan cantidades
          for (const rs of get().remoteSales) {
            const p = get().products.find((x) => x.id === rs.productId)!
            const before = stockOf(get().lots, p.id)
            let left = rs.qty
            const lots = sellableLots(get().lots, p.id)
            for (const lot of lots) {
              if (left <= 0) break
              const take = Math.min(lot.qty, left)
              changeLot(lot.id, -take)
              set((s) => ({ movements: [{ id: uid('m-'), businessId: rs.businessId, productId: p.id, lotId: lot.id, delta: -take, type: 'otra-caja', reason: rs.register, at: rs.at, userId: 'sistema' }, ...s.movements] }))
              left -= take
            }
            if (left > 0) {
              const any = get().lots.find((l) => l.productId === p.id)
              if (any) changeLot(any.id, -left)
            }
            const after = stockOf(get().lots, p.id)
            log(
              `${p.name}: ${rs.register} vendió ${rs.qty} sin conexión. Stock conciliado sumando movimientos: ${before} → ${after}.${after < 0 ? ' Quedó negativo: requiere recuento.' : ''}`,
              'conflicto',
            )
          }
          set({ queue: [], remoteSales: [], syncing: false, lastSyncAt: now() })
          if (ops) log(`${ops > 1 ? `Se sincronizaron ${ops} operaciones` : 'Se sincronizó 1 operación'} con el servidor, sin duplicados.`, 'ok')
          get().retryPendingInvoices()
        },
        simulateRemoteSale: (productId, qty) => {
          const rs: RemoteSale = { id: uid('r-'), businessId: get().businessId, register: 'Caja 2', productId, qty, at: now() }
          set((s) => ({ remoteSales: [...s.remoteSales, rs] }))
          if (isOnline()) setTimeout(() => get().syncNow(), 300)
        },
      }
    },
    {
      name: 'sodium-demo-v1',
      partialize: (s) => {
        const { realOnline: _r, syncing: _s, ...rest } = s
        return rest
      },
    },
  ),
)

export function currentSession(s: Pick<State, 'sessions' | 'currentUserId' | 'businessId'>) {
  return s.sessions.find((x) => x.userId === s.currentUserId && x.businessId === s.businessId && !x.closedAt)
}

export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId))
export const useOnline = () => useStore((s) => s.realOnline && !s.simOffline)
