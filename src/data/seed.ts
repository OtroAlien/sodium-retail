// Datos de ejemplo para la demo. Todo es ficticio.
import type { Business, BusinessId, Lot, Product, User } from '../types'
import { addDays } from '../lib/format'

export const BUSINESS_IDS: BusinessId[] = ['kiosco', 'super', 'ferreteria', 'alquiler']

export const businesses: Record<BusinessId, Business> = {
  kiosco: {
    id: 'kiosco',
    kind: 'retail',
    name: 'Kiosco',
    legalName: 'Kiosco Minimarket (demo)',
    cuit: '20123456786',
    ivaCondition: 'IVA Responsable Inscripto',
    address: 'Av. Arístides Villanueva 410, Mendoza',
    pointOfSale: 1,
    transferAccounts: ['Alias KIOSCO.MZA (Mercado Pago)', 'CBU Banco Nación ···4521'],
    color: '#BF8A24',
  },
  super: {
    id: 'super',
    kind: 'retail',
    name: 'Supermercado',
    legalName: 'Supermercado (demo)',
    cuit: '30714567892',
    ivaCondition: 'IVA Responsable Inscripto',
    address: 'Calle San Juan 1550, Mendoza',
    pointOfSale: 2,
    transferAccounts: ['Alias SUPER.MZA.CAJA (Banco Galicia)', 'Alias SUPER.MZA (Mercado Pago)'],
    color: '#2EA57C',
  },
  ferreteria: {
    id: 'ferreteria',
    kind: 'hardware',
    name: 'Ferretería',
    legalName: 'Ferretería (demo)',
    cuit: '30716543217',
    ivaCondition: 'IVA Responsable Inscripto',
    address: 'Av. San Martín Sur 2380, Godoy Cruz',
    pointOfSale: 3,
    transferAccounts: ['Alias FERRE.MZA (Banco Macro)', 'Alias FERRE.MP (Mercado Pago)'],
    color: '#E0654A',
  },
  alquiler: {
    id: 'alquiler',
    kind: 'rental',
    name: 'Ski & Snowboard',
    legalName: 'Alquiler Ski & Snowboard (demo)',
    cuit: '20287654328',
    ivaCondition: 'IVA Responsable Inscripto',
    address: 'Ruta 82, Potrerillos (camino a Penitentes)',
    pointOfSale: 4,
    transferAccounts: ['Alias SKI.RENTAL.MZA (Mercado Pago)'],
    color: '#5B8EE6',
  },
}

export const seedUsers: User[] = [
  { id: 'u-admin', name: 'Martín Ferreyra', role: 'admin', businessId: null, pin: '1111', blocked: false },
  { id: 'u-laura', name: 'Laura Quiroga', role: 'encargado', businessId: 'kiosco', pin: '2222', blocked: false },
  { id: 'u-diego', name: 'Diego Sosa', role: 'cajero', businessId: 'kiosco', pin: '3333', blocked: false },
  { id: 'u-sofia', name: 'Sofía Herrera', role: 'encargado', businessId: 'super', pin: '4444', blocked: false },
  { id: 'u-lucas', name: 'Lucas Morales', role: 'cajero', businessId: 'super', pin: '5555', blocked: false },
  { id: 'u-pablo', name: 'Pablo Díaz', role: 'cajero', businessId: 'super', pin: '6666', blocked: true },
  { id: 'u-ruben', name: 'Rubén Gil', role: 'encargado', businessId: 'ferreteria', pin: '7777', blocked: false },
  { id: 'u-carla', name: 'Carla Ortiz', role: 'cajero', businessId: 'ferreteria', pin: '8888', blocked: false, overrides: { descuento: true } },
  { id: 'u-nico', name: 'Nicolás Vera', role: 'encargado', businessId: 'alquiler', pin: '9999', blocked: false },
  { id: 'u-juli', name: 'Julieta Ríos', role: 'cajero', businessId: 'alquiler', pin: '1234', blocked: false },
]

// [nombre, categoría, ¿tiene código cargado?, costo, precio, stock mínimo, lotes [cantidad, días hasta vencer | null]]
export type Row = [string, string, boolean, number, number, number, [number, number | null][]]

