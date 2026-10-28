import { useMemo, useState } from 'react'
import { Lock, SearchX } from 'lucide-react'
import { useStore } from '../store'
import { businesses } from '../data/seed'
import { dateTime, toISODate } from '../lib/format'
import type { AuditAction, AuditEntry } from '../types'
import { Button, Card, Empty, Input, PageHeader, Rule, Select } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'

const ACTIONS: AuditAction[] = [
  'anulación',
  'descuento',
  'ajuste de stock',
  'cambio de precio',
  'promoción',
  'apertura de caja',
  'cierre de caja',
  'reapertura de caja',
  'movimiento de caja',
  'alta de producto',
  'código de barras',
  'importación',
  'compra',
  'pago a proveedor',
  'cuenta corriente',
  'presupuesto',
  'reserva',
  'entrega',
  'devolución',
  'equipos',
  'clientes',
  'automatización',
  'usuarios',
  'inicio de sesión',
]

export default function Auditoria() {
  const audit = useStore((s) => s.audit)
  const users = useStore((s) => s.users)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [day, setDay] = useState('')

  const rows = useMemo(() => audit.filter((a) => (!userId || a.userId === userId) && (!action || a.action === action) && (!day || toISODate(new Date(a.at)) === day)), [audit, userId, action, day])
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? (id === 'sistema' ? 'Sistema' : id)
  const filtered = !!(userId || action || day)
  const shown = rows.slice(0, 300)

  const columns: Col<AuditEntry>[] = [
    { key: 'accion', header: 'Acción', mobile: 'title', className: 'whitespace-nowrap font-semibold capitalize text-white', cell: (a) => a.action },
    { key: 'fecha', header: 'Fecha y hora', mobile: 'value', className: 'whitespace-nowrap text-ink-200', cell: (a) => <span className="text-xs font-medium text-ink-200 sm:text-sm">{dateTime(a.at)}</span> },
    { key: 'detalle', header: 'Detalle', className: 'wrap-any min-w-[16rem]', cell: (a) => a.detail },
    { key: 'usuario', header: 'Usuario', className: 'whitespace-nowrap', cell: (a) => name(a.userId) },
    { key: 'negocio', header: 'Negocio', className: 'text-ink-200', cell: (a) => (a.businessId ? businesses[a.businessId].name : 'Todos') },
    { key: 'cambio', header: 'Antes → después', className: 'wrap-any text-ink-200', cell: (a) => (a.before || a.after ? `${a.before ?? '—'} → ${a.after ?? '—'}` : 'Sin cambio de valor') },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Registro de auditoría" tag="M3" subtitle="Acciones sensibles con usuario, fecha, hora y valor anterior. Es de solo lectura: no se puede editar ni borrar." />
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Select label="Usuario" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select label="Tipo de acción" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Input label="Día" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <p className="mb-2 text-sm text-ink-300" aria-live="polite">
        {rows.length} registro{rows.length === 1 ? '' : 's'}
        {rows.length > shown.length && ` · mostrando los últimos ${shown.length}`}
      </p>
      <Card>
        {rows.length === 0 ? (
          <Empty
            icon={<SearchX size={22} />}
            action={
              filtered && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setUserId('')
                    setAction('')
                    setDay('')
                  }}
                >
                  Quitar filtros
                </Button>
              )
            }
          >
            {filtered ? 'No hay registros con estos filtros.' : 'Todavía no hay registros. Las acciones sensibles (anulaciones, descuentos, cierres, cambios de precio) aparecen acá apenas ocurren.'}
          </Empty>
        ) : (
          <DataTable caption="Registro de auditoría" columns={columns} rows={shown} rowKey={(a) => a.id} />
        )}
      </Card>
      <div className="mt-3 flex items-start gap-2">
        <Lock size={16} className="mt-2.5 shrink-0 text-ink-300" aria-hidden />
        <Rule id="M3-R1">El registro no se puede editar ni borrar, ni siquiera por el Administrador. Esta pantalla no ofrece ninguna opción para hacerlo.</Rule>
      </div>
    </div>
  )
}
