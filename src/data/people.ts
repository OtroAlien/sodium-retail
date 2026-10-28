// Clientes y proveedores de ejemplo por negocio. Nombres, teléfonos y CUIT ficticios.
import type { BusinessId, Client, Product, Supplier, SupplierPrice } from '../types'
import { addDays } from '../lib/format'
import { rng } from './seed'

type C = [name: string, phone: string, extra?: Partial<Client>]

const raw: Record<BusinessId, C[]> = {
  kiosco: [
    ['Graciela Pérez', '261 455-1023', { creditLimit: 60000, tags: ['libreta', 'vecina'] }],
    ['Matías Lucero', '261 587-3301', { tags: ['frecuente'] }],
    ['Estudiantes UNCuyo (centro)', '261 600-1200', { tags: ['institucional'] }],
    ['Ramón Funes', '261 499-8711', { creditLimit: 40000, tags: ['libreta'] }],
    ['Carolina Videla', '261 610-2290', { tags: [] }],
    ['Taxi Base Central', '261 423-0000', { creditLimit: 80000, tags: ['empresa'] }],
  ],
  super: [
    ['María Elena Castro', '261 455-9081', { tags: ['frecuente', 'compra semanal'] }],
    ['Jorge Ibáñez', '261 532-7712', { tags: ['frecuente'] }],
    ['Restaurante El Olivo', '261 429-5500', { creditLimit: 400000, cuit: '30712345671', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa', 'factura A'] }],
    ['Silvia Romero', '261 600-4410', { tags: [] }],
    ['Familia Aguirre', '261 512-8820', { creditLimit: 120000, tags: ['cuenta corriente'] }],
    ['Lucía Benítez', '261 677-1199', { tags: ['nueva'] }],
    ['Hostel Andes', '261 420-3344', { creditLimit: 250000, cuit: '30709876542', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa', 'factura A'] }],
    ['Fernando Toledo', '261 555-6611', { tags: [] }],
    ['Paula Godoy', '261 432-1180', { tags: ['frecuente'] }],
    ['Daniel Ruiz', '261 690-2201', { tags: ['inactivo'] }],
  ],
  ferreteria: [
    ['Constructora Cuyo S.R.L.', '261 431-9090', { creditLimit: 1500000, cuit: '30712345671', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa', 'obra', 'factura A'] }],
    ['Electricista Hugo Molina', '261 588-1234', { creditLimit: 300000, cuit: '20304050609', ivaCondition: 'Responsable Monotributo', tags: ['profesional'] }],
    ['Plomería Sánchez', '261 611-0042', { creditLimit: 250000, tags: ['profesional'] }],
    ['Andrea Miranda', '261 455-7766', { tags: [] }],
    ['Consorcio Edificio Sarmiento', '261 420-8800', { creditLimit: 500000, cuit: '30709876542', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa', 'factura A'] }],
    ['Gustavo Reta', '261 590-3321', { tags: ['frecuente'] }],
    ['Pinturas & Reformas MZA', '261 602-7713', { creditLimit: 400000, tags: ['profesional'] }],
    ['Verónica Cáceres', '261 571-0099', { tags: ['nueva'] }],
    ['Marcelo Ojeda', '261 499-2002', { tags: ['inactivo'] }],
    ['Bodega Las Tapias', '261 438-1515', { creditLimit: 800000, cuit: '30712345671', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa'] }],
  ],
  alquiler: [
    ['Familia Gómez (4 personas)', '11 5544-2210', { tags: ['turista', 'familia'], sizes: { calzado: '40', altura: 172, ropa: 'M' } }],
    ['Agustín Peralta', '261 611-4433', { tags: ['frecuente', 'snowboard'], sizes: { calzado: '43', altura: 181, ropa: 'L' } }],
    ['Camila Ferraro', '11 6201-7788', { tags: ['turista'], sizes: { calzado: '37', altura: 160, ropa: 'S' } }],
    ['Colegio San Andrés (viaje)', '261 420-1111', { cuit: '30709876542', ivaCondition: 'IVA Exento', tags: ['grupo', 'institucional'], creditLimit: 900000 }],
    ['Tomás Becerra', '351 455-2010', { tags: ['turista', 'temporada pasada'], sizes: { calzado: '42', altura: 178, ropa: 'L' } }],
    ['Valentina Sosa', '261 699-3030', { tags: ['frecuente', 'esquí'], sizes: { calzado: '38', altura: 165, ropa: 'M' } }],
    ['Hotel Potrerillos', '261 482-0505', { cuit: '30712345671', ivaCondition: 'IVA Responsable Inscripto', tags: ['empresa', 'convenio'], creditLimit: 1200000 }],
    ['Santiago Lema', '11 4033-9876', { tags: ['turista', 'temporada pasada'], sizes: { calzado: '44', altura: 186, ropa: 'XL' } }],
    ['Julia Montenegro', '341 600-1212', { tags: ['temporada pasada'], sizes: { calzado: '36', altura: 158, ropa: 'S' } }],
    ['Bruno Castillo', '261 512-4040', { tags: ['snowboard'], sizes: { calzado: '41', altura: 175, ropa: 'M' } }],
    ['Lorena Vázquez', '11 3322-5566', { tags: ['turista', 'familia'], sizes: { calzado: '38', altura: 163, ropa: 'M' } }],
    ['Martín Escobar', '261 577-8800', { tags: ['temporada pasada', 'esquí'], sizes: { calzado: '42', altura: 179, ropa: 'L' } }],
  ],
}

export function buildClients(): Client[] {
  const out: Client[] = []
  for (const [biz, list] of Object.entries(raw) as [BusinessId, C[]][]) {
    list.forEach(([name, phone, extra], i) => {
      out.push({
        id: `c-${biz}-${i + 1}`,
        businessId: biz,
        name,
        phone,
        email: name.toLowerCase().split(' ')[0].normalize('NFD').replace(/[^a-z]/g, '') + '@ejemplo.com',
        ivaCondition: 'Consumidor final',
        creditLimit: 0,
        tags: [],
        createdAt: addDays(-(30 + i * 23)),
        ...extra,
      })
    })
  }
  return out
}

type S = [name: string, cuit: string, terms: string, leadDays: number, categories: string[]]

const rawSuppliers: Partial<Record<BusinessId, S[]>> = {
  kiosco: [
    ['Embotelladora Andina', '30500000017', 'Contado contra entrega', 2, ['Bebidas']],
    ['Distribuidora Golosinas del Sol', '30600000024', 'Cuenta corriente 15 días', 3, ['Golosinas', 'Snacks']],
    ['Mayorista Mendoza', '30700000031', 'Cuenta corriente 30 días', 2, ['Almacén', 'Lácteos', 'Panificados', 'Varios']],
  ],
  super: [
    ['Lácteos del Valle', '30500000158', 'Cuenta corriente 15 días', 1, ['Lácteos', 'Frescos', 'Fiambrería']],
    ['Molinos Cuyanos', '30600000165', 'Cuenta corriente 30 días', 4, ['Almacén']],
    ['Distribuidora Bebidas Oeste', '30700000172', 'Contado', 2, ['Bebidas']],
    ['Limpieza Total S.A.', '30800000189', 'Cuenta corriente 30 días', 5, ['Limpieza', 'Perfumería']],
    ['Verdulería Mayorista Guaymallén', '20300000196', 'Contado', 1, ['Verdulería', 'Panificados']],
  ],
  ferreteria: [
    ['Bulonera Industrial Cuyo', '30500000204', 'Cuenta corriente 30 días', 3, ['Fijaciones', 'Herramientas', 'Cerrajería', 'Seguridad']],
    ['Electro Cables S.R.L.', '30600000211', 'Cuenta corriente 15 días', 2, ['Electricidad']],
    ['Pinturerías Distribución MZA', '30700000228', 'Cuenta corriente 30 días', 2, ['Pinturería']],
    ['Corralón Los Andes', '30800000235', 'Contado', 1, ['Construcción', 'Sanitarios', 'Jardín']],
    ['Importadora Herramientas Pro', '30900000242', 'Anticipado', 10, ['Máquinas', 'Herramientas']],
  ],
  alquiler: [['Snow Gear Distribuidora', '30500000301', 'Cuenta corriente 30 días', 7, ['Accesorios', 'Cuidado', 'Servicio']]],
}

export function buildSuppliers(products: Product[]) {
  const suppliers: Supplier[] = []
  const prices: SupplierPrice[] = []
  const rand = rng(41)
  for (const [biz, list] of Object.entries(rawSuppliers) as [BusinessId, S[]][]) {
    list.forEach(([name, cuit, paymentTerms, leadDays, categories], i) => {
      suppliers.push({
        id: `sup-${biz}-${i + 1}`,
        businessId: biz,
        name,
        cuit,
        paymentTerms,
        leadDays,
        categories,
        phone: `261 4${String(10 + i)}-${String(1000 + i * 137).slice(0, 4)}`,
        email: `ventas@${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14)}.com.ar`,
      })
    })
  }
  // cada producto tiene un proveedor principal (último costo = costo actual) y a veces uno alternativo
  for (const p of products) {
    const own = suppliers.filter((s) => s.businessId === p.businessId)
    const main = own.find((s) => s.categories.includes(p.category)) ?? own[0]
    if (!main) continue
    prices.push({ supplierId: main.id, productId: p.id, cost: p.cost, at: addDays(-Math.floor(5 + rand() * 40)) })
    const alt = own.find((s) => s.id !== main.id && s.categories.some((c) => c === p.category || rand() < 0.08))
    if (alt && rand() < 0.45) prices.push({ supplierId: alt.id, productId: p.id, cost: Math.round(p.cost * (0.94 + rand() * 0.14)), at: addDays(-Math.floor(10 + rand() * 60)) })
  }
  return { suppliers, prices }
}