const kioscoRows: Row[] = [
  ['Coca-Cola 500 ml', 'Bebidas', true, 900, 1500, 24, [[48, 120]]],
  ['Coca-Cola 2,25 L', 'Bebidas', true, 2100, 3400, 12, [[20, 90]]],
  ['Sprite 500 ml', 'Bebidas', true, 880, 1450, 12, [[30, 110]]],
  ['Agua mineral 500 ml', 'Bebidas', true, 450, 900, 24, [[60, 300]]],
  ['Agua saborizada pomelo 1,5 L', 'Bebidas', true, 900, 1600, 12, [[18, 60]]],
  ['Speed 250 ml', 'Bebidas', true, 1000, 1800, 12, [[24, 200]]],
  ['Cerveza lata 473 ml', 'Bebidas', true, 1200, 2100, 24, [[36, 150]]],
  ['Alfajor triple chocolate', 'Golosinas', true, 650, 1200, 30, [[12, 4], [40, 75]]],
  ['Alfajor simple dulce de leche', 'Golosinas', true, 450, 850, 30, [[55, 60]]],
  ['Chicles menta x10', 'Golosinas', true, 300, 600, 20, [[80, 365]]],
  ['Caramelos masticables x100 g', 'Golosinas', true, 500, 950, 10, [[25, 200]]],
  ['Chocolate con leche 80 g', 'Golosinas', true, 1300, 2300, 15, [[8, -2], [22, 90]]],
  ['Turrón de maní', 'Golosinas', false, 200, 450, 30, [[70, 120]]],
  ['Papas fritas 80 g', 'Snacks', true, 1100, 1900, 15, [[26, 45]]],
  ['Maní salado 120 g', 'Snacks', true, 700, 1300, 10, [[6, 100]]],
  ['Palitos salados 100 g', 'Snacks', true, 650, 1150, 10, [[18, 80]]],
  ['Galletitas de agua 150 g', 'Almacén', true, 600, 1100, 12, [[20, 120]]],
  ['Galletitas dulces rellenas', 'Almacén', true, 750, 1350, 12, [[15, 6], [10, 95]]],
  ['Yerba mate 500 g', 'Almacén', true, 2400, 3900, 8, [[12, null]]],
  ['Azúcar 1 kg', 'Almacén', true, 1100, 1800, 6, [[9, null]]],
  ['Leche entera 1 L', 'Lácteos', true, 1000, 1650, 12, [[10, 2], [14, 9]]],
  ['Yogur bebible frutilla 1 L', 'Lácteos', true, 1500, 2500, 6, [[4, -1], [8, 12]]],
  ['Pan lactal blanco', 'Panificados', false, 1700, 2800, 5, [[7, 3]]],
  ['Encendedor', 'Varios', true, 500, 1000, 10, [[3, null]]],
  ['Pilas AA x2', 'Varios', true, 1600, 2900, 6, [[14, null]]],
  ['Pañuelos descartables', 'Varios', false, 350, 700, 10, [[30, null]]],
]

