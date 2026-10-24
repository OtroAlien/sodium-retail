import { useEffect, useState } from 'react'
import { Delete, Lock, ShieldCheck } from 'lucide-react'
import { useStore } from '../store'
import { businesses } from '../data/seed'
import { roleLabel } from '../lib/permissions'
import { ConnectionPill } from '../components/Layout'
import { Button, cx } from '../components/ui'
import type { User } from '../types'

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
    <div className="min-h-full bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="./icon.svg" alt="" className="h-12 w-12" />
            <div>
              <h1 className="text-2xl font-semibold text-white">Súper y Kiosco</h1>
              <p className="text-sm text-brand-100">Sistema de gestión con facturación ARCA y funcionamiento sin internet</p>
            </div>
          </div>
          <ConnectionPill />
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.title}>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-200">{g.title}</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.list.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelected(u)
                        setPin('')
                        setError('')
                      }}
                      className={cx(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-left transition',
                        selected?.id === u.id ? 'bg-white shadow-lg ring-2 ring-brand-200' : 'bg-white/10 hover:bg-white/20',
                      )}
                    >
                      <div className={cx('flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold', selected?.id === u.id ? 'bg-brand-600 text-white' : 'bg-white/20 text-white')}>
                        {u.blocked ? <Lock size={16} /> : u.name[0]}
                      </div>
                      <div className="min-w-0">
                        <div className={cx('truncate font-medium', selected?.id === u.id ? 'text-slate-900' : 'text-white')}>{u.name}</div>
                        <div className={cx('text-xs', selected?.id === u.id ? 'text-slate-500' : 'text-brand-100')}>
                          {roleLabel[u.role]}
                          {u.blocked ? ' · bloqueado' : ` · PIN ${u.pin}`}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-xl">
            {selected ? (
              <>
                <div className="mb-1 text-sm text-slate-500">Ingresar como</div>
                <div className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                  <ShieldCheck size={16} className="text-brand-600" /> {selected.name}
                </div>
                <div className="mb-4 flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={cx('h-3.5 w-3.5 rounded-full', i < pin.length ? 'bg-brand-600' : 'bg-slate-200')} />
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                    <button key={d} onClick={() => press(d)} className="rounded-xl bg-slate-100 py-3.5 text-lg font-semibold text-slate-800 hover:bg-slate-200 active:bg-slate-300">
                      {d}
                    </button>
                  ))}
                  <span />
                  <button onClick={() => press('0')} className="rounded-xl bg-slate-100 py-3.5 text-lg font-semibold text-slate-800 hover:bg-slate-200">
                    0
                  </button>
                  <button onClick={() => setPin(pin.slice(0, -1))} className="flex items-center justify-center rounded-xl py-3.5 text-slate-500 hover:bg-slate-100" aria-label="Borrar">
                    <Delete size={20} />
                  </button>
                </div>
                {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
                <Button className="mt-4 w-full" size="lg" disabled={pin.length < 4} onClick={() => submit()}>
                  Ingresar
                </Button>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center py-10 text-center">
                <ShieldCheck size={36} className="mb-3 text-brand-600" />
                <div className="font-medium text-slate-800">Elegí un usuario</div>
                <p className="mt-1 text-sm text-slate-500">Cada rol ve y puede hacer cosas distintas. Probá con un Cajero y con el Administrador.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
