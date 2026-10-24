import { useState } from 'react'
import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { useStore } from '../store'
import { cx } from './ui'

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-canvas">
      <span className={cx('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-rose-500' : 'bg-ink-300')}>
        <span className={cx('h-4 w-4 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
      </span>
      <span>
        <span className="block text-sm font-medium text-ink-900">{label}</span>
        <span className="block text-xs text-ink-400">{hint}</span>
      </span>
    </button>
  )
}

/** Controles para presentar la demo: simular cortes de internet y caídas de ARCA */
export default function DemoPanel() {
  const [open, setOpen] = useState(false)
  const simOffline = useStore((s) => s.simOffline)
  const arcaDown = useStore((s) => s.arcaDown)
  const setSimOffline = useStore((s) => s.setSimOffline)
  const setArcaDown = useStore((s) => s.setArcaDown)
  const resetDemo = useStore((s) => s.resetDemo)
  const active = simOffline || arcaDown

  return (
    <div className="no-print fixed bottom-24 right-4 z-40 lg:bottom-4">
      {open ? (
        <div className="w-80 rounded-3xl bg-white p-3 shadow-2xl ring-1 ring-ink-900/10 animate-rise">
          <div className="mb-1 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <FlaskConical size={16} className="text-brand-500" /> Panel de demostración
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-300 hover:bg-ink-900/5" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <p className="px-2 pb-2 text-xs text-ink-400">Simula situaciones reales del local. No forma parte del sistema final.</p>
          <Toggle on={simOffline} onChange={setSimOffline} label="Cortar internet" hint="La caja sigue vendiendo y guarda todo en el equipo (M4)." />
          <Toggle on={arcaDown} onChange={setArcaDown} label="ARCA no responde" hint="Las facturas quedan en contingencia y se reintentan solas (M5)." />
          <div className="mt-2 border-t border-ink-900/[0.06] pt-2">
            <button
              onClick={() => {
                if (confirm('¿Volver la demo a los datos iniciales? Se pierden las ventas y cambios hechos.')) resetDemo()
              }}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-ink-600 hover:bg-canvas"
            >
              <RotateCcw size={15} /> Reiniciar datos de la demo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={cx('flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-xl ring-1 ring-white/10 transition', active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-ink-900 hover:bg-ink-800')}
        >
          <FlaskConical size={16} className={active ? "" : "text-lime-400"} />
          {active ? (simOffline ? 'Sin internet (simulado)' : 'ARCA caído (simulado)') : 'Demo'}
        </button>
      )}
    </div>
  )
}
