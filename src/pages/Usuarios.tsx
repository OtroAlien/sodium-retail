import { useState } from 'react'
import { Check, KeyRound, Minus, SlidersHorizontal, UserPlus } from 'lucide-react'
import { useMe, useStore } from '../store'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { ADJUSTABLE, can, roleAllows, roleLabel } from '../lib/permissions'
import type { BusinessId, Role, User } from '../types'
import { Badge, Button, Card, Input, Modal, PageHeader, Rule, ScrollArea, Select, cx, useGuard } from '../components/ui'
import { SectionTitle } from '../components/common'
import { useConfirm } from '../components/feedback'
import { BusinessDot } from '../components/Layout'

const MATRIX: [string, string, string, string][] = [
  ['Vender y cobrar', 'Sí', 'Sí', 'Sí'],
  ['Abrir y cerrar su caja', 'Sí', 'Sí', 'Sí'],
  ['Anular una venta', 'Sí', 'Sí', 'No'],
  ['Aplicar descuentos', 'Sí', 'Hasta 10%', 'No'],
  ['Ver y editar precios', 'Sí', 'Sí', 'Solo ver'],
  ['Ajustar stock con motivo', 'Sí', 'Sí', 'No'],
  ['Ver cierres de todas las cajas', 'Sí', 'Sí', 'Solo la propia'],
  ['Registrar compras', 'Sí', 'Sí', 'No'],
  ['Pagar a proveedores', 'Sí', 'No', 'No'],
  ['Dar crédito en cuenta corriente', 'Sí', 'Sí', 'No'],
  ['Ver reportes y oportunidades', 'Sí', 'Sí', 'No'],
  ['Ver costos y márgenes', 'Sí', 'No', 'No'],
  ['Gestionar usuarios y permisos', 'Sí', 'No', 'No'],
  ['Ver el registro de auditoría', 'Sí', 'No', 'No'],
  ['Ver todos los negocios (panel general)', 'Sí', 'No', 'No'],
]

function Cell({ v }: { v: string }) {
  if (v === 'Sí')
    return (
      <span className="inline-flex items-center gap-1 text-emerald-300">
        <Check size={15} aria-hidden /> Sí
      </span>
    )
  if (v === 'No')
    return (
      <span className="inline-flex items-center gap-1 text-ink-400">
        <Minus size={15} aria-hidden /> No
      </span>
    )
  return <span className="text-xs text-amber-200">{v}</span>
}

