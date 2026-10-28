// Historial de ejemplo: ventas de los últimos 30 días, cuentas corrientes, presupuestos,
// compras a proveedores y movimientos de Mercado Pago. Se genera igual en cada carga.
import type { AccountEntry, BusinessId, Client, MpMovement, Payment, Product, PurchaseOrder, Quote, Sale, Supplier, SupplierEntry, SupplierPrice } from '../types'
import { addDays } from '../lib/format'
import { rng } from './seed'

const HISTORY_DAYS = 30

interface Profile {
  perDay: number
  maxItems: number
  sellers: string[]
  /** proporción de ventas con cliente registrado */
  clientShare: number
  /** reparto de medios de pago: efectivo, transferencia, tarjeta, qr */
  pay: [number, number, number, number]
  hours: [number, number]
}

const PROFILES: Record<BusinessId, Profile> = {
  kiosco: { perDay: 30, maxItems: 3, sellers: ['u-laura', 'u-diego'], clientShare: 0.08, pay: [0.55, 0.2, 0.1, 0.15], hours: [7, 23] },
  super: { perDay: 40, maxItems: 7, sellers: ['u-sofia', 'u-lucas'], clientShare: 0.25, pay: [0.35, 0.2, 0.3, 0.15], hours: [8, 21] },
  ferreteria: { perDay: 22, maxItems: 4, sellers: ['u-ruben', 'u-carla'], clientShare: 0.5, pay: [0.3, 0.3, 0.3, 0.1], hours: [8, 19] },
  alquiler: { perDay: 6, maxItems: 2, sellers: ['u-nico', 'u-juli'], clientShare: 0.4, pay: [0.4, 0.2, 0.3, 0.1], hours: [8, 19] },
}

