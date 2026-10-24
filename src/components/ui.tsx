import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'lime'

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-brand-500 text-white shadow-[0_6px_16px_-6px_rgb(107_78_255/0.7)] hover:bg-brand-600 disabled:bg-ink-200 disabled:shadow-none',
    secondary: 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-canvas hover:ring-ink-300 disabled:text-ink-300',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-ink-200',
    success: 'bg-emerald-600 text-white shadow-[0_6px_16px_-6px_rgb(5_150_105/0.6)] hover:bg-emerald-700 disabled:bg-ink-200 disabled:shadow-none',
    ghost: 'text-ink-600 hover:bg-ink-900/5 disabled:text-ink-300',
    lime: 'bg-lime-400 text-ink-900 shadow-glow hover:bg-lime-300 disabled:bg-ink-600 disabled:text-ink-400 disabled:shadow-none',
  }
  const s = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-sm', lg: 'h-12 px-5 text-base' }[size]
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2',
        v[variant],
        s,
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl bg-white shadow-soft ring-1 ring-ink-900/[0.06]', className)}>{children}</div>
}

export function CardHeader({ icon, title, right, className }: { icon?: ReactNode; title: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 border-b border-ink-900/[0.06] px-5 py-3.5', className)}>
      <div className="flex items-center gap-2.5 font-semibold text-ink-900">
        {icon}
        {title}
      </div>
      {right}
    </div>
  )
}

export function IconBubble({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'amber' | 'red' | 'green' | 'ink' }) {
  const t = {
    brand: 'bg-brand-50 text-brand-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-rose-50 text-rose-600',
    green: 'bg-emerald-50 text-emerald-600',
    ink: 'bg-ink-900 text-lime-400',
  }[tone]
  return <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t)}>{children}</span>
}

export function PageHeader({ title, subtitle, actions, tag }: { title: string; subtitle?: string; actions?: ReactNode; tag?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-rise">
      <div>
        {tag && (
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-lime-400">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
            {tag}
          </div>
        )}
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand'
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t: Record<Tone, string> = {
    slate: 'bg-ink-900/[0.05] text-ink-600',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-800',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
    brand: 'bg-brand-50 text-brand-700',
  }
  const dot: Record<Tone, string> = {
    slate: 'bg-ink-400',
    green: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-rose-500',
    blue: 'bg-sky-500',
    brand: 'bg-brand-500',
  }
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', t[tone], className)}>
      <span className={cx('h-1.5 w-1.5 rounded-full', dot[tone])} />
      {children}
    </span>
  )
}

const field =
  'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 outline-none transition placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500 disabled:bg-canvas disabled:text-ink-400'

export function Input({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = <input className={cx(field, className)} {...props} />
  if (!label) return input
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-600">{label}</span>
      {input}
    </label>
  )
}

export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const el = (
    <select className={cx(field, 'pr-8', className)} {...props}>
      {children}
    </select>
  )
  if (!label) return el
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-600">{label}</span>
      {el}
    </label>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex rounded-xl bg-ink-900/[0.05] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-lg px-3.5 py-1.5 text-sm font-semibold transition', value === o.value ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-400 hover:text-ink-700')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg', footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: string; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl animate-rise sm:rounded-3xl', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pb-2 pt-5 no-print">
          <h2 className="text-lg font-bold tracking-tight text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-ink-300 transition hover:bg-ink-900/5 hover:text-ink-700" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-5 pt-2">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-900/[0.06] bg-canvas/60 px-6 py-3.5 no-print sm:rounded-b-3xl">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green'; icon?: ReactNode }) {
  const c = tone === 'red' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-ink-900'
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink-400">{label}</div>
        {icon && <span className="text-ink-300">{icon}</span>}
      </div>
      <div className={cx('tabular mt-2 text-2xl font-extrabold tracking-tight sm:text-[26px]', c)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </Card>
  )
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center text-sm text-ink-400">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-canvas text-ink-300">{icon}</div>}
      {children}
    </div>
  )
}

export function Rule({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-white/70 px-3 py-2.5 text-xs text-ink-600 ring-1 ring-ink-900/[0.06]">
      <span className="mt-px shrink-0 rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-lime-400">{id}</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

/** encabezado de tabla y filas, para que todas las tablas se vean iguales */
export const th = 'px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-400'
export const td = 'px-5 py-3'
export const tr = 'border-t border-ink-900/[0.05] transition-colors hover:bg-brand-50/40'

export { cx }
