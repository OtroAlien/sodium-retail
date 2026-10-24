import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { X } from 'lucide-react'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const v: Record<Variant, string> = {
    primary: 'bg-brand-700 text-white hover:bg-brand-800 disabled:bg-slate-300',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-300',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300',
  }
  const s = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm', lg: 'px-5 py-3 text-base' }[size]
  return (
    <button
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed', v[variant], s, className)}
      {...props}
    />
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions, tag }: { title: string; subtitle?: string; actions?: ReactNode; tag?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">{title}</h1>
          {tag && <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">{tag}</span>}
        </div>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Tone = 'slate' | 'green' | 'amber' | 'red' | 'blue' | 'brand'
export function Badge({ tone = 'slate', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  }
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-transparent', t[tone], className)}>{children}</span>
}

export function Input({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = (
    <input
      className={cx('w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50', className)}
      {...props}
    />
  )
  if (!label) return input
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {input}
    </label>
  )
}

export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const el = (
    <select className={cx('w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100', className)} {...props}>
      {children}
    </select>
  )
  if (!label) return el
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {el}
    </label>
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 no-print">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 no-print">{footer}</div>}
      </div>
    </div>
  )
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'amber' | 'green' }) {
  const c = tone === 'red' ? 'text-rose-600' : tone === 'amber' ? 'text-amber-600' : tone === 'green' ? 'text-emerald-600' : 'text-slate-900'
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={cx('tabular mt-1 text-2xl font-semibold', c)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </Card>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-500">{children}</div>
}

export function Rule({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span className="mt-px rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{id}</span>
      <span>{children}</span>
    </div>
  )
}

export { cx }
