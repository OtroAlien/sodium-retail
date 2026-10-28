import { useEffect, useState } from 'react'
import { ArrowLeft, Delete, FileCheck2, Lock, ShieldCheck, WifiOff, CalendarClock } from 'lucide-react'
import { useStore } from '../store'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { roleLabel } from '../lib/permissions'
import { BusinessDot, ConnectionPill, SodiumSignature } from '../components/Layout'
import { Button, GlowPill, cx } from '../components/ui'
import type { User } from '../types'

const features = [
  { icon: WifiOff, text: 'Sigue vendiendo sin internet' },
  { icon: FileCheck2, text: 'Factura A y B con ARCA' },
  { icon: CalendarClock, text: 'Stock, reservas y vencimientos' },
  { icon: ShieldCheck, text: 'Cada negocio, sus usuarios y su caja' },
]

const roleColor = {
  admin: 'from-white to-brand-200 text-ink-900',
  encargado: 'from-brand-300 to-brand-600 text-white',
  cajero: 'from-brand-500 to-brand-800 text-white',
}

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

  const groups: { title: string; id?: (typeof BUSINESS_IDS)[number]; list: User[] }[] = [
    { title: 'Todos los negocios', list: users.filter((u) => u.businessId === null) },
    ...BUSINESS_IDS.map((b) => ({ title: businesses[b].name, id: b, list: users.filter((u) => u.businessId === b) })),
  ]

  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="relative mx-auto grid min-h-full max-w-6xl items-center gap-8 px-4 pb-28 pt-8 sm:px-5 sm:py-10 lg:grid-cols-[1fr_440px] lg:gap-10 lg:px-8 lg:pb-10">
        <div className="animate-rise">
          <div className="mb-6 flex items-center justify-between sm:mb-10 lg:justify-start lg:gap-4">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-ink-300">Gestión de negocios</div>
            <div className="lg:hidden">
              <ConnectionPill dark />
            </div>
          </div>
          <h1 className="text-glow max-w-xl text-[clamp(2rem,9vw,2.75rem)] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[58px]">
            Cuatro negocios,
            <br />
            una sola plataforma
          </h1>
          <p className="mt-4 max-w-md text-base font-light leading-relaxed text-ink-200 sm:mt-6 sm:text-lg">
            Kiosco, supermercado, ferretería y alquiler de ski: cada uno con su <span className="font-bold text-white">caja</span>, su <span className="font-bold text-white">stock</span> y su{' '}
            <span className="font-bold text-white">facturación</span>, y un panel para verlos todos juntos.
          </p>
          <div className="mt-8 hidden max-w-lg gap-2.5 sm:grid sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.text} className="glass flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white">
                <f.icon size={17} className="shrink-0 text-brand-200" />
                {f.text}
              </div>
            ))}
          </div>
          <div className="mt-6 hidden flex-wrap gap-2 sm:flex">
            {BUSINESS_IDS.map((b) => (
              <GlowPill key={b} className="!gap-2">
                <BusinessDot id={b} />
                {businesses[b].name}
              </GlowPill>
            ))}
          </div>
          <div className="mt-8 hidden items-center gap-4 lg:flex">
            <ConnectionPill dark />
            <SodiumSignature />
          </div>
        </div>

        <div className="glass-strong grain animate-rise rounded-[28px] p-2">
          {!selected ? (
            <div className="p-4">
              <div className="mb-1 text-xl font-bold tracking-tight text-white">¿Quién ingresa?</div>
              <p className="mb-5 text-sm text-ink-300">Cada rol ve y puede hacer cosas distintas.</p>
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.title}>
                    <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-ink-400">
                      {g.id && <BusinessDot id={g.id} />}
                      {g.title}
                    </div>
                    <div className="space-y-1.5">
                      {g.list.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => {
                            setSelected(u)
                            setPin('')
                            setError('')
                          }}
                          className="group flex w-full items-center gap-3 rounded-2xl bg-white/[0.04] p-2 text-left ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:ring-white/25"
                        >
                          <div className={cx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold', u.blocked ? 'from-ink-600 to-ink-700 text-ink-300' : roleColor[u.role])}>
                            {u.blocked ? <Lock size={15} /> : u.name[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{u.name}</div>
                            <div className="text-xs text-ink-300">{roleLabel[u.role]}</div>
                          </div>
                          <span className={cx('rounded-full px-2.5 py-1 font-mono text-xs font-bold ring-1', u.blocked ? 'bg-rose-400/12 text-rose-200 ring-rose-300/25' : 'bg-white/[0.06] text-ink-200 ring-white/10')}>
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
              <button onClick={() => setSelected(null)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink-300 hover:text-white">
                <ArrowLeft size={16} /> Cambiar usuario
              </button>
              <div className="flex flex-col items-center text-center">
                <div className={cx('flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl font-bold shadow-lift', roleColor[selected.role])}>{selected.name[0]}</div>
                <div className="mt-3 text-lg font-bold tracking-tight text-white">{selected.name}</div>
                <div className="text-sm text-ink-300">{roleLabel[selected.role]} · ingresá tu PIN</div>
              </div>
              <div className={cx('my-6 flex justify-center gap-3', error && 'animate-pop')}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className={cx('h-3.5 w-3.5 rounded-full transition', i < pin.length ? 'glow-dot !h-3.5 !w-3.5' : error ? 'bg-rose-400/40' : 'bg-white/15')} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} onClick={() => press(d)} className="h-14 rounded-2xl bg-white/[0.06] text-xl font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.12] active:scale-95">
                    {d}
                  </button>
                ))}
                <span />
                <button onClick={() => press('0')} className="h-14 rounded-2xl bg-white/[0.06] text-xl font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.12] active:scale-95">
                  0
                </button>
                <button onClick={() => setPin(pin.slice(0, -1))} className="flex h-14 items-center justify-center rounded-2xl text-ink-300 transition hover:bg-white/[0.06] hover:text-white" aria-label="Borrar">
                  <Delete size={22} />
                </button>
              </div>
              {error && <div className="mt-4 rounded-xl bg-rose-400/12 px-3 py-2 text-center text-sm font-medium text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
              <Button className="mt-5 w-full" size="lg" disabled={pin.length < 4} onClick={() => submit()}>
                Ingresar
              </Button>
            </div>
          )}
        </div>
        <SodiumSignature className="justify-center lg:hidden" />
      </div>
    </div>
  )
}
