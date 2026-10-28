import { useEffect, useRef, useState } from 'react'
import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { useStore } from '../store'
import { cx } from './ui'
import { useConfirm } from './feedback'

function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <button role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex min-h-11 w-full items-start gap-3 rounded-xl p-2 text-left hover:bg-white/[0.07]">
      <span className={cx('mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors', on ? 'bg-rose-500' : 'bg-white/25')}>
        <span className={cx('h-5 w-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-white">
          {label} <span className="font-normal text-ink-300">· {on ? 'activado' : 'desactivado'}</span>
        </span>
        <span className="block text-xs text-ink-300">{hint}</span>
      </span>
    </button>
  )
}

/** Controles para presentar la demo: simular cortes de internet y caídas de ARCA */
export default function DemoPanel() {
  const [open, setOpen] = useState(false)
  const confirm = useConfirm()
  const box = useRef<HTMLDivElement>(null)
  const simOffline = useStore((s) => s.simOffline)
  const arcaDown = useStore((s) => s.arcaDown)
  const setSimOffline = useStore((s) => s.setSimOffline)
  const setArcaDown = useStore((s) => s.setArcaDown)
  const resetDemo = useStore((s) => s.resetDemo)
  const notify = useStore((s) => s.notify)
  const active = simOffline || arcaDown

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', esc)
    box.current?.querySelector<HTMLElement>('button')?.focus()
    return () => document.removeEventListener('keydown', esc)
  }, [open])

  return (
    <div className="no-print fixed bottom-24 right-3 z-40 sm:right-4 lg:bottom-4">
      {open ? (
        <div ref={box} role="dialog" aria-label="Panel de demostración" className="glass-strong grain w-[min(20rem,calc(100vw-1.5rem))] rounded-3xl p-3 animate-rise">
          <div className="mb-1 flex items-center justify-between gap-2 px-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FlaskConical size={16} className="text-brand-200" aria-hidden /> Panel de demostración
            </div>
            <button onClick={() => setOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-200 hover:bg-white/10" aria-label="Cerrar el panel de demostración">
              <X size={16} aria-hidden />
            </button>
          </div>
          <p className="px-2 pb-2 text-xs text-ink-300">Simula situaciones reales del local. No forma parte del sistema final.</p>
          <Switch on={simOffline} onChange={setSimOffline} label="Cortar internet" hint="La caja sigue vendiendo y guarda todo en el equipo (M4)." />
          <Switch on={arcaDown} onChange={setArcaDown} label="ARCA no responde" hint="Las facturas quedan en contingencia y se reintentan solas (M5)." />
          <div className="mt-2 border-t border-white/10 pt-2">
            <button
              onClick={async () => {
                if (await confirm({ title: 'Reiniciar la demo', message: 'Se pierden las ventas, reservas y cambios que hiciste y la demo vuelve a los datos iniciales.', confirmLabel: 'Reiniciar datos', danger: true })) {
                  resetDemo()
                  setOpen(false)
                  notify('La demo volvió a los datos iniciales.')
                }
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl p-2 text-sm text-ink-100 hover:bg-white/[0.07]"
            >
              <RotateCcw size={15} aria-hidden /> Reiniciar datos de la demo
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label={active ? `Panel de demostración: ${simOffline ? 'internet cortado' : 'ARCA caído'} (simulado)` : 'Abrir el panel de demostración'}
          className={cx('flex min-h-11 items-center gap-2 rounded-full text-sm font-bold text-white shadow-xl ring-1 ring-white/15 transition', active ? 'bg-rose-500/90 px-4 hover:bg-rose-500' : 'glass-strong h-11 w-11 justify-center hover:bg-white/10 sm:w-auto sm:px-4')}
        >
          <FlaskConical size={16} className={active ? '' : 'text-brand-200'} aria-hidden />
          <span className={active ? '' : 'hidden sm:inline'}>{active ? (simOffline ? 'Sin internet (simulado)' : 'ARCA caído (simulado)') : 'Demo'}</span>
        </button>
      )}
    </div>
  )
}