export default function Usuarios() {
  const me = useMe()!
  const state = useStore()
  const confirm = useConfirm()
  const admin = can(me, 'usuarios.gestionar')
  const [adding, setAdding] = useState(false)
  const [perms, setPerms] = useState<User | null>(null)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Usuarios y permisos"
        tag="M3"
        subtitle="Cada negocio tiene sus propios usuarios. Los permisos salen del rol y se pueden ajustar persona por persona."
        actions={
          admin && (
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Nuevo usuario
            </Button>
          )
        }
      />

      <MyAccount />

      {admin && (
        <>
          <SectionTitle>Usuarios por negocio</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {[null, ...BUSINESS_IDS].map((b) => {
              const list = state.users.filter((u) => u.businessId === b)
              return (
                <Card key={b ?? 'all'} className="p-4">
                  <div className="mb-2 flex items-center gap-2 font-semibold text-white">
                    {b ? <BusinessDot id={b} /> : null}
                    {b ? businesses[b].name : 'Todos los negocios'}
                  </div>
                  {list.map((u) => {
                    const adjusted = Object.keys(u.overrides ?? {}).length
                    return (
                      <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 py-2.5 first:border-0">
                        <div>
                          <div className="text-sm font-medium text-white">{u.name}</div>
                          <div className="flex items-center gap-1.5 text-xs text-ink-300">
                            {roleLabel[u.role]}
                            {adjusted > 0 && <Badge tone="brand">{adjusted} ajuste{adjusted > 1 ? 's' : ''}</Badge>}
                            {u.blocked && <Badge tone="red">Bloqueado</Badge>}
                          </div>
                        </div>
                        {u.id !== me.id && (
                          <div className="flex gap-1">
                            {u.role !== 'admin' && (
                              <Button size="sm" variant="ghost" onClick={() => setPerms(u)}>
                                <SlidersHorizontal size={13} /> Permisos
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (u.blocked || (await confirm({ title: `Bloquear a ${u.name}`, message: 'No podrá iniciar sesión hasta que lo desbloquees. Su historial se conserva.', confirmLabel: 'Bloquear usuario', danger: true }))) state.toggleBlock(u.id)
                              }}
                            >
                              {u.blocked ? 'Desbloquear' : 'Bloquear'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </Card>
              )
            })}
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            <Rule id="M3-R2">Un usuario bloqueado no puede iniciar sesión, pero su historial se conserva.</Rule>
            <Rule id="M3-R3">Cada usuario pertenece a un negocio, salvo el Administrador, que accede a todos.</Rule>
          </div>
        </>
      )}

      <SectionTitle>Permisos por rol</SectionTitle>
      <Card>
        <ScrollArea label="Permisos por rol">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Qué puede hacer cada rol</caption>
          <thead className="text-xs text-ink-300">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Acción</th>
              <th className="px-3 py-2.5 font-medium">Administrador</th>
              <th className="px-3 py-2.5 font-medium">Encargado</th>
              <th className="px-3 py-2.5 font-medium">Cajero</th>
            </tr>
          </thead>
          <tbody>
            {MATRIX.map(([a, ...v]) => (
              <tr key={a} className="border-t border-white/10">
                <td className="px-4 py-2 text-ink-200">{a}</td>
                {v.map((x, i) => (
                  <td key={i} className="px-3 py-2 text-center">
                    <Cell v={x} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </ScrollArea>
      </Card>

      {perms && <PermsModal user={state.users.find((u) => u.id === perms.id)!} onClose={() => setPerms(null)} />}
      {adding && <NewUser onClose={() => setAdding(false)} />}
    </div>
  )
}

function MyAccount() {
  const me = useMe()!
  const changePin = useStore((s) => s.changePin)
  const [oldPin, setOld] = useState('')
  const [newPin, setNew] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-semibold text-white">
            <KeyRound size={17} className="text-brand-200" /> Mi cuenta
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {me.name} · {roleLabel[me.role]} · {me.businessId ? businesses[me.businessId].name : 'todos los negocios'}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input className="w-32" label="PIN actual" type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={(e) => setOld(e.target.value.replace(/\D/g, ''))} />
          <Input className="w-32" label="PIN nuevo" type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNew(e.target.value.replace(/\D/g, ''))} />
          <Button
            className="h-[42px]"
            disabled={oldPin.length < 4 || newPin.length < 4}
            onClick={() => {
              const err = changePin(oldPin, newPin)
              setMsg(err ? { ok: false, text: err } : { ok: true, text: 'PIN actualizado.' })
              if (!err) {
                setOld('')
                setNew('')
              }
            }}
          >
            Cambiar PIN
          </Button>
        </div>
      </div>
      {msg && <div className={cx('mt-2 text-sm', msg.ok ? 'text-emerald-300' : 'text-rose-300')}>{msg.text}</div>}
    </Card>
  )
}

function PermsModal({ user, onClose }: { user: User; onClose: () => void }) {
  const setOverride = useStore((s) => s.setOverride)
  return (
    <Modal open onClose={onClose} title={`Permisos de ${user.name}`}>
      <p className="mb-3 text-sm text-ink-300">Por defecto rige lo del rol {roleLabel[user.role]}. Podés habilitar o quitar permisos puntuales; queda registrado en auditoría.</p>
      <div className="space-y-2">
        {ADJUSTABLE.map(({ perm, label }) => {
          const o = user.overrides?.[perm]
          const base = roleAllows(user.role, perm)
          const value = o === undefined ? 'rol' : o ? 'si' : 'no'
          return (
            <div key={perm} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 ring-1 ring-white/10">
              <div>
                <div className="text-sm text-white">{label}</div>
                <div className="text-xs text-ink-400">Por rol: {base ? 'sí' : 'no'}</div>
              </div>
              <div className="inline-flex rounded-full bg-white/[0.05] p-1 ring-1 ring-white/10">
                {(
                  [
                    ['rol', 'Según rol'],
                    ['si', 'Sí'],
                    ['no', 'No'],
                  ] as const
                ).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => setOverride(user.id, perm, v === 'rol' ? null : v === 'si')}
                    className={cx('rounded-full px-3 py-1 text-xs font-semibold transition', value === v ? 'bg-white text-ink-900' : 'text-ink-300 hover:text-white')}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">Un cajero habilitado a dar descuentos tiene un tope de 5%.</p>
    </Modal>
  )
}

function NewUser({ onClose }: { onClose: () => void }) {
  const addUser = useStore((s) => s.addUser)
  const users = useStore((s) => s.users)
  const guard = useGuard()
  const [f, setF] = useState({ name: '', role: 'cajero' as Role, businessId: 'kiosco' as BusinessId, pin: '' })
  const [touched, setTouched] = useState(false)
  const errors = {
    name: !f.name.trim() ? 'Escribí nombre y apellido.' : users.some((u) => u.name.toLowerCase() === f.name.trim().toLowerCase()) ? 'Ya existe un usuario con ese nombre.' : '',
    pin: !/^\d{4}$/.test(f.pin) ? 'El PIN tiene que tener exactamente 4 números.' : users.some((u) => u.pin === f.pin) ? 'Ese PIN ya lo usa otra persona. Elegí otro.' : '',
  }
  const submit = () =>
    guard(() => {
      setTouched(true)
      if (errors.name || errors.pin) return
      addUser({ name: f.name.trim(), role: f.role, businessId: f.role === 'admin' ? null : f.businessId, pin: f.pin })
      onClose()
    })
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo usuario"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Crear usuario</Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="sm:col-span-2">
          <Input label="Nombre y apellido *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={touched ? errors.name : ''} />
        </div>
        <Select label="Rol" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          <option value="cajero">Cajero</option>
          <option value="encargado">Encargado</option>
          <option value="admin">Administrador (todos los negocios)</option>
        </Select>
        <Select label="Negocio" value={f.businessId} disabled={f.role === 'admin'} onChange={(e) => setF({ ...f, businessId: e.target.value as BusinessId })}>
          {BUSINESS_IDS.map((b) => (
            <option key={b} value={b}>
              {businesses[b].name}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Input label="PIN de 4 números *" inputMode="numeric" autoComplete="off" maxLength={4} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} error={touched ? errors.pin : ''} hint="Lo usa para ingresar al sistema." />
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
