// Catálogo, stock y precios (M2), incluidas las promociones.
import type { Lot, PriceChange, Product } from '../types'
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { addDays, money, uid } from '../lib/format'
import { can } from '../lib/permissions'
import { stockOf } from './selectors'

export function catalogSlice(set: SetState, get: GetState, h: Helpers) {
  return {
    adjustStock: ({ productId, lotId, delta, reason, expiry }) => {
      if (!can(h.me(), 'stock.ajustar')) return 'Tu usuario no puede ajustar stock'
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
      h.changeLot(targetId, delta)
      h.addMovement({ productId, lotId: targetId, delta, type: reason === 'Ingreso de mercadería' ? 'ingreso' : 'ajuste', reason })
      h.audit('ajuste de stock', `${p.name}: ${delta > 0 ? '+' : ''}${delta} · ${reason}`, String(before), String(before + delta))
      h.enqueue(`Ajuste de stock ${p.name} (${delta > 0 ? '+' : ''}${delta})`)
      h.notify(`Stock de ${p.name} actualizado (${delta > 0 ? '+' : ''}${delta}).`)
      return null
    },
    writeOffLot: (lotId) => {
      const lot = get().lots.find((l) => l.id === lotId)
      if (!lot || lot.qty <= 0) return
      get().adjustStock({ productId: lot.productId, lotId, delta: -lot.qty, reason: 'Vencido' })
    },
    updatePrice: (productId, price) => {
      if (!can(h.me(), 'precios.editar')) return
      const p = get().products.find((x) => x.id === productId)!
      if (p.price === price || price <= 0) return
      // M2-R4: rige desde que se guarda y conserva el historial
      const change: PriceChange = { id: uid('pc-'), productId, oldPrice: p.price, newPrice: price, at: now(), userId: get().currentUserId! }
      const ratio = price / p.price
      set((s) => ({
        products: s.products.map((x) =>
          x.id === productId
            ? // las unidades alternativas acompañan el cambio de precio base
              { ...x, price, units: x.units?.map((u) => (u.id === 'base' ? { ...u, price } : { ...u, price: Math.round((u.price * ratio) / 10) * 10 })) }
            : x,
        ),
        priceHistory: [change, ...s.priceHistory],
      }))
      h.audit('cambio de precio', p.name, money(p.price), money(price))
      h.enqueue(`Precio ${p.name} → ${money(price)}`)
      h.notify(`Precio de ${p.name} actualizado a ${money(price)}.`)
    },
    bulkPrice: (category, pct) => {
      if (!can(h.me(), 'precios.editar') || !pct) return 0
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
        products: s.products.map((x) => {
          const price = updated.get(x.id)
          if (!price) return x
          const ratio = price / x.price
          return { ...x, price, units: x.units?.map((u) => (u.id === 'base' ? { ...u, price } : { ...u, price: Math.round((u.price * ratio) / 10) * 10 })) }
        }),
        priceHistory: [...changes, ...s.priceHistory],
      }))
      h.audit('cambio de precio', `Cambio masivo ${pct > 0 ? '+' : ''}${pct}% en ${category ?? 'todas las categorías'} (${changes.length} productos)`)
      h.enqueue(`Cambio masivo de precios (${changes.length} productos)`)
      h.notify(`Precios actualizados: ${changes.length} productos.`)
      return changes.length
    },
    addProduct: (p, qty, expiry) => {
      const product: Product = { ...p, id: uid('p-'), businessId: get().businessId }
      const lot: Lot = { id: uid('l-'), productId: product.id, qty: 0, expiry, code: expiry ? `L${Math.floor(1000 + Math.random() * 8999)}` : 'Sin lote' }
      set((s) => ({ products: [...s.products, product], lots: [...s.lots, lot] }))
      if (qty) {
        h.changeLot(lot.id, qty)
        h.addMovement({ productId: product.id, lotId: lot.id, delta: qty, type: 'apertura', reason: 'Stock de apertura' })
      }
      h.audit('alta de producto', `${product.name} · ${money(product.price)} · stock inicial ${qty}`)
      h.enqueue(`Alta de producto ${product.name}`)
      h.notify(`Producto “${product.name}” creado.`)
    },
    importProducts: (rows) => {
      const biz = get().businessId
      const products: Product[] = []
      const lots: Lot[] = []
      for (const r of rows) {
        const id = uid('p-')
        products.push({ id, businessId: biz, name: r.name, category: r.category || 'Sin categoría', barcode: r.barcode, cost: r.cost, price: r.price, minStock: r.minStock, tracksLots: false, baseUnit: 'u' })
        lots.push({ id: uid('l-'), productId: id, qty: r.qty, expiry: null, code: 'Sin lote' })
      }
      set((s) => ({ products: [...s.products, ...products], lots: [...s.lots, ...lots] }))
      h.audit('importación', `Importación de planilla: ${rows.length} productos`)
      h.enqueue(`Importación de ${rows.length} productos`)
      h.notify(`${rows.length} productos importados.`)
      return rows.length
    },
    assignBarcode: (productId, code) => {
      if (!can(h.me(), 'codigo.asignar')) return 'Asignar códigos requiere Encargado o superior'
      const clash = get().products.find((p) => p.businessId === get().businessId && p.barcode === code)
      if (clash) return `Ese código ya pertenece a ${clash.name}`
      const p = get().products.find((x) => x.id === productId)!
      set((s) => ({ products: s.products.map((x) => (x.id === productId ? { ...x, barcode: code } : x)) }))
      h.audit('código de barras', `${p.name} ← ${code}`, p.barcode ?? 'sin código', code)
      h.enqueue(`Código de barras ${p.name}`)
      h.notify(`Código asignado a ${p.name}.`)
      return null
    },
    setPromo: (productIds, pct, days, reason) => {
      const until = addDays(days)
      let n = 0
      set((s) => ({
        products: s.products.map((p) => {
          if (!productIds.includes(p.id)) return p
          n++
          return { ...p, promoPrice: Math.round((p.price * (1 - pct / 100)) / 10) * 10, promoUntil: until }
        }),
      }))
      h.audit('promoción', `${pct}% off en ${n} producto${n === 1 ? '' : 's'} hasta el ${until.split('-').reverse().join('/')} · ${reason}`)
      h.enqueue(`Promoción en ${n} productos`)
      h.notify(`Promoción aplicada a ${n} producto${n === 1 ? '' : 's'}.`)
      return n
    },
  } satisfies Partial<Actions>
}
