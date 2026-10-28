// Respuestas de la interfaz: avisos de resultado, confirmación de acciones destructivas y errores.
import { Component, createContext, useCallback, useContext, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { useStore } from '../store'
import { Button, Modal, cx } from './ui'

/** avisos: se anuncian a lectores de pantalla y quedan por encima de las barras fijas del celular */
export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  const icon = { ok: CheckCircle2, error: TriangleAlert, info: Info }
  const tone = {
    ok: 'ring-emerald-300/40 text-emerald-100',
    error: 'ring-rose-300/50 text-rose-100',
    info: 'ring-white/25 text-white',
  }
  return (
    <div className="no-print pointer-events-none fixed inset-x-3 bottom-24 z-[60] flex flex-col items-center gap-2 lg:bottom-6" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = icon[t.tone]
        return (
          <div key={t.id} role={t.tone === 'error' ? 'alert' : 'status'} className={cx('glass-strong pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm font-medium ring-1 animate-rise', tone[t.tone])}>
            <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span className="wrap-any min-w-0 flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Cerrar aviso">
              <X size={15} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** acción irreversible o que afecta a terceros: botón rojo */
  danger?: boolean
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>
const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false))

/** pide confirmación antes de una acción destructiva. Uso: `if (await confirm({...})) hacer()` */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)
  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setOpts(o)
      }),
    [],
  )
  const close = (v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        title={opts?.title ?? ''}
        width="max-w-md"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)} data-autofocus>
              {opts?.cancelLabel ?? 'Cancelar'}
            </Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {opts?.confirmLabel ?? 'Confirmar'}
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          {opts?.danger && <AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-300" aria-hidden />}
          <div className="text-sm leading-relaxed text-ink-200">{opts?.message}</div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

/** si una pantalla falla, se muestra un mensaje claro con una salida en lugar de quedar en blanco */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string; onHome?: () => void }, { error: Error | null; key?: string }> {
  state: { error: Error | null; key?: string } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  static getDerivedStateFromProps(props: { resetKey?: string }, state: { error: Error | null; key?: string }) {
    // al cambiar de pantalla se vuelve a intentar
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-3xl bg-rose-400/10 p-6 text-center ring-1 ring-rose-300/30">
        <TriangleAlert className="mx-auto text-rose-200" size={28} aria-hidden />
        <h2 className="mt-3 text-lg font-bold text-white">Esta pantalla tuvo un problema</h2>
        <p className="mt-1 text-sm text-ink-200">No se perdió ningún dato. Podés volver al inicio y seguir trabajando.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => this.setState({ error: null })} variant="secondary">
            Reintentar
          </Button>
          <Button onClick={() => this.props.onHome?.()}>Ir al inicio</Button>
        </div>
      </div>
    )
  }
}
