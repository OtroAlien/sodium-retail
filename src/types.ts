export type BusinessId = 'kiosco' | 'super' | 'ferreteria' | 'alquiler'
/** rubro: define qué procesos y pantallas usa cada negocio */
export type BusinessKind = 'retail' | 'hardware' | 'rental'
export type Role = 'admin' | 'encargado' | 'cajero'

export interface Business {
  id: BusinessId
  kind: BusinessKind
  name: string
  legalName: string
  cuit: string
  ivaCondition: string
  address: string
  pointOfSale: number
  transferAccounts: string[]
  /** color de identificación en el panel general */
  color: string
}

export interface User {
  id: string
  name: string
  role: Role
  /** null = Administrador, accede a todos los negocios (M3-R3) */
  businessId: BusinessId | null
  pin: string
  blocked: boolean
  /** ajustes de permisos por usuario sobre los de su rol (M3) */
  overrides?: Record<string, boolean>
}

/** unidad de venta: cuántas unidades base representa y a qué precio se vende */
export interface SaleUnit {
  id: string
  label: string
  factor: number
  price: number
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
  /** unidad en la que se lleva el stock (u, m, kg, l) */
  baseUnit?: string
  /** formas de venta alternativas (caja x100, metro, kg…) */
  units?: SaleUnit[]
  /** producto padre para variantes (ej.: "Tornillo autoperforante") */
  group?: string
  /** variante dentro del grupo (ej.: "8 x 1/2\"") */
  variant?: string
  /** precio promocional temporal */
  promoPrice?: number
  promoUntil?: string
}

export interface Lot {
  id: string
  productId: string
  qty: number
  /** fecha ISO (yyyy-mm-dd) o null si el producto no vence */
  expiry: string | null
  code: string
}

export type StockMoveType = 'venta' | 'anulacion' | 'ajuste' | 'apertura' | 'ingreso' | 'otra-caja' | 'compra'

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
  /** vacío en cobros de servicios (alquileres, recargos, señas) */
  productId?: string
  name: string
  qty: number
  unitPrice: number
  allocations: { lotId: string; qty: number }[]
  unitLabel?: string
  /** unidades base que descuenta cada unidad vendida */
  factor?: number
}

export type PayMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'qr' | 'cuenta_corriente'

