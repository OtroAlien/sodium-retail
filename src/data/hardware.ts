// Catálogo de ejemplo de la ferretería: productos con variantes y distintas unidades de venta.
import type { Lot, Product, SaleUnit } from '../types'
import { ean13 } from './seed'

interface Group {
  group: string
  category: string
  baseUnit: string
  variants: { label: string; cost: number; price: number; stock: number; min: number }[]
  /** unidades de venta alternativas: [nombre, factor, descuento % sobre el precio base] */
  units?: [string, number, number][]
}

const groups: Group[] = [
  {
    group: 'Tornillo autoperforante punta mecha',
    category: 'Fijaciones',
    baseUnit: 'u',
    variants: [
      { label: '8 x 1/2"', cost: 28, price: 60, stock: 1850, min: 500 },
      { label: '8 x 3/4"', cost: 32, price: 70, stock: 1200, min: 500 },
      { label: '10 x 1"', cost: 45, price: 95, stock: 320, min: 400 },
      { label: '10 x 1 1/2"', cost: 58, price: 120, stock: 900, min: 300 },
    ],
    units: [['Caja x100', 100, 15]],
  },
  {
    group: 'Tarugo de nylon',
    category: 'Fijaciones',
    baseUnit: 'u',
    variants: [
      { label: '6 mm', cost: 18, price: 40, stock: 2400, min: 500 },
      { label: '8 mm', cost: 25, price: 55, stock: 1600, min: 500 },
      { label: '10 mm', cost: 38, price: 80, stock: 260, min: 300 },
    ],
    units: [['Bolsa x50', 50, 12]],
  },
  {
    group: 'Clavo punta París',
    category: 'Fijaciones',
    baseUnit: 'kg',
    variants: [
      { label: '1"', cost: 2900, price: 5200, stock: 22, min: 8 },
      { label: '2"', cost: 2700, price: 4900, stock: 35, min: 8 },
      { label: '3"', cost: 2600, price: 4700, stock: 6, min: 8 },
    ],
    units: [['1/2 kg', 0.5, 0]],
  },
  {
    group: 'Cable unipolar 2,5 mm²',
    category: 'Electricidad',
    baseUnit: 'm',
    variants: [
      { label: 'Rojo', cost: 420, price: 850, stock: 480, min: 200 },
      { label: 'Celeste', cost: 420, price: 850, stock: 390, min: 200 },
      { label: 'Verde-amarillo', cost: 430, price: 870, stock: 140, min: 200 },
    ],
    units: [['Rollo 100 m', 100, 10]],
  },
  {
    group: 'Lámpara LED',
    category: 'Electricidad',
    baseUnit: 'u',
    variants: [
      { label: '9 W luz fría', cost: 1100, price: 2200, stock: 64, min: 20 },
      { label: '9 W luz cálida', cost: 1100, price: 2200, stock: 41, min: 20 },
      { label: '15 W luz fría', cost: 1700, price: 3400, stock: 12, min: 15 },
    ],
    units: [['Pack x4', 4, 10]],
  },
  {
    group: 'Caño PVC 3,2 mm (tira 4 m)',
    category: 'Sanitarios',
    baseUnit: 'u',
    variants: [
      { label: '40 mm', cost: 5200, price: 9400, stock: 26, min: 10 },
      { label: '63 mm', cost: 7900, price: 14200, stock: 18, min: 10 },
      { label: '110 mm', cost: 13800, price: 24500, stock: 7, min: 8 },
    ],
  },
  {
    group: 'Manguera de jardín 1/2"',
    category: 'Jardín',
    baseUnit: 'm',
    variants: [{ label: 'Reforzada', cost: 650, price: 1300, stock: 210, min: 50 }],
    units: [['Rollo 25 m', 25, 12]],
  },
  {
    group: 'Látex interior',
    category: 'Pinturería',
    baseUnit: 'u',
    variants: [
      { label: 'Blanco 4 L', cost: 14500, price: 24900, stock: 16, min: 6 },
      { label: 'Blanco 10 L', cost: 32000, price: 54900, stock: 9, min: 4 },
      { label: 'Blanco 20 L', cost: 59000, price: 99900, stock: 3, min: 3 },
    ],
  },
  {
    group: 'Esmalte sintético 1 L',
    category: 'Pinturería',
    baseUnit: 'u',
    variants: [
      { label: 'Blanco brillante', cost: 7200, price: 12900, stock: 14, min: 5 },
      { label: 'Negro brillante', cost: 7200, price: 12900, stock: 11, min: 5 },
      { label: 'Rojo bermellón', cost: 7600, price: 13500, stock: 4, min: 4 },
    ],
  },
  {
    group: 'Lija al agua',
    category: 'Pinturería',
    baseUnit: 'u',
    variants: [
      { label: 'Grano 80', cost: 380, price: 750, stock: 140, min: 40 },
      { label: 'Grano 120', cost: 380, price: 750, stock: 95, min: 40 },
      { label: 'Grano 220', cost: 380, price: 750, stock: 30, min: 40 },
    ],
    units: [['Pack x10', 10, 15]],
  },
  {
    group: 'Llave combinada',
    category: 'Herramientas',
    baseUnit: 'u',
    variants: [
      { label: '10 mm', cost: 3200, price: 6200, stock: 9, min: 4 },
      { label: '13 mm', cost: 3600, price: 6900, stock: 7, min: 4 },
      { label: '17 mm', cost: 4300, price: 8200, stock: 3, min: 4 },
    ],
  },
  {
    group: 'Mecha acero rápido',
    category: 'Herramientas',
    baseUnit: 'u',
    variants: [
      { label: '6 mm', cost: 1500, price: 2900, stock: 25, min: 10 },
      { label: '8 mm', cost: 2100, price: 3900, stock: 18, min: 10 },
      { label: '10 mm', cost: 2900, price: 5400, stock: 6, min: 8 },
    ],
  },
  {
    group: 'Taladro percutor 650 W',
    category: 'Máquinas',
    baseUnit: 'u',
    variants: [{ label: 'Con maletín', cost: 62000, price: 98000, stock: 5, min: 2 }],
  },
  {
    group: 'Amoladora angular 115 mm',
    category: 'Máquinas',
    baseUnit: 'u',
    variants: [{ label: '850 W', cost: 54000, price: 86500, stock: 2, min: 2 }],
  },
  {
    group: 'Cemento Portland',
    category: 'Construcción',
    baseUnit: 'u',
    variants: [{ label: 'Bolsa 50 kg', cost: 8900, price: 12900, stock: 48, min: 20 }],
  },
  {
    group: 'Silicona acética 280 ml',
    category: 'Construcción',
    baseUnit: 'u',
    variants: [
      { label: 'Transparente', cost: 2900, price: 5400, stock: 22, min: 8 },
      { label: 'Blanca', cost: 2900, price: 5400, stock: 17, min: 8 },
    ],
  },
  {
    group: 'Guantes de trabajo',
    category: 'Seguridad',
    baseUnit: 'u',
    variants: [
      { label: 'Talle M', cost: 1900, price: 3600, stock: 30, min: 10 },
      { label: 'Talle L', cost: 1900, price: 3600, stock: 24, min: 10 },
      { label: 'Talle XL', cost: 1900, price: 3600, stock: 8, min: 10 },
    ],
  },
  {
    group: 'Candado de bronce',
    category: 'Cerrajería',
    baseUnit: 'u',
    variants: [
      { label: '40 mm', cost: 4800, price: 8900, stock: 12, min: 4 },
      { label: '50 mm', cost: 6400, price: 11800, stock: 8, min: 4 },
    ],
  },
]

