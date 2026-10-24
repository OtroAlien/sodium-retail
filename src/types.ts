export type BusinessId = 'kiosco' | 'super'
export type Role = 'admin' | 'encargado' | 'cajero'

export interface Business {
  id: BusinessId
  name: string
  legalName: string
  cuit: string
  ivaCondition: string
  address: string
  pointOfSale: number
  transferAccounts: string[]
}

export interface User {
  id: string
  name: string
  role: Role
  /** null = Administrador, accede a ambos negocios (M3-R3) */
  businessId: BusinessId | null
  pin: string
  blocked: boolean
}

export interface Product {
  id: string
  businessId: BusinessId
  name: string
  category: string
  barcode: string | null
  cost: number
  price: number
  minStock: number
  /** controla stock por lote con vencimiento */
  tracksLots: boolean
}

export interface Lot {
  id: string
  productId: string
  qty: number
  /** fecha ISO (yyyy-mm-dd) o null si el producto no vence */
  expiry: string | null
  code: string
}

export type StockMoveType = 'venta' | 'anulacion' | 'ajuste' | 'apertura' | 'ingreso' | 'otra-caja'

export interface StockMovement {
  id: string
  businessId: BusinessId
  productId: string
  lotId: string
  delta: number
  type: StockMoveType
  reason?: string
  at: string
  userId: string
  refId?: string
}

export interface PriceChange {
  id: string
  productId: string
  oldPrice: number
  newPrice: number
  at: string
  userId: string
  note?: string
}

export interface CashMovement {
  id: string
  type: 'retiro' | 'ingreso'
  amount: number
  reason: string
  at: string
}

export interface CashSession {
  id: string
  businessId: BusinessId
  userId: string
  register: string
  shift: string
  openedAt: string
  openingAmount: number
  movements: CashMovement[]
  closedAt?: string
  expectedAmount?: number
  countedAmount?: number
  closedBy?: string
  reopenedBy?: string
}

export interface SaleItem {
  productId: string
  name: string
  qty: number
  unitPrice: number
  allocations: { lotId: string; qty: number }[]
}

export type PayMethod = 'efectivo' | 'transferencia'

export interface Payment {
  method: PayMethod
  amount: number
  account?: string
}

export type ReceiptKind = 'ticket' | 'B' | 'A'

export interface Customer {
  cuit?: string
  name: string
  ivaCondition: string
  address?: string
}

export interface Sale {
  id: string
  number: number
  businessId: BusinessId
  sessionId: string
  userId: string
  at: string
  items: SaleItem[]
  subtotal: number
  discountPct: number
  total: number
  payments: Payment[]
  cashReceived?: number
  change?: number
  receiptKind: ReceiptKind
  customer?: Customer
  status: 'completada' | 'anulada'
  voidReason?: string
  voidedBy?: string
  voidAuthorizedBy?: string
  voidedAt?: string
  invoiceId?: string
  creditNoteId?: string
  createdOffline: boolean
  /** venta histórica generada para la demo */
  seeded?: boolean
}

export type InvoiceKind = 'Factura A' | 'Factura B' | 'Nota de crédito A' | 'Nota de crédito B'
export type InvoiceStatus = 'emitido' | 'pendiente' | 'rechazado'

export interface Invoice {
  id: string
  businessId: BusinessId
  saleId: string
  kind: InvoiceKind
  pointOfSale: number
  number: number | null
  status: InvoiceStatus
  cae?: string
  caeExpiry?: string
  customer: Customer
  total: number
  createdAt: string
  issuedAt?: string
  attempts: number
  lastError?: string
  relatedInvoiceId?: string
}

export interface AuditEntry {
  id: string
  at: string
  userId: string
  businessId: BusinessId | null
  action: AuditAction
  detail: string
  before?: string
  after?: string
}

export type AuditAction =
  | 'inicio de sesión'
  | 'apertura de caja'
  | 'cierre de caja'
  | 'reapertura de caja'
  | 'movimiento de caja'
  | 'anulación'
  | 'descuento'
  | 'ajuste de stock'
  | 'cambio de precio'
  | 'alta de producto'
  | 'código de barras'
  | 'usuarios'
  | 'importación'
  | 'sincronización'

export interface SyncOp {
  id: string
  businessId: BusinessId
  label: string
  at: string
}

export interface SyncLogEntry {
  id: string
  at: string
  text: string
  kind: 'ok' | 'conflicto' | 'info'
}

/** Venta hecha por otra caja sin conexión, que llega al sincronizar (demo M4) */
export interface RemoteSale {
  id: string
  businessId: BusinessId
  register: string
  productId: string
  qty: number
  at: string
}