export function buildHistory(products: Product[], clients: Client[], suppliers: Supplier[], supplierPrices: SupplierPrice[]) {
  const sales: Sale[] = []
  const accounts: AccountEntry[] = []
  const mp: MpMovement[] = []
  const saleSeq: Record<BusinessId, number> = { kiosco: 0, super: 0, ferreteria: 0, alquiler: 0 }

  for (const biz of Object.keys(PROFILES) as BusinessId[]) {
    const prof = PROFILES[biz]
    const rand = rng(biz.length * 97 + 13)
    const catalog = products.filter((p) => p.businessId === biz)
    const bizClients = clients.filter((c) => c.businessId === biz)
    let n = 0
    // incluye hoy, hasta la hora actual, para que los tableros del día no arranquen en cero
    const now = Date.now()
    for (let day = HISTORY_DAYS; day >= 0; day--) {
      const d0 = new Date()
      d0.setDate(d0.getDate() - day)
      const weekend = d0.getDay() === 0 || d0.getDay() === 6
      const count = Math.round(prof.perDay * (weekend ? 1.25 : 0.9) * (0.8 + rand() * 0.4))
      for (let k = 0; k < count; k++) {
        const at = new Date(d0)
        // más movimiento al mediodía y a la tarde
        const h = prof.hours[0] + Math.floor(Math.pow(rand(), 0.85) * (prof.hours[1] - prof.hours[0]))
        at.setHours(h, Math.floor(rand() * 60), 0, 0)
        if (at.getTime() > now) continue
        const lines = 1 + Math.floor(rand() * prof.maxItems)
        const items: Sale['items'] = []
        for (let j = 0; j < lines; j++) {
          // los primeros productos se venden más (rotación desigual)
          const p = catalog[Math.floor(Math.pow(rand(), 1.7) * catalog.length)]
          if (items.some((i) => i.productId === p.id)) continue
          const unit = p.units && p.units.length > 1 && rand() < 0.25 ? p.units[1] : undefined
          const qty = unit ? 1 : p.baseUnit === 'm' ? 5 + Math.floor(rand() * 20) : p.baseUnit === 'u' && p.price < 200 ? 10 + Math.floor(rand() * 40) : 1 + Math.floor(rand() * 2)
          items.push({ productId: p.id, name: unit ? `${p.name} (${unit.label})` : p.name, qty, unitPrice: unit ? unit.price : p.price, allocations: [], unitLabel: unit?.label, factor: unit?.factor })
        }
        const total = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
        const client = rand() < prof.clientShare && bizClients.length ? bizClients[Math.floor(rand() * bizClients.length)] : undefined
        const inactive = client?.tags.includes('inactivo')
        if (inactive) continue
        let method: Payment['method']
        const r = rand()
        if (client && client.creditLimit > 0 && r < 0.45) method = 'cuenta_corriente'
        else if (r < prof.pay[0]) method = 'efectivo'
        else if (r < prof.pay[0] + prof.pay[1]) method = 'transferencia'
        else if (r < prof.pay[0] + prof.pay[1] + prof.pay[2]) method = 'tarjeta'
        else method = 'qr'
        n++
        const id = `s-hist-${biz}-${n}`
        const payment: Payment = { method, amount: total }
        if (method === 'tarjeta' || method === 'qr') payment.mpId = `MP-${biz.slice(0, 3).toUpperCase()}-${100000 + n}`
        sales.push({
          id,
          number: n,
          businessId: biz,
          sessionId: 'hist',
          userId: prof.sellers[Math.floor(rand() * prof.sellers.length)],
          at: at.toISOString(),
          items,
          subtotal: total,
          discountPct: 0,
          total,
          payments: [payment],
          receiptKind: client?.cuit ? 'A' : 'B',
          clientId: client?.id,
          status: 'completada',
          createdOffline: rand() < 0.12,
          source: 'pos',
          seeded: true,
        })
        if (method === 'cuenta_corriente' && client) {
          accounts.push({ id: `ae-${id}`, businessId: biz, clientId: client.id, at: at.toISOString(), type: 'cargo', amount: total, ref: `Venta #${n}` })
        }
        if ((method === 'tarjeta' || method === 'qr') && day <= 10) {
          const fee = Math.round(total * (method === 'tarjeta' ? 0.0329 : 0.0099) * 100) / 100
          mp.push({ id: payment.mpId!, businessId: biz, at: at.toISOString(), amount: total, fee, method, saleId: id, status: day <= 1 ? 'pendiente' : 'acreditado', match: 'ok', description: `Venta #${n}` })
        }
      }
    }
    saleSeq[biz] = n

    // pagos de cuenta corriente: cada cliente paga una parte de lo que debe cada diez días, como una libreta
    for (const c of bizClients.filter((x) => x.creditLimit > 0)) {
      const share = c.tags.includes('libreta') ? 0.5 : 0.7
      for (const ago of [20, 10]) {
        const at = new Date()
        at.setDate(at.getDate() - ago)
        at.setHours(11, 0, 0, 0)
        const balance = accounts
          .filter((a) => a.clientId === c.id && new Date(a.at).getTime() < at.getTime())
          .reduce((x, e) => x + (e.type === 'cargo' ? e.amount : -e.amount), 0)
        const amount = Math.floor((balance * share) / 100) * 100
        if (amount <= 0) continue
        accounts.push({ id: `ae-pay-${c.id}-${ago}`, businessId: biz, clientId: c.id, at: at.toISOString(), type: 'pago', amount, ref: 'Pago a cuenta', method: ago === 10 ? 'transferencia' : 'efectivo' })
      }
    }
  }

  // discrepancias para mostrar la conciliación con Mercado Pago (A2)
  const lastCard = [...sales].reverse().find((s) => s.businessId === 'super' && s.payments[0].method === 'tarjeta')
  if (lastCard) {
    // una venta cobrada con tarjeta que no aparece acreditada
    const i = mp.findIndex((m) => m.saleId === lastCard.id)
    if (i >= 0) mp.splice(i, 1)
  }
  const y = new Date()
  y.setDate(y.getDate() - 1)
  y.setHours(19, 42, 0, 0)
  mp.push({ id: 'MP-SUP-999001', businessId: 'super', at: y.toISOString(), amount: 18450, fee: 607, method: 'qr', status: 'acreditado', match: 'sin venta', description: 'Pago con QR sin venta asociada' })
  const ferreCard = [...sales].reverse().find((s) => s.businessId === 'ferreteria' && s.payments[0].method === 'tarjeta')
  if (ferreCard) {
    const m = mp.find((x) => x.saleId === ferreCard.id)
    if (m) {
      m.amount = Math.round(m.amount * 0.9)
      m.match = 'diferencia'
      m.description = `${m.description} (importe distinto)`
    }
  }

  // presupuestos de la ferretería
  const rand = rng(303)
  const hw = products.filter((p) => p.businessId === 'ferreteria')
  const hwClients = clients.filter((c) => c.businessId === 'ferreteria')
  const quotes: Quote[] = []
  const quoteDefs: [number, Quote['status'], number][] = [
    // [días atrás, estado, cliente]
    [1, 'abierto', 0],
    [4, 'abierto', 6],
    [6, 'abierto', 4],
    [2, 'abierto', 3],
    [9, 'aceptado', 1],
    [12, 'aceptado', 0],
    [18, 'vencido', 7],
    [21, 'rechazado', 5],
  ]
  quoteDefs.forEach(([ago, status, ci], i) => {
    const items = Array.from({ length: 3 + Math.floor(rand() * 4) }, () => {
      const p = hw[Math.floor(rand() * hw.length)]
      const unit = p.units && p.units.length > 1 && rand() < 0.5 ? p.units[1] : p.units?.[0]
      const qty = unit && unit.factor > 1 ? 1 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 6)
      return { productId: p.id, name: p.name, qty, unitId: unit?.id, unitLabel: unit?.label, unitPrice: unit?.price ?? p.price }
    }).filter((it, idx, arr) => arr.findIndex((x) => x.productId === it.productId) === idx)
    const total = items.reduce((a, it) => a + it.qty * it.unitPrice, 0)
    const c = hwClients[ci]
    quotes.push({
      id: `q-${i + 1}`,
      number: 410 + i,
      businessId: 'ferreteria',
      clientId: c.id,
      clientName: c.name,
      at: addDays(-ago) + 'T10:30:00',
      validUntil: addDays(15 - ago),
      items,
      discountPct: c.tags.includes('empresa') ? 5 : 0,
      total: Math.round(total * (c.tags.includes('empresa') ? 0.95 : 1)),
      status,
      userId: i % 2 ? 'u-carla' : 'u-ruben',
      followUps: ago > 3 && status === 'abierto' ? 0 : 1,
      note: i === 0 ? 'Obra Barrio Dalvian: materiales para instalación eléctrica' : undefined,
    })
  })

  // compras recibidas, pagos a proveedores y una orden enviada pendiente de recibir
  const orders: PurchaseOrder[] = []
  const supEntries: SupplierEntry[] = []
  let po = 120
  for (const s of suppliers) {
    const own = supplierPrices.filter((sp) => sp.supplierId === s.id)
    if (!own.length) continue
    for (let k = 0; k < 2; k++) {
      const ago = 25 - k * 12 - Math.floor(rand() * 4)
      const lines = own.slice(k * 3, k * 3 + 4).map((sp) => ({ productId: sp.productId, qty: 6 + Math.floor(rand() * 30), cost: sp.cost }))
      if (!lines.length) continue
      const total = lines.reduce((a, l) => a + l.qty * l.cost, 0)
      const id = `po-${po}`
      orders.push({ id, number: po++, businessId: s.businessId, supplierId: s.id, at: addDays(-ago - s.leadDays) + 'T09:00:00', lines, total, status: 'recibida', receivedAt: addDays(-ago) + 'T15:00:00', invoiceRef: `FC A 0003-${String(10000 + po).padStart(8, '0')}`, userId: 'u-admin' })
      supEntries.push({ id: `se-${id}`, businessId: s.businessId, supplierId: s.id, at: addDays(-ago) + 'T15:00:00', type: 'compra', amount: total, ref: `OC #${po - 1}` })
    }
    const owed = supEntries.filter((e) => e.supplierId === s.id).reduce((a, e) => a + e.amount, 0)
    const share = s.paymentTerms.startsWith('Contado') || s.paymentTerms === 'Anticipado' ? 1 : 0.6
    supEntries.push({ id: `se-pay-${s.id}`, businessId: s.businessId, supplierId: s.id, at: addDays(-6) + 'T12:00:00', type: 'pago', amount: Math.round((owed * share) / 100) * 100, ref: 'Pago a proveedor', method: 'Transferencia' })
  }
  const pending = suppliers.find((s) => s.businessId === 'ferreteria' && s.categories.includes('Electricidad'))
  if (pending) {
    const lines = supplierPrices.filter((sp) => sp.supplierId === pending.id).slice(0, 4).map((sp) => ({ productId: sp.productId, qty: 100, cost: sp.cost }))
    orders.push({ id: `po-${po}`, number: po++, businessId: 'ferreteria', supplierId: pending.id, at: addDays(-1) + 'T10:00:00', lines, total: lines.reduce((a, l) => a + l.qty * l.cost, 0), status: 'enviada', userId: 'u-ruben' })
  }

  return { sales, accounts, mp, saleSeq, quotes, quoteSeq: 410 + quoteDefs.length, orders, poSeq: po, supEntries }
}
