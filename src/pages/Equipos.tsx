import { useMemo, useState } from 'react'
import { Shirt, Sparkles, Wrench } from 'lucide-react'
import { useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, money, todayISO } from '../lib/format'
import { RENTAL_TYPES } from '../lib/rental'
import { rentalOccupancy } from '../lib/analytics'
import type { RentalItem, RentalState } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select } from '../components/ui'
import { HBars, SectionTitle } from '../components/common'
import { DataTable, type Col } from '../components/DataTable'

const stateLabel: Record<RentalState, string> = { disponible: 'Disponible', alquilado: 'Alquilado', limpieza: 'En limpieza', mantenimiento: 'En mantenimiento', dañado: 'Dañado', baja: 'De baja' }
const stateTone: Record<RentalState, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  disponible: 'green',
  alquilado: 'blue',
  limpieza: 'amber',
  mantenimiento: 'amber',
  dañado: 'red',
  baja: 'slate',
}

export default function Equipos() {
  const me = useMe()!
  const state = useStore()
  const [type, setType] = useState('')
  const [st, setSt] = useState<RentalState | ''>('')
  const [edit, setEdit] = useState<RentalItem | null>(null)
  const items = state.rentalItems
  const counts = (s: RentalState) => items.filter((i) => i.state === s).length
  const list = useMemo(() => items.filter((i) => (!type || i.type === type) && (!st || i.state === st)), [items, type, st])
  const cleaning = items.filter((i) => i.state === 'limpieza')
  const occupancy = useMemo(() => rentalOccupancy(state, 120, 31), [state])
  const retire = items.filter((i) => i.state !== 'baja' && (i.uses > 55 || i.condition === 'regular')).sort((a, b) => b.uses - a.uses)
  const manage = can(me, 'equipos.gestionar')
  const today = todayISO()


  const columns: Col<RentalItem>[] = [
    {
      key: 'tipo',
      header: 'Tipo y talle',
      mobile: 'title',
      cell: (i) => (
        <>
          {i.type} <span className="font-normal text-ink-300">talle {i.size}</span>
          {i.notes && <div className="text-xs font-normal text-amber-200">{i.notes}</div>}
        </>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      mobile: 'value',
      cell: (i) => (
        <>
          <Badge tone={stateTone[i.state]}>{stateLabel[i.state]}</Badge>
          <div className="mt-0.5 text-xs font-normal text-ink-300">desde {date(i.stateSince)}</div>
        </>
      ),
    },
    { key: 'codigo', header: 'Código', className: 'font-mono text-xs text-white', cell: (i) => i.code },
    { key: 'marca', header: 'Marca', className: 'text-ink-200', cell: (i) => i.brand },
    { key: 'cond', header: 'Condición', className: 'capitalize text-ink-200', cell: (i) => i.condition },
    { key: 'usos', header: 'Usos', align: 'right', className: 'tabular text-ink-200', cell: (i) => i.uses },
    {
      key: 'acc',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      cell: (i) => (
        <>
          {i.state === 'limpieza' && (
            <Button size="sm" variant="secondary" onClick={() => state.setItemState(i.id, 'disponible')}>
              Marcar como lista
            </Button>
          )}
          {(i.state === 'mantenimiento' || i.state === 'dañado') && manage && (
            <Button size="sm" variant="secondary" onClick={() => state.setItemState(i.id, 'disponible', 'Revisada y reparada')}>
              <Wrench size={13} aria-hidden /> Marcar como reparada
            </Button>
          )}
          {i.state === 'disponible' && manage && (
            <Button size="sm" variant="ghost" onClick={() => setEdit(i)}>
              Gestionar
            </Button>
          )}
        </>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Equipos y prendas" subtitle="Cada unidad con su talle, estado, usos y valor de reposición. Las devoluciones las pasan solas a limpieza o mantenimiento." />

      <div className="mb-4 grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 lg:grid-cols-6">
        {(['disponible', 'alquilado', 'limpieza', 'mantenimiento', 'dañado', 'baja'] as RentalState[]).map((s) => (
          <button key={s} onClick={() => setSt(st === s ? '' : s)} className={`glass rounded-2xl p-3 text-left transition hover:bg-white/10 ${st === s ? 'ring-2 ring-white/60' : ''}`}>
            <div className="text-xs font-semibold capitalize text-ink-300">{s}</div>
            <div className="tabular mt-1 text-2xl font-bold text-white">{counts(s)}</div>
          </button>
        ))}
      </div>

      {cleaning.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-400/10 px-4 py-3 ring-1 ring-amber-300/25">
          <span className="flex items-center gap-2 text-sm text-amber-100">
            <Sparkles size={16} /> {cleaning.length} prendas en limpieza
            {cleaning.some((i) => i.stateSince < today) && ' · algunas desde hace más de un día'}
          </span>
          <Button size="sm" onClick={() => state.finishCleaning(cleaning.map((i) => i.id))}>
            Marcar todas como listas
          </Button>
        </div>
      )}

      <div className="mb-3 grid gap-2 sm:flex">
        <Select aria-label="Filtrar por tipo de equipo" className="sm:w-56" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos los tipos</option>
          {RENTAL_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select aria-label="Filtrar por estado" className="sm:w-48" value={st} onChange={(e) => setSt(e.target.value as RentalState | '')}>
          <option value="">Todos los estados</option>
          {(['disponible', 'alquilado', 'limpieza', 'mantenimiento', 'dañado', 'baja'] as RentalState[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty icon={<Shirt size={22} />} action={(type || st) && <Button variant="secondary" onClick={() => { setType(''); setSt('') }}>Quitar filtros</Button>}>No hay unidades con estos filtros.</Empty>
        ) : (
          <DataTable caption="Equipos y prendas" columns={columns} rows={list.slice(0, 120)} rowKey={(i) => i.id} />
        )}
      </Card>
      {list.length > 120 && <p className="mt-2 text-sm text-ink-300">Mostrando 120 de {list.length} unidades. Usá los filtros para acotar.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle>Ocupación en la temporada pasada</SectionTitle>
          <Card className="p-5">
            <HBars rows={occupancy.filter((o) => o.units).sort((a, b) => b.pct - a.pct).map((o) => ({ label: `${o.type} (${o.units} u.)`, value: o.pct }))} format={(n) => `${Math.round(n)}%`} max={100} />
            <p className="mt-4 text-xs text-ink-300">Días alquilados sobre días disponibles. Ayuda a decidir qué conviene comprar para la próxima temporada.</p>
          </Card>
        </div>
        <div>
          <SectionTitle>Candidatas a renovar</SectionTitle>
          <Card className="p-5">
            {retire.length === 0 ? (
              <Empty>Ninguna unidad supera el desgaste esperado.</Empty>
            ) : (
              <div className="space-y-2">
                {retire.slice(0, 8).map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-white">
                      {i.code} · {i.type} {i.size}
                    </span>
                    <span className="text-ink-300">
                      {i.uses} usos · {i.condition} · reposición {money(i.value)}
                    </span>
                  </div>
                ))}
                <p className="pt-2 text-xs text-ink-300">Más de 55 usos o condición regular. Inversión estimada para renovarlas: {money(retire.reduce((a, i) => a + i.value, 0))}.</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {edit && <ManageItem item={edit} onClose={() => setEdit(null)} />}
    </div>
  )
}

function ManageItem({ item, onClose }: { item: RentalItem; onClose: () => void }) {
  const setItemState = useStore((s) => s.setItemState)
  const [next, setNext] = useState<RentalState>('mantenimiento')
  const [note, setNote] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title={`${item.type} ${item.size} · ${item.code}`}
      footer={
        <Button
          onClick={() => {
            setItemState(item.id, next, note || undefined)
            onClose()
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-300">
          {item.brand} · {item.condition} · {item.uses} usos · último service {item.lastServiceAt ? date(item.lastServiceAt) : '—'}
        </p>
        <Select label="Nuevo estado" value={next} onChange={(e) => setNext(e.target.value as RentalState)}>
          <option value="mantenimiento">Mandar a mantenimiento (encerado, afilado, revisión)</option>
          <option value="limpieza">Mandar a limpieza</option>
          <option value="dañado">Marcar como dañado</option>
          <option value="baja">Dar de baja</option>
        </Select>
        <Input label="Detalle" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: afilado de cantos" />
      </div>
    </Modal>
  )
}
