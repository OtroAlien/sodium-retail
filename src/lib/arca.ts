// Simulación de los servicios de ARCA (padrón y emisión de comprobantes).
// En el sistema real esto lo hace el servidor contra los web services de ARCA.
import type { Customer } from '../types'
import { pad, toISODate } from './format'

export function isValidCuit(raw: string) {
  const c = raw.replace(/\D/g, '')
  if (c.length !== 11) return false
  const w = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const sum = w.reduce((acc, f, i) => acc + f * Number(c[i]), 0)
  let check = 11 - (sum % 11)
  if (check === 11) check = 0
  if (check === 10) check = 9
  return check === Number(c[10])
}

interface PadronEntry extends Customer {
  active: boolean
}

// Padrón de prueba. Cualquier otro CUIT válido devuelve un contribuyente genérico.
const padron: Record<string, PadronEntry> = {
  '30712345671': { name: 'Distribuidora Cuyo S.A.', ivaCondition: 'IVA Responsable Inscripto', address: 'Av. San Martín 1200, Mendoza', active: true },
  '20304050609': { name: 'Gómez Ramiro', ivaCondition: 'Responsable Monotributo', address: 'Belgrano 455, Godoy Cruz', active: true },
  '30709876542': { name: 'Bodega Los Andes S.R.L.', ivaCondition: 'IVA Responsable Inscripto', address: 'Ruta 40 km 32, Luján de Cuyo', active: true },
  '27222333445': { name: 'Pereyra Ana María', ivaCondition: 'IVA Responsable Inscripto', address: 'Colón 88, Mendoza', active: false },
}

export const demoCuits = Object.keys(padron)

export function lookupCuit(raw: string): (PadronEntry & { cuit: string }) | null {
  const c = raw.replace(/\D/g, '')
  if (!isValidCuit(c)) return null
  const hit = padron[c]
  if (hit) return { ...hit, cuit: c }
  return { cuit: c, name: `Contribuyente ${c.slice(2, 10)}`, ivaCondition: 'IVA Responsable Inscripto', active: true }
}

export function isCuitActive(raw?: string) {
  if (!raw) return true
  const hit = padron[raw.replace(/\D/g, '')]
  return hit ? hit.active : true
}

export function fakeCae() {
  let s = '7' + String(Math.floor(Math.random() * 9) + 1)
  while (s.length < 14) s += Math.floor(Math.random() * 10)
  return s
}

export function caeExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 10)
  return toISODate(d)
}

export const invoiceNumber = (pos: number, n: number | null) => `${pad(pos, 5)}-${n == null ? '--------' : pad(n, 8)}`

const kindCode: Record<string, number> = { 'Factura A': 1, 'Nota de crédito A': 3, 'Factura B': 6, 'Nota de crédito B': 8 }

/** URL del QR con el formato publicado por ARCA (datos de prueba) */
export function qrUrl(p: {
  date: string
  cuit: string
  pos: number
  kind: string
  number: number
  total: number
  customerCuit?: string
  cae: string
}) {
  const data = {
    ver: 1,
    fecha: p.date.slice(0, 10),
    cuit: Number(p.cuit.replace(/\D/g, '')),
    ptoVta: p.pos,
    tipoCmp: kindCode[p.kind] ?? 6,
    nroCmp: p.number,
    importe: Math.round(p.total * 100) / 100,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: p.customerCuit ? 80 : 99,
    nroDocRec: p.customerCuit ? Number(p.customerCuit) : 0,
    tipoCodAut: 'E',
    codAut: Number(p.cae),
  }
  return 'https://www.afip.gob.ar/fe/qr/?p=' + btoa(JSON.stringify(data))
}
