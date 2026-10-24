import { useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { useStore } from '../store'
import { businesses } from '../data/seed'
import { dateTime, toISODate } from '../lib/format'
import type { AuditAction } from '../types'
import { Card, Empty, Input, PageHeader, Rule, Select } from '../components/ui'

const ACTIONS: AuditAction[] = [
  'anulación',
  'descuento',
  'ajuste de stock',
  'cambio de precio',
  'apertura de caja',
  'cierre de caja',
  'reapertura de caja',
  'movimiento de caja',
  'alta de producto',
  'código de barras',
  'importación',
  'usuarios',
  'inicio de sesión',
]

export default function Auditoria() {
  const audit = useStore((s) => s.audit)
  const users = useStore((s) => s.users)
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState('')
  const [day, setDay] = useState('')

  const rows = useMemo(
    () => audit.filter((a) => (!userId || a.userId === userId) && (!action || a.action === action) && (!day || toISODate(new Date(a.at)) === day)),
    [audit, userId, action, day],
  )
  const name = (id: string) => users.find((u) => u.id === id)?.name ?? id

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Registro de auditoría" tag="M3" subtitle="Acciones sensibles con usuario, fecha, hora y valor anterior. Solo lectura." />
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </Select>
        <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <Card className="overflow-x-auto">
        {rows.length === 0 ? (
          <Empty>Sin registros con estos filtros. Las acciones sensibles aparecen acá apenas ocurren.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-5 py-3 font-bold">Fecha y hora</th>
                <th className="px-5 py-3 font-bold">Usuario</th>
                <th className="px-5 py-3 font-bold">Negocio</th>
                <th className="px-5 py-3 font-bold">Acción</th>
                <th className="px-5 py-3 font-bold">Detalle</th>
                <th className="px-5 py-3 font-bold">Antes → después</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-ink-900/[0.06] align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-400">{dateTime(a.at)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{name(a.userId)}</td>
                  <td className="px-4 py-2 text-ink-400">{a.businessId ? businesses[a.businessId].name : '—'}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium capitalize">{a.action}</td>
                  <td className="px-4 py-2">{a.detail}</td>
                  <td className="px-4 py-2 text-xs text-ink-400">{a.before || a.after ? `${a.before ?? '—'} → ${a.after ?? '—'}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <div className="mt-3 flex items-center gap-2">
        <Lock size={14} className="text-ink-300" />
        <Rule id="M3-R1">El registro no se puede editar ni borrar, ni siquiera por el Administrador. Esta pantalla no ofrece ninguna opción para hacerlo.</Rule>
      </div>
    </div>
  )
}