const unitLabel: Record<string, string> = { u: 'Unidad', m: 'Metro', kg: 'Kilo', l: 'Litro' }

export function buildHardwareCatalog() {
  const products: Product[] = []
  const lots: Lot[] = []
  let n = 0
  groups.forEach((g, gi) => {
    g.variants.forEach((v, vi) => {
      n++
      const id = `p-ferreteria-${n}`
      const units: SaleUnit[] = [{ id: 'base', label: unitLabel[g.baseUnit], factor: 1, price: v.price }]
      for (const [label, factor, off] of g.units ?? []) {
        units.push({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, factor, price: Math.round((v.price * factor * (1 - off / 100)) / 10) * 10 })
      }
      products.push({
        id,
        businessId: 'ferreteria',
        name: `${g.group} ${v.label}`,
        group: g.group,
        variant: v.label,
        category: g.category,
        barcode: gi % 4 === 3 && vi === 0 ? null : ean13(1300 + n),
        cost: v.cost,
        price: v.price,
        minStock: v.min,
        tracksLots: false,
        baseUnit: g.baseUnit,
        units,
      })
      lots.push({ id: `l-ferreteria-${n}`, productId: id, qty: v.stock, expiry: null, code: 'Sin lote' })
    })
  })
  return { products, lots }
}
