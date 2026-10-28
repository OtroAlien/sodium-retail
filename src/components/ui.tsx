import { useCallback, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'lime'

/**
 * Botones en píldora. En celular todos miden al menos 44 px de alto (área táctil cómoda);
 * en pantallas grandes se compactan.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const v: Record<Variant, string> = {
    primary:
      'bg-gradient-to-b from-white to-brand-200 text-ink-900 shadow-[inset_0_1px_0_rgb(255_255_255),0_8px_24px_-8px_rgb(156_192_224/0.7)] hover:to-brand-100 disabled:from-white/15 disabled:to-white/10 disabled:text-white/50 disabled:shadow-none',
    lime: 'bg-gradient-to-b from-white to-brand-200 text-ink-900 shadow-glow hover:to-brand-100 disabled:from-white/15 disabled:to-white/10 disabled:text-white/50 disabled:shadow-none',
    secondary: 'glass text-white hover:bg-white/10 disabled:text-white/50',
    danger: 'bg-rose-500/90 text-white ring-1 ring-inset ring-rose-300/40 hover:bg-rose-500 disabled:bg-white/10 disabled:text-white/50',
    success:
      'bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_22px_-8px_rgb(16_185_129/0.6)] hover:to-emerald-500 disabled:from-white/15 disabled:to-white/10 disabled:text-white/50 disabled:shadow-none',
    ghost: 'text-ink-200 hover:bg-white/10 hover:text-white disabled:text-white/40',
  }
  const s = { sm: 'min-h-11 px-4 text-sm sm:min-h-10 sm:px-3.5 sm:text-sm', md: 'min-h-11 px-5 text-sm sm:min-h-10', lg: 'min-h-12 px-6 text-base' }[size]
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-tight transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        v[variant],
        s,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/** botón solo con ícono: siempre con nombre accesible y área táctil de 44 px */
export function IconButton({ label, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-200 transition hover:bg-white/10 hover:text-white', className)} {...props}>
      {children}
    </button>
  )
}

/** Píldora de vidrio con el punto luminoso de la marca */
export function GlowPill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('glass inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-medium text-ink-200', className)}>
      <span className="glow-dot" aria-hidden />
      {children}
    </span>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('glass min-w-0 rounded-2xl', className)}>{children}</div>
}

export function CardHeader({ icon, title, right, className }: { icon?: ReactNode; title: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-white/10 px-5 py-3.5', className)}>
      <div className="flex min-w-0 items-center gap-2.5 font-semibold text-white">
        {icon}
        {title}
      </div>
      {right}
    </div>
  )
}

export function IconBubble({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'amber' | 'red' | 'green' | 'ink' }) {
  const t = {
    brand: 'bg-white/10 text-brand-100 ring-1 ring-inset ring-white/15',
    amber: 'bg-amber-400/15 text-amber-200 ring-1 ring-inset ring-amber-300/25',
    red: 'bg-rose-400/15 text-rose-200 ring-1 ring-inset ring-rose-300/25',
    green: 'bg-emerald-400/15 text-emerald-200 ring-1 ring-inset ring-emerald-300/25',
    ink: 'bg-black/30 text-lime-400 ring-1 ring-inset ring-white/10',
  }[tone]
  return (
    <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t)} aria-hidden>
      {children}
    </span>
  )
}

