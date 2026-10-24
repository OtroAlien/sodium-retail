import { useState } from 'react'
import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { useStore } from '../store'
import { cx } from './ui'

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex w-full items-start gap-3 rounded-lg p-2 text-left hover:bg-slate-50">
      <span className={cx('mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-rose-500' : 'bg-slate-300')}>
        <span className={cx('h-4 w-4 rounded-full bg-white shadow transition-transform', on && 'translate-x-4')} />
      </span>
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
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
        <div className="w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div className="mb-1 flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <FlaskConical size={16} className="text-violet-600" /> Panel de demostración
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100" aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <p className="px-2 pb-2 text-xs text-slate-500">Simula situaciones reales del local. No forma parte del sistema final.</p>
          <Toggle on={simOffline} onChange={setSimOffline} label="Cortar internet" hint="La caja sigue vendiendo y guarda todo en el equipo (M4)." />
          <Toggle on={arcaDown} onChange={setArcaDown} label="ARCA no responde" hint="Las facturas quedan en contingencia y se reintentan solas (M5)." />
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button
              onClick={() => {
                if (confirm('¿Volver la demo a los datos iniciales? Se pierden las ventas y cambios hechos.')) resetDemo()
              }}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw size={15} /> Reiniciar datos de la demo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={cx('flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg', active ? 'bg-rose-600' : 'bg-violet-600 hover:bg-violet-700')}
        >
          <FlaskConical size={16} />
          {active ? (simOffline ? 'Sin internet (simulado)' : 'ARCA caído (simulado)') : 'Demo'}
        </button>
      )}
    </div>
  )
}
