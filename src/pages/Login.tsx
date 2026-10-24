import { useEffect, useState } from 'react'
import { ArrowLeft, Delete, FileCheck2, Lock, ShieldCheck, WifiOff, CalendarClock } from 'lucide-react'
import { useStore } from '../store'
import { businesses } from '../data/seed'
import { roleLabel } from '../lib/permissions'
import { ConnectionPill } from '../components/Layout'
import { Button, cx } from '../components/ui'
import type { User } from '../types'

const features = [
  { icon: WifiOff, text: 'Sigue vendiendo sin internet' },
  { icon: FileCheck2, text: 'Factura A y B con ARCA' },
  { icon: CalendarClock, text: 'Stock por lote y vencimientos' },
  { icon: ShieldCheck, text: 'Roles y auditoría' },
]

const roleColor = { admin: 'from-lime-300 to-lime-500 text-ink-900', encargado: 'from-brand-300 to-brand-600 text-white', cajero: 'from-sky-300 to-sky-600 text-white' }

export default function Login() {
  const users = useStore((s) => s.users)
  const login = useStore((s) => s.login)
  const [selected, setSelected] = useState<User | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  const submit = (value = pin) => {
    if (!selected) return
    const err = login(selected.id, value)
    if (err) {
      setError(err)
      setPin('')
    }
  }
  const press = (d: string) => {
    setError('')
    setPin((p) => (p + d).slice(0, 4))
  }

  // al completar los 4 dígitos ingresa solo
  useEffect(() => {
    if (pin.length !== 4) return
    const t = setTimeout(() => submit(pin), 150)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  // también se puede tipear el PIN con el teclado
  useEffect(() => {
    if (!selected) return
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
      else if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const groups: { title: string; list: User[] }[] = [
    { title: 'Ambos negocios', list: users.filter((u) => u.businessId === null) },
    { title: businesses.kiosco.name, list: users.filter((u) => u.businessId === 'kiosco') },
    { title: businesses.super.name, list: users.filter((u) => u.businessId === 'super') },
  ]

  return (
    <div className="mesh-bg relative min-h-full overflow-hidden">
      <div className="grid-dots absolute inset-0" />
      <div className="relative mx-auto grid min-h-full max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="animate-rise">
          <div className="mb-10 flex items-center justify-between lg:justify-start lg:gap-4">
            <div className="flex items-center gap-3">
              <img src="./icon.svg" alt="" className="h-11 w-11 rounded-xl" />
              <span className="text-sm font-bold text-white/80">
                por <span className="text-lime-400">Sodium</span>
              </span>
            </div>
            <div className="lg:hidden">
              <ConnectionPill dark />
            </div>
          </div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Súper y Kiosco,
            <br />
            <span className="bg-gradient-to-r from-lime-300 via-lime-400 to-brand-300 bg-clip-text text-transparent">siempre vendiendo.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-ink-200">Cobrá, facturá y controlá el stock de ambos locales, con o sin internet.</p>
          <div className="mt-8 grid max-w-lg gap-2.5 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.text} className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white ring-1 ring-white/10 backdrop-blur">
                <f.icon size={17} className="shrink-0 text-lime-400" />
                {f.text}
              </div>
            ))}
          </div>
          <div className="mt-8 hidden lg:block">
            <ConnectionPill dark />
          </div>
        </div>

        <div className="animate-rise rounded-[28px] bg-white/95 p-2 shadow-2xl ring-1 ring-white/20 backdrop-blur-xl">
          {!selected ? (
            <div className="p-4">
              <div className="mb-1 text-lg font-extrabold tracking-tight text-ink-900">¿Quién ingresa?</div>
              <p className="mb-4 text-sm text-ink-400">Cada rol ve y puede hacer cosas distintas.</p>
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.title}>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{g.title}</div>
                    <div className="space-y-1.5">
                      {g.list.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelected(u)
                            setPin('')
                            setError('')
                          }}
                          className="group flex w-full items-center gap-3 rounded-2xl p-2 text-left ring-1 ring-ink-900/[0.06] transition hover:bg-brand-50 hover:ring-brand-200"
                        >
                          <div className={cx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-extrabold', u.blocked ? 'from-ink-200 to-ink-300 text-ink-600' : roleColor[u.role])}>
                            {u.blocked ? <Lock size={15} /> : u.name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-bold text-ink-900">{u.name}</div>
                            <div className="text-xs text-ink-400">{roleLabel[u.role]}</div>
                          </div>
                          <span className={cx('rounded-lg px-2 py-1 font-mono text-[11px] font-bold', u.blocked ? 'bg-rose-50 text-rose-600' : 'bg-canvas text-ink-600 group-hover:bg-white')}>
                            {u.blocked ? 'bloqueado' : `PIN ${u.pin}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-5 animate-rise">
              <button onClick={() => setSelected(null)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink-400 hover:text-ink-900">
                <ArrowLeft size={16} /> Cambiar usuario
              </button>
              <div className="flex flex-col items-center text-center">
                <div className={cx('flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-extrabold shadow-lift', roleColor[selected.role])}>{selected.name[0]}</div>
                <div className="mt-3 text-lg font-extrabold tracking-tight text-ink-900">{selected.name}</div>
                <div className="text-sm text-ink-400">{roleLabel[selected.role]} · ingresá tu PIN</div>
              </div>
              <div className={cx('my-6 flex justify-center gap-3', error && 'animate-pop')}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cx('h-3.5 w-3.5 rounded-full transition', i < pin.length ? 'scale-110 bg-brand-500' : error ? 'bg-rose-200' : 'bg-ink-200')} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} onClick={() => press(d)} className="h-14 rounded-2xl bg-canvas text-xl font-bold text-ink-900 transition hover:bg-brand-50 active:scale-95 active:bg-brand-100">
                    {d}
                  </button>
                ))}
                <span />
                <button onClick={() => press('0')} className="h-14 rounded-2xl bg-canvas text-xl font-bold text-ink-900 transition hover:bg-brand-50 active:scale-95">
                  0
                </button>
                <button onClick={() => setPin(pin.slice(0, -1))} className="flex h-14 items-center justify-center rounded-2xl text-ink-400 transition hover:bg-canvas" aria-label="Borrar">
                  <Delete size={22} />
                </button>
              </div>
              {error && <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-center text-sm font-medium text-rose-700">{error}</div>}
              <Button className="mt-5 w-full" size="lg" disabled={pin.length < 4} onClick={() => submit()}>
                Ingresar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
