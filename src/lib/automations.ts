import type { BusinessKind } from '../types'

export interface AutomationDef {
  id: string
  title: string
  description: string
  /** cuándo se ejecutaría sola en el sistema real */
  schedule: string
  kinds: BusinessKind[]
  /** se ejecuta para todos los negocios (solo Administrador) */
  global?: boolean
  output: string
}

export const AUTOMATIONS: AutomationDef[] = [
  {
    id: 'resumen-diario',
    title: 'Resumen diario al dueño',
    description: 'Ventas, caja y alertas de todos los negocios en un solo mensaje.',
    schedule: 'Todos los días a las 21:00',
    kinds: ['retail', 'hardware', 'rental'],
    global: true,
    output: 'WhatsApp al dueño',
  },
  {
    id: 'reposicion',
    title: 'Pedido sugerido a proveedores',
    description: 'Cuando un producto baja del stock mínimo arma una orden en borrador con el proveedor de menor costo.',
    schedule: 'Cada vez que el stock baja del mínimo',
    kinds: ['retail', 'hardware'],
    output: 'Órdenes de compra en borrador',
  },
  {
    id: 'vencimientos',
    title: 'Promo automática por vencimiento',
    description: 'Los lotes que vencen en 3 días o menos pasan a 20% de descuento para venderlos antes de perderlos.',
    schedule: 'Todos los días a las 7:00',
    kinds: ['retail'],
    output: 'Precio promocional en caja',
  },
  {
    id: 'cuentas-corrientes',
    title: 'Recordatorio de cuenta corriente',
    description: 'Avisa a los clientes con saldo de más de 15 días, con el detalle y los medios de pago.',
    schedule: 'Lunes a las 10:00',
    kinds: ['retail', 'hardware', 'rental'],
    output: 'WhatsApp a clientes',
  },
  {
    id: 'presupuestos',
    title: 'Seguimiento de presupuestos',
    description: 'Los presupuestos abiertos hace 3 días o más reciben un mensaje de seguimiento.',
    schedule: 'Todos los días a las 11:00',
    kinds: ['hardware'],
    output: 'WhatsApp a clientes',
  },
  {
    id: 'inactivos',
    title: 'Reactivación de clientes',
    description: 'Clientes que no compran hace más de 30 días reciben un cupón de 10%.',
    schedule: 'Primer día de cada semana',
    kinds: ['retail', 'hardware'],
    output: 'WhatsApp a clientes',
  },
  {
    id: 'recordatorio-retiro',
    title: 'Recordatorio de retiro',
    description: 'El día anterior al retiro: horario, saldo a pagar, depósito y talles reservados.',
    schedule: 'Todos los días a las 18:00',
    kinds: ['rental'],
    output: 'WhatsApp a clientes',
  },
  {
    id: 'recordatorio-devolucion',
    title: 'Recordatorio de devolución y demoras',
    description: 'Avisa a quienes devuelven hoy y a quienes ya están atrasados, con el recargo que corre.',
    schedule: 'Todos los días a las 9:00',
    kinds: ['rental'],
    output: 'WhatsApp a clientes',
  },
  {
    id: 'limpieza',
    title: 'Control de limpieza',
    description: 'Avisa al encargado si hay prendas en limpieza desde hace más de un día.',
    schedule: 'Todos los días a las 8:00',
    kinds: ['rental'],
    output: 'Aviso al encargado',
  },
  {
    id: 'reactivacion-temporada',
    title: 'Preventa de temporada',
    description: 'Invita a los clientes de la temporada pasada a reservar con 10% de descuento.',
    schedule: 'Al abrir la preventa',
    kinds: ['rental'],
    output: 'WhatsApp a clientes',
  },
]

export const DEFAULT_ENABLED: Record<string, boolean> = Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.id !== 'reactivacion-temporada']))