export function PageHeader({ title, subtitle, actions, tag }: { title: string; subtitle?: string; actions?: ReactNode; tag?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 animate-rise">
      <div className="min-w-0 max-w-full flex-1 basis-[18rem]">
        {tag && <GlowPill className="mb-3 !py-1 text-xs font-semibold tracking-wide">Módulo {tag}</GlowPill>}
        <h1 className="wrap-any text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand'
/** estado con punto, color y texto: nunca depende solo del color */
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t: Record<Tone, string> = {
    slate: 'bg-white/[0.07] text-ink-200 ring-white/10',
    green: 'bg-emerald-400/12 text-emerald-200 ring-emerald-300/25',
    amber: 'bg-amber-400/12 text-amber-200 ring-amber-300/25',
    red: 'bg-rose-400/12 text-rose-200 ring-rose-300/25',
    blue: 'bg-sky-400/12 text-sky-200 ring-sky-300/25',
    brand: 'bg-white/10 text-brand-100 ring-white/20',
  }
  const dot: Record<Tone, string> = {
    slate: 'bg-ink-300',
    green: 'bg-emerald-300',
    amber: 'bg-amber-300',
    red: 'bg-rose-300',
    blue: 'bg-sky-300',
    brand: 'bg-brand-100',
  }
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', t[tone], className)}>
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', dot[tone])} aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  )
}

const field =
  'w-full min-h-11 rounded-xl border-0 bg-white/[0.06] px-3.5 py-2.5 text-base text-white ring-1 ring-inset ring-white/20 outline-none transition placeholder:text-ink-400 focus:bg-white/[0.09] focus:ring-2 focus:ring-brand-200 disabled:opacity-50 sm:text-sm aria-[invalid=true]:ring-rose-300'

/**
 * Campo con etiqueta visible. Si no se pasa `label`, usa el placeholder o `aria-label`
 * como nombre accesible, para que ningún campo quede sin nombre.
 */
export function Input({ label, hint, error, className, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string }) {
  const auto = useId()
  const fid = id ?? auto
  const input = (
    <input
      id={fid}
      className={cx(field, className)}
      aria-label={label ? undefined : (props['aria-label'] ?? props.placeholder)}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
      {...props}
    />
  )
  if (!label && !hint && !error) return input
  return (
    <div className="min-w-0">
      {label && (
        <label htmlFor={fid} className="mb-1.5 block text-sm font-semibold text-ink-200 sm:text-xs">
          {label}
        </label>
      )}
      {input}
      {hint && !error && (
        <p id={`${fid}-hint`} className="mt-1 text-xs text-ink-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fid}-err`} role="alert" className="mt-1 text-xs font-medium text-rose-300">
          {error}
        </p>
      )}
    </div>
  )
}

export function Select({ label, className, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const auto = useId()
  const fid = id ?? auto
  const el = (
    <select id={fid} className={cx(field, 'pr-8', className)} aria-label={label ? undefined : props['aria-label']} {...props}>
      {children}
    </select>
  )
  if (!label) return el
  return (
    <div className="min-w-0">
      <label htmlFor={fid} className="mb-1.5 block text-sm font-semibold text-ink-200 sm:text-xs">
        {label}
      </label>
      {el}
    </div>
  )
}

/** selector de opciones excluyentes, con teclado y estado seleccionado anunciado */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="glass inline-flex max-w-full flex-wrap rounded-3xl p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-10 rounded-full px-4 py-2 text-sm font-semibold transition', value === o.value ? 'bg-white text-ink-900' : 'text-ink-200 hover:text-white')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** interruptor con área táctil de 44 px y texto de estado */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className="group -m-1.5 flex min-h-11 shrink-0 items-center gap-2 rounded-full p-1.5">
      <span className={cx('text-xs font-semibold', on ? 'text-emerald-300' : 'text-ink-400')}>{on ? 'Activa' : 'Pausada'}</span>
      <span className={cx('flex h-6 w-11 items-center rounded-full p-0.5 transition-colors', on ? 'bg-emerald-400' : 'bg-white/20')}>
        <span className={cx('h-5 w-5 rounded-full bg-white shadow transition-transform', on && 'translate-x-5')} />
      </span>
    </button>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Diálogo accesible: atrapa el foco, se cierra con Escape, devuelve el foco al cerrar,
 * usa la altura dinámica del teléfono (dvh) y lleva a la vista el campo que se está escribiendo
 * cuando aparece el teclado.
 */
export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string; footer?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const node = box.current
    // foco inicial: primer campo del contenido; si no hay, el diálogo mismo
    const first = node?.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]), select, textarea') ?? node
    first?.focus({ preventScroll: true })
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !node) return
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (!items.length) return
      const a = items[0]
      const z = items[items.length - 1]
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault()
        z.focus()
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault()
        a.focus()
      }
    }
    // con el teclado abierto, el campo activo se centra en el área visible
    const focusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (t.matches('input, select, textarea')) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 280)
    }
    document.addEventListener('keydown', keys, true)
    node?.addEventListener('focusin', focusIn)
    const lock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', keys, true)
      node?.removeEventListener('focusin', focusIn)
      document.body.style.overflow = lock
      previous?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/60 p-0 backdrop-blur-md sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx('glass-strong grain flex max-h-[92dvh] w-full flex-col rounded-t-3xl animate-rise outline-none sm:max-h-[90dvh] sm:rounded-3xl', width)}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5 no-print sm:px-6">
          <h2 id={titleId} className="wrap-any min-w-0 text-lg font-bold tracking-tight text-white">
            {title}
          </h2>
          <button onClick={onClose} className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-200 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-2 sm:px-6">{children}</div>
        {footer && <div className="safe-bottom flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 pt-3.5 no-print sm:px-6">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green'; icon?: ReactNode }) {
  const c = tone === 'red' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-200' : tone === 'green' ? 'text-emerald-200' : 'text-white'
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-ink-300">{label}</div>
        {icon && (
          <span className="text-ink-400" aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <div className={cx('tabular wrap-any mt-2 text-[clamp(1.15rem,5.2vw,1.5rem)] font-bold leading-tight tracking-tight sm:text-2xl', c)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-300">{hint}</div>}
    </Card>
  )
}

/** estado vacío o sin resultados: explica qué pasa y ofrece una salida */
export function Empty({ children, icon, action }: { children: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center text-sm text-ink-300">
      {icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-ink-300 ring-1 ring-white/10" aria-hidden>
          {icon}
        </div>
      )}
      <div className="max-w-md leading-relaxed">{children}</div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Rule({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-xs text-ink-200 ring-1 ring-white/10">
      <span className="mt-px shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-brand-100 ring-1 ring-white/15">{id}</span>
      <span className="min-w-0 leading-relaxed">{children}</span>
    </div>
  )
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-300">
      <Loader2 size={18} className="animate-spin" aria-hidden /> {label}
    </div>
  )
}

/** contenedor con desplazamiento horizontal propio (para tablas anchas), accesible por teclado */
export function ScrollArea({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={cx('scroll-x', className)} tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  )
}

/** evita envíos duplicados: ignora llamadas repetidas en una ventana corta */
export function useGuard(ms = 900) {
  const last = useRef(0)
  return useCallback(
    <T,>(fn: () => T): T | undefined => {
      const now = Date.now()
      if (now - last.current < ms) return undefined
      last.current = now
      return fn()
    },
    [ms],
  )
}

/** encabezado y celdas de tabla compartidos, para que todas se vean iguales */
export const th = 'px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-ink-300'
export const td = 'px-4 py-3 align-top'
export const tr = 'border-t border-white/10 transition-colors hover:bg-white/[0.04]'
