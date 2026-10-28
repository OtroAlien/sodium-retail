// Contrato del estado de la demo: datos y acciones de todos los negocios.
import type {
  AccountEntry,
  AuditEntry,
  AutomationRun,
  BusinessId,
  CashSession,
  Client,
  Customer,
  Invoice,
  Lot,
  MpMovement,
  Outbox,
  Payment,
  PriceChange,
  Product,
  PurchaseLine,
  PurchaseOrder,
  Quote,
  ReceiptKind,
  RemoteSale,
  RentalIncident,
  RentalItem,
  RentalState,
  Reservation,
  ReservationLine,
  Sale,
  StockMovement,
  Supplier,
  SupplierEntry,
  SupplierPrice,
  SyncLogEntry,
  SyncOp,
  User,
} from '../types'

export type Page =
  | 'panel'
  | 'inicio'
  | 'venta'
  | 'caja'
  | 'ventas'
  | 'productos'
  | 'alertas'
  | 'compras'
  | 'clientes'
  | 'presupuestos'
  | 'mostrador'
  | 'reservas'
  | 'disponibilidad'
  | 'equipos'
  | 'comprobantes'
  | 'cobros'
  | 'reportes'
  | 'oportunidades'
  | 'automatizaciones'
  | 'asistente'
  | 'sincronizacion'
  | 'auditoria'
  | 'usuarios'

export interface CartLine {
  productId: string
  qty: number
  /** unidad de venta elegida (ferretería); vacía = unidad base */
  unitId?: string
  /** precio congelado (ej.: viene de un presupuesto vigente) */
  price?: number
}

/** carrito que otra pantalla deja preparado para la caja (ej.: un presupuesto aceptado) */
export interface PosDraft {
  lines: CartLine[]
  clientId?: string
  quoteId?: string
  discountPct?: number
}

export interface ReservationDraft {
  lines?: ReservationLine[]
  from?: string
  clientId?: string
}

export interface Inspection {
  itemId: string
  kind: RentalIncident['kind'] | null
}

export interface Data {
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

  clients: Client[]
  accounts: AccountEntry[]
  quotes: Quote[]
  quoteSeq: number

  suppliers: Supplier[]
  supplierPrices: SupplierPrice[]
  orders: PurchaseOrder[]
  poSeq: number
  supEntries: SupplierEntry[]

  rentalItems: RentalItem[]
  reservations: Reservation[]
  incidents: RentalIncident[]
  reservationSeq: number

  mp: MpMovement[]
  outbox: Outbox[]
  automationRuns: AutomationRun[]
  automations: Record<string, boolean>
  lastBackupAt: string
}

export interface Ui {
  currentUserId: string | null
  businessId: BusinessId
  page: Page
  realOnline: boolean
  simOffline: boolean
  arcaDown: boolean
  syncing: boolean
  lastSyncAt: string | null
  expiryWarnDays: number
  posDraft: PosDraft | null
  reservationDraft: ReservationDraft | null
  /** cliente a abrir al entrar a Clientes */
  focusClientId: string | null
  /** avisos de resultado de las acciones (no se guardan) */
  toasts: Toast[]
}

export interface Toast {
  id: string
  text: string
  tone: 'ok' | 'error' | 'info'
}

export interface SaleInput {
  cart: CartLine[]
  discountPct: number
  payments: Payment[]
  cashReceived?: number
  receiptKind: ReceiptKind
  customer?: Customer
  clientId?: string
  quoteId?: string
}

export interface ServiceInput {
  lines: { name: string; qty: number; unitPrice: number }[]
  payments: Payment[]
  receiptKind: ReceiptKind
  clientId?: string
  customer?: Customer
  source: Sale['source']
  reservationId?: string
  cashReceived?: number
}

export interface Actions {
  // sesión y demo
  login: (userId: string, pin: string) => string | null
  logout: () => void
  setBusiness: (b: BusinessId) => void
  setPage: (p: Page) => void
  goTo: (b: BusinessId, p: Page) => void
  setRealOnline: (v: boolean) => void
  setSimOffline: (v: boolean) => void
  setArcaDown: (v: boolean) => void
  setExpiryWarnDays: (n: number) => void
  resetDemo: () => void
  changePin: (oldPin: string, newPin: string) => string | null
  setOverride: (userId: string, perm: string, value: boolean | null) => void
  toggleBlock: (userId: string) => void
  addUser: (u: Omit<User, 'id' | 'blocked'>) => void

