import type { Role } from '../types'

// Matriz de la sección 06 de la especificación
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
}

export const can = (role: Role | undefined, p: Permission) => !!role && matrix[p].includes(role)

/** tope de descuento por rol, en % (a confirmar con el cliente, sección 16) */
export const discountCap = (role: Role | undefined) => (role === 'admin' ? 100 : role === 'encargado' ? 10 : 0)

export const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  encargado: 'Encargado',
  cajero: 'Cajero',
}
