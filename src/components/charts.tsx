// Gráficos simples en HTML: una sola escala, barras con punta redondeada, valores visibles
// (no solo al pasar el mouse) y alternativa en tabla para lectores de pantalla.
import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { money } from '../lib/format'
import { cx } from './ui'

const short = (n: number) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : n >= 1000 ? `$${Math.round(n / 1000)} mil` : money(n).replace(',00', ''))

/**
 * Barras por día de una sola serie. El valor se ve siempre: arriba de cada barra cuando son pocos días,
 * o al tocar / enfocar una barra cuando son muchos. El último día (hoy) se destaca.
 */
export function DayBars({ data, height = 180 }: { data: { day: string; total: number; count: number }[]; height?: number }) {
  const [sel, setSel] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.total))
  const dense = data.length > 14
  const few = data.length <= 8
  const label = (d: string, long = false) => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short' }).replace('.', '')
  const picked = sel !== null ? data[sel] : null
  return (
    <div>
      <div className="relative mt-6" style={{ height }}>
        {[0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-white/[0.09]" style={{ bottom: `${f * 100}%` }}>
            <span className="tabular absolute -top-2.5 left-0 pr-2 text-xs font-semibold text-ink-300">{short(max * f)}</span>
          </div>
        ))}
        <div className={cx('absolute inset-0 flex items-end border-b border-white/15 pl-14', dense ? 'gap-1' : 'gap-2 sm:gap-3')}>
          {data.map((d, i) => {
            const isToday = i === data.length - 1
            const h = Math.max(1.5, (d.total / max) * 100)
            return (
              <button
                key={d.day}
                type="button"
                onClick={() => setSel(sel === i ? null : i)}
                onFocus={() => setSel(i)}
                aria-label={`${isToday ? 'Hoy' : label(d.day, true)}: ${money(d.total)} en ${d.count} operaciones`}
                aria-pressed={sel === i}
                className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center rounded-md outline-offset-2"
              >
                {few && (
                  <span className="tabular absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-ink-100 sm:text-xs" style={{ bottom: `calc(${h}% + 4px)` }}>
                    {short(d.total)}
                  </span>
                )}
                <span className={cx('block w-full max-w-9 rounded-t-[4px] transition-all', isToday ? 'bg-white shadow-[0_0_16px_rgba(200,225,248,0.6)]' : sel === i ? 'bg-brand-200' : 'bg-brand-400/80')} style={{ height: `${h}%` }} />
              </button>
            )
          })}
        </div>
      </div>
      <div className={cx('mt-2 flex pl-14', dense ? 'gap-1' : 'gap-2 sm:gap-3')} aria-hidden>
        {data.map((d, i) => (
          <div key={d.day} className={cx('min-w-0 flex-1 text-center text-xs capitalize', i === data.length - 1 ? 'font-bold text-white' : 'font-medium text-ink-300')}>
            {dense ? (i % 5 === 4 || i === data.length - 1 ? (i === data.length - 1 ? 'Hoy' : d.day.slice(8)) : '') : i === data.length - 1 ? 'Hoy' : label(d.day)}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSel(sel === null ? data.length - 1 : Math.max(0, sel - 1))}
          disabled={sel === 0}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold text-ink-100 ring-1 ring-white/20 transition hover:bg-white/10 disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden /> Día anterior
        </button>
        <button
          type="button"
          onClick={() => setSel(sel === null ? 0 : Math.min(data.length - 1, sel + 1))}
          disabled={sel === data.length - 1}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold text-ink-100 ring-1 ring-white/20 transition hover:bg-white/10 disabled:opacity-40"
        >
          Día siguiente <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <p className="mt-3 min-h-[1.5rem] text-sm text-ink-200" aria-live="polite">
        {picked ? (
          <>
            <b className="capitalize text-white">{sel === data.length - 1 ? 'Hoy' : label(picked.day, true)}</b>: <b className="tabular text-white">{money(picked.total)}</b> en {picked.count} operaciones
          </>
        ) : (
          <span className="text-ink-300">Tocá una barra o usá los botones para ver el detalle de cada día.</span>
        )}
      </p>
      {/* alternativa para lectores de pantalla */}
      <table className="sr-only">
        <caption>Importes por día</caption>
        <thead>
          <tr>
            <th>Día</th>
            <th>Total</th>
            <th>Operaciones</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{label(d.day, true)}</td>
              <td>{money(d.total)}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** comparación entre negocios: nombre, color y valor escritos (el color no es el único dato) */
export function CompareBars({ rows }: { rows: { label: string; color: string; value: number; hint?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = rows.reduce((a, r) => a + r.value, 0)
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-white">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
              <span className="wrap-any">{r.label}</span>
            </span>
            <span className="tabular text-sm font-bold text-white">
              {money(r.value)}
              <span className="ml-2 text-xs font-medium text-ink-300">
                {total ? Math.round((r.value / total) * 100) : 0}%{r.hint ? ` · ${r.hint}` : ''}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-white/[0.06]" role="img" aria-label={`${r.label}: ${money(r.value)}`}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** franja de calor por hora: intensidad de una sola tinta, con las horas más fuertes escritas */
export function HourStrip({ hours }: { hours: { hour: number; total: number; count: number }[] }) {
  const open = hours.filter((h) => h.count > 0)
  if (!open.length) return <p className="text-sm text-ink-300">Todavía no hay ventas para mostrar horarios.</p>
  const from = open[0].hour
  const to = open[open.length - 1].hour
  const slice = hours.slice(from, to + 1)
  const max = Math.max(1, ...slice.map((h) => h.total))
  const top = [...slice].sort((a, b) => b.total - a.total).slice(0, 3)
  return (
    <div>
      <div className="flex gap-1" role="img" aria-label={`Ventas por hora, de ${from} a ${to + 1} h`}>
        {slice.map((h) => (
          <div key={h.hour} className="min-w-0 flex-1">
            <div className="h-10 rounded-md ring-1 ring-inset ring-white/10" style={{ background: `rgb(156 192 224 / ${0.06 + (h.total / max) * 0.8})` }} />
            <div className="mt-1 text-center text-xs text-ink-300">{h.hour}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-300">Horas del día (más claro = más ventas).</p>
      <ol className="mt-2 space-y-1 text-sm text-ink-100">
        {top.map((h, i) => (
          <li key={h.hour} className="flex justify-between gap-3">
            <span>
              {i + 1}.º {h.hour} a {h.hour + 1} h
            </span>
            <span className="tabular font-semibold text-white">
              {money(h.total)} <span className="font-normal text-ink-300">· {h.count} ventas</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