  // caja y ventas (M1, M5, A2)
  openSession: (amount: number, register: string, shift: string) => string | null
  addCashMovement: (type: 'retiro' | 'ingreso', amount: number, reason: string) => void
  closeSession: (counted: number) => void
  reopenSession: (id: string) => string | null
  completeSale: (p: SaleInput) => { sale?: Sale; error?: string }
  chargeService: (p: ServiceInput) => { sale?: Sale; error?: string }
  voidSale: (saleId: string, reason: string, authorizerId: string) => string | null
  retryPendingInvoices: () => void
  sendReceiptEmail: (saleId: string, email: string) => void
  reconcileMp: () => string
  setPosDraft: (d: PosDraft | null) => void

  // catálogo y stock (M2)
  adjustStock: (p: { productId: string; lotId: string | 'nuevo'; delta: number; reason: string; expiry?: string | null }) => string | null
  writeOffLot: (lotId: string) => void
  updatePrice: (productId: string, price: number) => void
  bulkPrice: (category: string | null, pct: number) => number
  addProduct: (p: Omit<Product, 'id' | 'businessId'>, qty: number, expiry: string | null) => void
  importProducts: (rows: { name: string; category: string; barcode: string | null; cost: number; price: number; minStock: number; qty: number }[]) => number
  assignBarcode: (productId: string, code: string) => string | null
  setPromo: (productIds: string[], pct: number, days: number, reason: string) => number

  // proveedores y compras (A1)
  createOrder: (supplierId: string, lines: PurchaseLine[], status: 'borrador' | 'enviada', auto?: boolean) => PurchaseOrder
  sendOrder: (orderId: string) => void
  receiveOrder: (orderId: string, invoiceRef: string, lines?: PurchaseLine[]) => string | null
  cancelOrder: (orderId: string) => void
  paySupplier: (supplierId: string, amount: number, method: string) => string | null
  generateReorders: () => number

  // clientes, cuentas corrientes y presupuestos
  addClient: (c: Omit<Client, 'id' | 'businessId' | 'createdAt'>) => Client
  updateClient: (id: string, patch: Partial<Client>) => void
  payAccount: (clientId: string, amount: number, method: Payment['method']) => string | null
  createQuote: (p: { cart: CartLine[]; clientId?: string; clientName: string; discountPct: number; note?: string; validDays: number }) => Quote
  setQuoteStatus: (id: string, status: Quote['status']) => void
  followUpQuote: (id: string) => void
  loadQuote: (id: string) => void
  sendMessage: (m: Omit<Outbox, 'id' | 'at'>) => void
  setFocusClient: (id: string | null) => void
  notify: (text: string, tone?: Toast['tone']) => void
  dismissToast: (id: string) => void

  // alquiler
  setReservationDraft: (d: ReservationDraft | null) => void
  createReservation: (p: { clientId: string; from: string; to: string; lines: ReservationLine[]; channel: Reservation['channel']; notes?: string; depositMethod: Payment['method'] }) => { reservation?: Reservation; error?: string }
  deliverReservation: (id: string, p: { itemIds: string[]; payMethod: Payment['method']; guaranteeMethod: 'efectivo' | 'tarjeta'; receiptKind: ReceiptKind }) => string | null
  returnReservation: (id: string, p: { inspections: Inspection[]; payMethod: Payment['method'] }) => { error?: string; extras?: number; refund?: number }
  cancelReservation: (id: string, refundDeposit: boolean) => string | null
  setItemState: (itemId: string, state: RentalState, note?: string) => void
  finishCleaning: (itemIds: string[]) => void

  // automatizaciones (simuladas)
  setAutomation: (id: string, enabled: boolean) => void
  runAutomation: (id: string) => string

  // sincronización (M4)
  syncNow: () => Promise<void>
  simulateRemoteSale: (productId: string, qty: number) => void
}

export type State = Data & Ui & Actions

export type SetState = (partial: Partial<State> | ((s: State) => Partial<State>)) => void
export type GetState = () => State
