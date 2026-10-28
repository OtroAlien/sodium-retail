import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { addDays, todayISO } from '../lib/format'
import { SIZES, availability } from '../lib/rental'
import type { RentalType } from '../types'
import { Card, PageHeader, Rule, Segmented, cx } from '../components/ui'

export default function Disponibilidad() {
  const state = useStore()
  const today = todayISO()
  const [start, setStart] = useState(0)
  const [group, setGroup] = useState<'equipos' | 'ropa'>('equipos')
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(start + i)), [start])
  const types: RentalType[] = group === 'equipos' ? ['Esquí', 'Bastones', 'Botas de esquí', 'Snowboard', 'Botas de snowboard'] : ['Casco', 'Antiparras', 'Campera', 'Pantalón', 'Guantes']

  const book = (type: RentalType, size: string, day: string) => {
    state.setReservationDraft({ lines: [{ type, size, qty: 1 }], from: day })
    state.setPage('reservas')
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Disponibilidad por fechas"
        subtitle="Unidades libres por talle y por día, descontando reservas, alquileres en curso y prendas en limpieza o revisión. Tocá un casillero para reservar."
        actions={
          <div className="flex gap-2">
            <Segmented
              value={group}
              onChange={setGroup}
              options={[
                { value: 'equipos', label: 'Equipos' },
                { value: 'ropa', label: 'Ropa y accesorios' },
              ]}
            />
            <Segmented
              value={String(start)}
              onChange={(v) => setStart(Number(v))}
              options={[
                { value: '0', label: 'Próximos 14 días' },
                { value: '14', label: 'Siguientes' },
              ]}
            />
          </div>
        }
      />
      <Card>
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Disponibilidad por talle y día. Deslizá hacia los costados para ver más días.">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-ink-300">
              <th className="sticky left-0 bg-ink-900/80 px-4 py-3 text-left font-bold backdrop-blur">Talle</th>
              {days.map((d) => {
                const dt = new Date(d + 'T12:00:00')
                const weekend = dt.getDay() === 0 || dt.getDay() === 6
                return (
                  <th key={d} className={cx('px-1 py-3 text-center font-bold', d === today && 'text-white', weekend && 'text-brand-200')}>
                    <div>{dt.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</div>
                    <div className="tabular text-xs normal-case">{d.slice(8)}/{d.slice(5, 7)}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <Rows key={type} type={type} days={days} onBook={book} />
            ))}
          </tbody>
        </table>
        </div>
      </Card>
      <p className="mt-2 text-sm text-ink-300 lg:hidden">Deslizá la tabla hacia los costados para ver todos los días.</p>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-ink-300">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-emerald-400/30 ring-1 ring-emerald-300/40" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-amber-400/30 ring-1 ring-amber-300/40" /> Queda 1
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-rose-400/30 ring-1 ring-rose-300/40" /> Agotado
        </span>
      </div>
      <div className="mt-4 max-w-2xl">
        <Rule id="Talles">Si un talle se agota, la reserva sugiere el talle vecino y el sistema avisa antes de confirmar. Las devoluciones atrasadas siguen ocupando la unidad hasta que vuelven.</Rule>
      </div>
    </div>
  )

  function Rows({ type, days, onBook }: { type: RentalType; days: string[]; onBook: (t: RentalType, s: string, d: string) => void }) {
    return (
      <>
        <tr>
          <td colSpan={days.length + 1} className="border-t border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink-200">
            {type}
          </td>
        </tr>
        {SIZES[type].map((size) => (
          <tr key={size}>
            <td className="sticky left-0 bg-ink-900/80 px-4 py-1.5 text-ink-200 backdrop-blur">{size}</td>
            {days.map((d) => {
              const a = availability(state.rentalItems, state.reservations, type, size, d, d, today)
              const tone = a.available === 0 ? 'bg-rose-400/25 text-rose-100 ring-rose-300/30' : a.available === 1 ? 'bg-amber-400/25 text-amber-100 ring-amber-300/30' : 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20'
              return (
                <td key={d} className="px-1 py-1">
                  <button
                    onClick={() => a.available > 0 && onBook(type, size, d)}
                    disabled={a.available === 0}
                    title={`${type} ${size} · ${d.split('-').reverse().join('/')}: ${a.available} de ${a.total} libres`}
                    className={cx('tabular h-11 min-w-11 w-full rounded-md text-sm sm:h-9 font-semibold ring-1 ring-inset transition hover:brightness-125 disabled:cursor-not-allowed', tone)}
                  >
                    {a.available}
                  </button>
                </td>
              )
            })}
          </tr>
        ))}
      </>
    )
  }
}