const superRows: Row[] = [
  ['Aceite de girasol 1,5 L', 'Almacén', true, 2600, 4200, 10, [[24, null]]],
  ['Arroz largo fino 1 kg', 'Almacén', true, 1300, 2100, 12, [[40, null]]],
  ['Fideos tallarines 500 g', 'Almacén', true, 800, 1400, 20, [[60, 240]]],
  ['Harina 0000 1 kg', 'Almacén', true, 700, 1150, 15, [[35, 180]]],
  ['Puré de tomate 520 g', 'Almacén', true, 650, 1100, 20, [[48, 400]]],
  ['Yerba mate 1 kg', 'Almacén', true, 4500, 7200, 10, [[18, null]]],
  ['Café molido 250 g', 'Almacén', true, 3200, 5200, 6, [[4, 200]]],
  ['Atún al natural 170 g', 'Almacén', true, 1800, 2900, 12, [[30, 600]]],
  ['Leche entera 1 L', 'Lácteos', true, 1000, 1600, 24, [[20, 3], [36, 10]]],
  ['Yogur firme vainilla x4', 'Lácteos', true, 1900, 3100, 10, [[6, 1], [12, 14]]],
  ['Queso cremoso x kg', 'Lácteos', false, 7500, 11500, 4, [[8, 20]]],
  ['Manteca 200 g', 'Lácteos', true, 2100, 3300, 8, [[3, -3], [10, 40]]],
  ['Dulce de leche 400 g', 'Lácteos', true, 2000, 3200, 8, [[16, 120]]],
  ['Huevos blancos x12', 'Frescos', false, 2800, 4300, 10, [[15, 8]]],
  ['Jamón cocido x kg', 'Fiambrería', false, 9000, 14500, 3, [[5, 6]]],
  ['Salchichas x6', 'Fiambrería', true, 1500, 2500, 10, [[14, 18]]],
  ['Pan lactal integral', 'Panificados', true, 1900, 3100, 6, [[9, 4]]],
  ['Gaseosa cola 2,25 L', 'Bebidas', true, 2000, 3300, 24, [[50, 100]]],
  ['Agua mineral 2 L', 'Bebidas', true, 800, 1400, 24, [[70, 300]]],
  ['Vino tinto Malbec 750 ml', 'Bebidas', true, 3500, 6500, 12, [[30, null]]],
  ['Cerveza 1 L retornable', 'Bebidas', true, 1700, 2900, 24, [[40, 120]]],
  ['Detergente 750 ml', 'Limpieza', true, 1400, 2400, 10, [[22, null]]],
  ['Lavandina 2 L', 'Limpieza', true, 1100, 1900, 10, [[7, null]]],
  ['Papel higiénico x4', 'Limpieza', true, 2200, 3600, 12, [[28, null]]],
  ['Jabón en polvo 800 g', 'Limpieza', true, 3300, 5300, 6, [[11, null]]],
  ['Shampoo 400 ml', 'Perfumería', true, 3000, 4900, 6, [[9, null]]],
  ['Pasta dental 90 g', 'Perfumería', true, 1500, 2500, 8, [[5, null]]],
  ['Desodorante aerosol', 'Perfumería', false, 2600, 4200, 6, [[13, null]]],
  ['Banana x kg', 'Verdulería', false, 1300, 2200, 10, [[25, 4]]],
  ['Papa x kg', 'Verdulería', false, 700, 1200, 20, [[60, 15]]],
]

// el local de alquiler también vende accesorios
const alquilerRows: Row[] = [
  ['Cuello polar', 'Accesorios', true, 4500, 9000, 6, [[18, null]]],
  ['Medias térmicas de esquí', 'Accesorios', true, 5200, 9800, 8, [[24, null]]],
  ['Guantes de nieve (venta)', 'Accesorios', true, 9500, 17500, 4, [[9, null]]],
  ['Protector solar FPS 50', 'Cuidado', true, 6800, 11900, 6, [[14, 300]]],
  ['Protector labial', 'Cuidado', true, 2100, 4200, 10, [[30, 400]]],
  ['Cera para tablas', 'Servicio', true, 3500, 7500, 5, [[12, null]]],
  ['Gorro de lana', 'Accesorios', true, 5500, 10500, 6, [[3, null]]],
  ['Calentadores de manos x2', 'Accesorios', true, 1800, 3900, 10, [[40, 500]]],
]

/** EAN-13 argentino (779) con dígito verificador correcto */
export function ean13(seed: number) {
  const base = '779' + String(1000000000 + seed * 7919).slice(-9)
  const sum = base.split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0)
  return base + ((10 - (sum % 10)) % 10)
}

function build(businessId: BusinessId, rows: Row[], offset: number) {
  const products: Product[] = []
  const lots: Lot[] = []
  rows.forEach(([name, category, hasCode, cost, price, minStock, lotRows], i) => {
    const id = `p-${businessId}-${i + 1}`
    const tracksLots = lotRows.some(([, exp]) => exp !== null)
    products.push({ id, businessId, name, category, barcode: hasCode ? ean13(offset + i) : null, cost, price, minStock, tracksLots, baseUnit: 'u' })
    lotRows.forEach(([qty, exp], j) => {
      lots.push({
        id: `l-${businessId}-${i + 1}-${j + 1}`,
        productId: id,
        qty,
        expiry: exp === null ? null : addDays(exp),
        code: exp === null ? 'Sin lote' : `L${String(240 + i * 3 + j).padStart(4, '0')}`,
      })
    })
  })
  return { products, lots }
}

export function buildRetailCatalog() {
  const k = build('kiosco', kioscoRows, 100)
  const s = build('super', superRows, 500)
  const a = build('alquiler', alquilerRows, 900)
  return { products: [...k.products, ...s.products, ...a.products], lots: [...k.lots, ...s.lots, ...a.lots] }
}

/** generador pseudoaleatorio con semilla, para que la demo siempre arranque igual */
export function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}
