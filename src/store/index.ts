// Estado de la demo. Simula la base local de cada caja (M4): todo se guarda en el
// navegador, así que cerrar la app o apagar el equipo no pierde nada (M4-R4).
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { buildRetailCatalog, seedUsers } from '../data/seed'
import { buildHardwareCatalog } from '../data/hardware'
import { buildClients, buildSuppliers } from '../data/people'
import { buildRental, rentalSales } from '../data/rental'
import { buildHistory } from '../data/history'
import type { AuditEntry } from '../types'
import { DEFAULT_ENABLED } from '../lib/automations'
import { createHelpers } from './helpers'
import { coreSlice } from './core'
import { salesSlice } from './sales'
import { catalogSlice } from './catalog'
import { purchasingSlice } from './purchasing'
import { customersSlice } from './customers'
import { rentalSlice } from './rental'
import { automationSlice } from './automation'
import type { Data, State } from './state'
import { kindOf as kindOfBusiness } from './selectors'

export type { Page, CartLine, State } from './state'
export * from './selectors'

function initialData(): Data {
  const retail = buildRetailCatalog()
  const hardware = buildHardwareCatalog()
  const products = [...retail.products, ...hardware.products]
  const lots = [...retail.lots, ...hardware.lots]
  const clients = buildClients()
  const { suppliers, prices } = buildSuppliers(products)
  const rental = buildRental(clients)
  const hist = buildHistory(products, clients, suppliers, prices)
  const rentalHist = rentalSales(rental.reservations, hist.saleSeq.alquiler)
  hist.sales.push(...rentalHist)
  hist.saleSeq.alquiler += rentalHist.length
  const backup = new Date()
  backup.setHours(3, 0, 0, 0)
  return {
    users: seedUsers,
    products,
    lots,
    movements: [],
    priceHistory: [],
    sessions: [],
    sales: hist.sales,
    invoices: [],
    audit: [
      ['u-laura', 'kiosco', 'apertura de caja', 'Caja 1 · turno mañana · fondo inicial $ 20.000,00', 9, 5],
      ['u-diego', 'kiosco', 'descuento', 'Descuento del 10% en una venta de $ 4.800,00', 7, 40],
      ['u-sofia', 'super', 'ajuste de stock', 'Yerba mate 1 kg: se descuentan 2 unidades por rotura', 6, 15],
      ['u-ruben', 'ferreteria', 'cambio de precio', 'Cable unipolar 2,5 mm (metro): $ 520,00 → $ 560,00', 5, 30],
      ['u-admin', null, 'usuarios', 'Se revisaron los permisos de Pablo Díaz (bloqueado)', 3, 10],
      ['u-laura', 'kiosco', 'cierre de caja', 'Caja 1 · turno tarde · diferencia $ 0,00', 1, 20],
    ].map(([userId, businessId, action, detail, h, m], i) => {
      const at = new Date()
      at.setHours(at.getHours() - Number(h) - 1, at.getMinutes() - Number(m))
      return { id: `a-seed-${i}`, at: at.toISOString(), userId, businessId, action, detail } as AuditEntry
    }),
    queue: [],
    syncLog: [],
    remoteSales: [],
    saleSeq: hist.saleSeq,
    invoiceSeq: {
      'kiosco-Factura B': 1840,
      'kiosco-Factura A': 212,
      'kiosco-Nota de crédito B': 37,
      'kiosco-Nota de crédito A': 4,
      'super-Factura B': 5321,
      'super-Factura A': 640,
      'super-Nota de crédito B': 88,
      'super-Nota de crédito A': 9,
      'ferreteria-Factura B': 2210,
      'ferreteria-Factura A': 1385,
      'ferreteria-Nota de crédito B': 21,
      'ferreteria-Nota de crédito A': 17,
      'alquiler-Factura B': 960,
      'alquiler-Factura A': 74,
      'alquiler-Nota de crédito B': 6,
      'alquiler-Nota de crédito A': 1,
    },
    clients,
    accounts: hist.accounts,
    quotes: hist.quotes,
    quoteSeq: hist.quoteSeq,
    suppliers,
    supplierPrices: prices,
    orders: hist.orders,
    poSeq: hist.poSeq,
    supEntries: hist.supEntries,
    rentalItems: rental.items,
    reservations: rental.reservations,
    incidents: rental.incidents,
    reservationSeq: rental.reservationSeq,
    mp: hist.mp,
    outbox: [],
    automationRuns: [],
    automations: DEFAULT_ENABLED,
    lastBackupAt: backup.toISOString(),
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const h = createHelpers(set, get)
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
        posDraft: null,
        reservationDraft: null,
        focusClientId: null,
        toasts: [],
        ...coreSlice(set, get, h, initialData),
        ...salesSlice(set, get, h),
        ...catalogSlice(set, get, h),
        ...purchasingSlice(set, get, h),
        ...customersSlice(set, get, h),
        ...rentalSlice(set, get, h),
        ...automationSlice(set, get, h),
      }
    },
    {
      name: 'sodium-demo-v2',
      // las ventas históricas se regeneran en cada carga: solo se guardan las nuevas
      partialize: (s) => {
        const { realOnline: _r, syncing: _s, toasts: _t, ...rest } = s
        return { ...rest, sales: s.sales.filter((x) => !x.seeded) }
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined
        if (!p) return current
        return { ...current, ...p, sales: [...(p.sales ?? []), ...current.sales.filter((x) => x.seeded)] }
      },
    },
  ),
)

export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.currentUserId))
export const useOnline = () => useStore((s) => s.realOnline && !s.simOffline)
export const useKind = () => useStore((s) => kindOfBusiness(s.businessId))