export interface Payment {
  method: PayMethod
  amount: number
  account?: string
  /** id de la operación en Mercado Pago (simulado) */
  mpId?: string
  cardBrand?: string
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
  /** cliente registrado (historial y cuenta corriente) */
  clientId?: string
  status: 'completada' | 'anulada'
  voidReason?: string
  voidedBy?: string
  voidAuthorizedBy?: string
  voidedAt?: string
  invoiceId?: string
  creditNoteId?: string
  createdOffline: boolean
  /** origen de la venta */
  source?: 'pos' | 'presupuesto' | 'alquiler' | 'cobranza'
  quoteId?: string
  reservationId?: string
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

// ───────── Clientes y cuentas corrientes ─────────

export interface Client {
  id: string
  businessId: BusinessId
  name: string
  phone: string
  email?: string
  cuit?: string
  ivaCondition: string
  address?: string
  /** 0 = sin cuenta corriente */
  creditLimit: number
  tags: string[]
  createdAt: string
  notes?: string
  /** talles y medidas habituales (alquiler) */
  sizes?: { calzado?: string; altura?: number; ropa?: string }
}

export interface AccountEntry {
  id: string
  businessId: BusinessId
  clientId: string
  at: string
  type: 'cargo' | 'pago'
  amount: number
  ref: string
  method?: PayMethod
}

// ───────── Presupuestos (ferretería) ─────────

export interface QuoteItem {
  productId: string
  name: string
  qty: number
  unitId?: string
  unitLabel?: string
  unitPrice: number
}

export interface Quote {
  id: string
  number: number
  businessId: BusinessId
  clientId?: string
  clientName: string
  at: string
  validUntil: string
  items: QuoteItem[]
  discountPct: number
  total: number
  status: 'abierto' | 'aceptado' | 'vencido' | 'rechazado'
  saleId?: string
  userId: string
  followUps: number
  note?: string
}

// ───────── Proveedores y compras (A1) ─────────

export interface Supplier {
  id: string
  businessId: BusinessId
  name: string
  cuit: string
  phone: string
  email: string
  paymentTerms: string
  /** días que tarda en entregar */
  leadDays: number
  categories: string[]
}

export interface SupplierPrice {
  supplierId: string
  productId: string
  cost: number
  at: string
}

export interface PurchaseLine {
  productId: string
  qty: number
  cost: number
  expiry?: string | null
}

export interface PurchaseOrder {
  id: string
  number: number
  businessId: BusinessId
  supplierId: string
  at: string
  lines: PurchaseLine[]
  total: number
  status: 'borrador' | 'enviada' | 'recibida' | 'cancelada'
  receivedAt?: string
  invoiceRef?: string
  /** generada por la automatización de reposición */
  auto?: boolean
  userId: string
}

export interface SupplierEntry {
  id: string
  businessId: BusinessId
  supplierId: string
  at: string
  type: 'compra' | 'pago'
  amount: number
  ref: string
  method?: string
}

// ───────── Alquiler de esquí y snowboard ─────────

export type RentalType = 'Esquí' | 'Bastones' | 'Botas de esquí' | 'Snowboard' | 'Botas de snowboard' | 'Casco' | 'Antiparras' | 'Campera' | 'Pantalón' | 'Guantes'

export type RentalState = 'disponible' | 'alquilado' | 'limpieza' | 'mantenimiento' | 'dañado' | 'baja'

export interface RentalItem {
  id: string
  code: string
  type: RentalType
  size: string
  brand: string
  condition: 'nuevo' | 'muy bueno' | 'bueno' | 'regular'
  state: RentalState
  uses: number
  /** valor de reposición, para daños y faltantes */
  value: number
  lastServiceAt?: string
  stateSince: string
  notes?: string
}

export interface ReservationLine {
  type: RentalType
  size: string
  qty: number
}

export type ReservationStatus = 'reservada' | 'entregada' | 'devuelta' | 'cancelada'

export interface Reservation {
  id: string
  number: number
  clientId: string
  from: string
  to: string
  lines: ReservationLine[]
  days: number
  subtotal: number
  discountPct: number
  total: number
  /** seña cobrada al reservar */
  deposit: number
  /** depósito en garantía al retirar */
  guarantee: number
  guaranteeMethod?: 'efectivo' | 'tarjeta'
  guaranteeReturned?: number
  status: ReservationStatus
  channel: 'mostrador' | 'whatsapp' | 'web'
  createdAt: string
  deliveredAt?: string
  returnedAt?: string
  itemIds: string[]
  lateFee?: number
  damageFee?: number
  notes?: string
  seeded?: boolean
}

export interface RentalIncident {
  id: string
  reservationId: string
  itemId: string
  kind: 'suciedad' | 'daño leve' | 'daño grave' | 'faltante'
  charge: number
  at: string
  note?: string
}

// ───────── Cobros digitales (A2) ─────────

export interface MpMovement {
  id: string
  businessId: BusinessId
  at: string
  amount: number
  fee: number
  method: 'tarjeta' | 'qr'
  saleId?: string
  status: 'acreditado' | 'pendiente' | 'rechazado'
  /** resultado de la conciliación */
  match?: 'ok' | 'sin venta' | 'diferencia'
  description: string
}

// ───────── Automatizaciones y mensajes ─────────

export interface Outbox {
  id: string
  businessId: BusinessId | null
  at: string
  channel: 'WhatsApp' | 'Email'
  to: string
  subject: string
  body: string
  automation?: string
}

export interface AutomationRun {
  id: string
  ruleId: string
  businessId: BusinessId | null
  at: string
  summary: string
}

// ───────── Auditoría y sincronización ─────────

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
  | 'compra'
  | 'pago a proveedor'
  | 'cuenta corriente'
  | 'presupuesto'
  | 'reserva'
  | 'entrega'
  | 'devolución'
  | 'equipos'
  | 'clientes'
  | 'automatización'
  | 'promoción'

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
