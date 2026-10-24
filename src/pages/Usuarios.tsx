import { useState } from 'react'
import { Check, Minus, UserPlus } from 'lucide-react'
import { useMe, useStore } from '../store'
import { businesses } from '../data/seed'
import { roleLabel } from '../lib/permissions'
import type { BusinessId, Role } from '../types'
import { Badge, Button, Card, Input, Modal, PageHeader, Rule, Select } from '../components/ui'

const MATRIX: [string, string, string, string][] = [
  ['Vender y cobrar', 'Sí', 'Sí', 'Sí'],
  ['Abrir y cerrar su caja', 'Sí', 'Sí', 'Sí'],
  ['Anular una venta', 'Sí', 'Sí', 'No'],
  ['Aplicar descuentos', 'Sí', 'Hasta 10%', 'No'],
  ['Ver y editar precios', 'Sí', 'Sí', 'Solo ver'],
  ['Ajustar stock con motivo', 'Sí', 'Sí', 'No'],
  ['Ver cierres de todas las cajas', 'Sí', 'Sí', 'Solo la propia'],
  ['Ver costos y márgenes', 'Sí', 'No', 'No'],
  ['Gestionar usuarios y roles', 'Sí', 'No', 'No'],
  ['Ver el registro de auditoría', 'Sí', 'No', 'No'],
  ['Emitir notas de crédito', 'Sí', 'Sí', 'No'],
]

function Cell({ v }: { v: string }) {
  if (v === 'Sí') return <Check size={16} className="mx-auto text-emerald-600" />
  if (v === 'No') return <Minus size={16} className="mx-auto text-ink-200" />
  return <span className="text-xs text-amber-700">{v}</span>
}

export default function Usuarios() {
  const me = useMe()!
  const users = useStore((s) => s.users)
  const toggleBlock = useStore((s) => s.toggleBlock)
  const addUser = useStore((s) => s.addUser)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', role: 'cajero' as Role, businessId: 'kiosco' as BusinessId, pin: '' })

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Usuarios y roles"
        tag="M3"
        subtitle="Cada persona ve y hace solo lo que le corresponde."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus size={16} /> Nuevo usuario
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas/60 text-left text-[11px] uppercase tracking-wider text-ink-400">
              <tr>
                <th className="px-5 py-3 font-bold">Usuario</th>
                <th className="px-5 py-3 font-bold">Rol</th>
                <th className="px-5 py-3 font-bold">Negocio</th>
                <th className="px-5 py-3 font-bold">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-ink-900/[0.06] transition-colors hover:bg-brand-50/40">
                  <td className="px-5 py-3.5 font-bold">{u.name}</td>
                  <td className="px-5 py-3.5">{roleLabel[u.role]}</td>
                  <td className="px-5 py-3.5 text-ink-600">{u.businessId ? businesses[u.businessId].name : 'Ambos'}</td>
                  <td className="px-5 py-3.5">{u.blocked ? <Badge tone="red">Bloqueado</Badge> : <Badge tone="green">Activo</Badge>}</td>
                  <td className="px-5 py-3.5 text-right">
                    {u.id !== me.id && (
                      <Button size="sm" variant="ghost" onClick={() => toggleBlock(u.id)}>
                        {u.blocked ? 'Desbloquear' : 'Bloquear'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1.5 p-3">
            <Rule id="M3-R2">Un usuario bloqueado no puede iniciar sesión, pero su historial se conserva.</Rule>
            <Rule id="M3-R3">Cada usuario pertenece a un negocio, salvo el Administrador, que accede a ambos.</Rule>
          </div>
        </Card>

        <Card className="overflow-x-auto">
          <div className="border-b border-ink-900/[0.06] px-4 py-3 font-semibold">Permisos por rol</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-400">
              <tr>
                <th className="px-3 py-2 text-left font-bold">Acción</th>
                <th className="px-2 py-2 font-bold">Admin.</th>
                <th className="px-2 py-2 font-bold">Encarg.</th>
                <th className="px-2 py-2 font-bold">Cajero</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map(([a, ...v]) => (
                <tr key={a} className="border-t border-ink-900/[0.06]">
                  <td className="px-3 py-1.5 text-ink-700">{a}</td>
                  {v.map((x, i) => (
                    <td key={i} className="px-2 py-1.5 text-center">
                      <Cell v={x} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo usuario"
        footer={
          <Button
            disabled={!f.name.trim() || !/^\d{4}$/.test(f.pin)}
            onClick={() => {
              addUser({ name: f.name.trim(), role: f.role, businessId: f.role === 'admin' ? null : f.businessId, pin: f.pin })
              setF({ ...f, name: '', pin: '' })
              setOpen(false)
            }}
          >
            Crear usuario
          </Button>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Input label="Nombre y apellido" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </div>
          <Select label="Rol" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="cajero">Cajero</option>
            <option value="encargado">Encargado</option>
            <option value="admin">Administrador</option>
          </Select>
          <Select label="Negocio" value={f.businessId} disabled={f.role === 'admin'} onChange={(e) => setF({ ...f, businessId: e.target.value as BusinessId })}>
            <option value="kiosco">Kiosco</option>
            <option value="super">Supermercado</option>
          </Select>
          <Input label="PIN de 4 dígitos" inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} />
        </div>
      </Modal>
    </div>
  )
}
