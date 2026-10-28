import type { Role, User } from '../types'

// Matriz de la sección 06 de la especificación, más permisos de los módulos nuevos
export type Permission =
  | 'vender'
  | 'caja.propia'
  | 'venta.anular'
  | 'descuento'
  | 'precios.editar'
  | 'stock.ajustar'
  | 'caja.verTodas'
  | 'caja.reabrir'
  | 'costos.ver'
  | 'usuarios.gestionar'
  | 'auditoria.ver'
  | 'notaCredito.emitir'
  | 'codigo.asignar'
  | 'panel.conjunto'
  | 'compras.gestionar'
  | 'proveedores.pagar'
  | 'clientes.credito'
  | 'reportes.ver'
  | 'automatizaciones.gestionar'
  | 'equipos.gestionar'

const matrix: Record<Permission, Role[]> = {
  vender: ['admin', 'encargado', 'cajero'],
  'caja.propia': ['admin', 'encargado', 'cajero'],
  'venta.anular': ['admin', 'encargado'],
  descuento: ['admin', 'encargado'],
  'precios.editar': ['admin', 'encargado'],
  'stock.ajustar': ['admin', 'encargado'],
  'caja.verTodas': ['admin', 'encargado'],
  'caja.reabrir': ['admin', 'encargado'],
  'costos.ver': ['admin'],
  'usuarios.gestionar': ['admin'],
  'auditoria.ver': ['admin'],
  'notaCredito.emitir': ['admin', 'encargado'],
  'codigo.asignar': ['admin', 'encargado'],
  'panel.conjunto': ['admin'],
  'compras.gestionar': ['admin', 'encargado'],
  'proveedores.pagar': ['admin'],
  'clientes.credito': ['admin', 'encargado'],
  'reportes.ver': ['admin', 'encargado'],
  'automatizaciones.gestionar': ['admin', 'encargado'],
  'equipos.gestionar': ['admin', 'encargado'],
}

/** permisos que se pueden ajustar usuario por usuario desde la pantalla de usuarios */
export const ADJUSTABLE: { perm: Permission; label: string }[] = [
  { perm: 'descuento', label: 'Aplicar descuentos' },
  { perm: 'venta.anular', label: 'Anular ventas' },
  { perm: 'precios.editar', label: 'Editar precios' },
  { perm: 'stock.ajustar', label: 'Ajustar stock' },
  { perm: 'compras.gestionar', label: 'Registrar compras' },
  { perm: 'clientes.credito', label: 'Dar crédito en cuenta corriente' },
  { perm: 'reportes.ver', label: 'Ver reportes' },
]

/** acepta el rol o el usuario: con el usuario se tienen en cuenta sus ajustes personales */
export function can(subject: Role | User | undefined | null, p: Permission) {
  if (!subject) return false
  if (typeof subject === 'string') return matrix[p].includes(subject)
  const o = subject.overrides?.[p]
  if (typeof o === 'boolean' && subject.role !== 'admin') return o
  return matrix[p].includes(subject.role)
}

export const roleAllows = (role: Role, p: Permission) => matrix[p].includes(role)

/** tope de descuento por rol, en % (a confirmar con el cliente, sección 16) */
export const discountCap = (subject: Role | User | undefined | null) => {
  const role = typeof subject === 'string' ? subject : subject?.role
  const override = subject && typeof subject !== 'string' ? subject.overrides?.descuento : undefined
  if (role === 'admin') return 100
  if (override === false) return 0
  if (role === 'encargado') return 10
  // un cajero habilitado a mano tiene un tope menor
  return override ? 5 : 0
}

export const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
}
