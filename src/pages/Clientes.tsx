import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, Plus, Search, UserPlus, Users } from 'lucide-react'
import { useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, dateTime, money } from '../lib/format'
import { clientStats } from '../lib/analytics'
import { isValidCuit } from '../lib/arca'
import { businesses } from '../data/seed'
import type { Client, PayMethod } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Select, Segmented, cx, useGuard } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import { Simulated, payLabel } from '../components/common'
import { linesText } from './Mostrador'

export default function Clientes() {
  const state = useStore()
  const biz = state.businessId
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState<'todos' | 'deudores' | 'frecuentes' | 'empresas' | 'inactivos'>('todos')
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (state.focusClientId) {
      setOpen(state.focusClientId)
      state.setFocusClient(null)
    }
  }, [state.focusClientId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return state.clients
      .filter((c) => c.businessId === biz)
      .map((c) => ({ c, st: clientStats(state, c) }))
      .filter(({ c, st }) => {
        if (term && !c.name.toLowerCase().includes(term) && !c.phone.includes(term) && !c.cuit?.includes(term)) return false
        if (seg === 'deudores') return st.balance > 0
        if (seg === 'frecuentes') return st.visits >= 5 || c.tags.includes('frecuente')
        if (seg === 'empresas') return !!c.cuit || c.tags.includes('empresa')
        if (seg === 'inactivos') return !st.last || Date.now() - new Date(st.last).getTime() > 30 * 86400000
        return true
      })
      .sort((a, b) => b.st.total - a.st.total)
  }, [state, biz, q, seg])

  const totalDebt = rows.reduce((a, r) => a + Math.max(0, r.st.balance), 0)

  type Row = { c: Client; st: ReturnType<typeof clientStats> }
  const columns: Col<Row>[] = [
    {
      key: 'cliente',
      header: 'Cliente',
      mobile: 'title',
      className: 'min-w-[14rem]',
      cell: ({ c }) => (
        <>
          <div className="wrap-any font-semibold text-white">{c.name}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {c.tags.slice(0, 3).map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'total',
      header: biz === 'alquiler' ? 'Facturado' : 'Compró',
      align: 'right',
      mobile: 'value',
      cell: ({ st }) => <span className="tabular whitespace-nowrap font-semibold text-white">{money(st.total)}</span>,
    },
    { key: 'ultima', header: 'Última visita', className: 'whitespace-nowrap text-ink-200', cell: ({ st }) => (st.last ? date(st.last) : 'Sin visitas') },
    { key: 'visitas', header: 'Visitas', align: 'right', className: 'tabular text-ink-200', cell: ({ st }) => st.visits },
    {
      key: 'saldo',
      header: 'Saldo de cuenta corriente',
      align: 'right',
      className: 'tabular whitespace-nowrap',
      cell: ({ c, st }) =>
        c.creditLimit > 0 ? (
          <span className={st.balance > 0 ? 'font-semibold text-amber-200' : 'text-ink-200'}>
            {money(st.balance)}
            {st.debtDays >= 15 && <span className="block text-xs font-normal text-rose-300">deuda de {st.debtDays} días</span>}
          </span>
        ) : (
          <span className="text-ink-300">Sin cuenta corriente</span>
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Clientes"
        subtitle={`Historial de compras${businesses[biz].kind === 'rental' ? ', alquileres y talles' : ''}, cuentas corrientes y segmentos para acciones comerciales.`}
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus size={16} aria-hidden /> Nuevo cliente
          </Button>
        }
      />
      <div className="mb-3 space-y-3">
        <Segmented
          label="Segmento de clientes"
          value={seg}
          onChange={setSeg}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'deudores', label: 'Con saldo' },
            { value: 'frecuentes', label: 'Frecuentes' },
            { value: 'empresas', label: 'Empresas' },
            { value: 'inactivos', label: 'Inactivos' },
          ]}
        />
        <div className="relative max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input className="pl-10" type="search" aria-label="Buscar clientes" placeholder="Buscar por nombre, teléfono o CUIT" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <p className="mb-2 text-sm text-ink-300" aria-live="polite">
        {rows.length} cliente{rows.length === 1 ? '' : 's'}
        {seg === 'deudores' && totalDebt > 0 && (
          <>
            {' '}
            · total a cobrar en cuentas corrientes: <b className="tabular text-white">{money(totalDebt)}</b>
          </>
        )}
      </p>
      <Card>
        {rows.length === 0 ? (
          <Empty
            icon={<Users size={22} />}
            action={
              (q || seg !== 'todos') && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ('')
                    setSeg('todos')
                  }}
                >
                  Ver todos los clientes
                </Button>
              )
            }
          >
            {q ? `No encontramos clientes para “${q.trim()}”.` : 'Ningún cliente cumple con este segmento por ahora.'}
          </Empty>
        ) : (
          <DataTable caption="Listado de clientes" columns={columns} rows={rows} rowKey={(r) => r.c.id} onRowClick={(r) => setOpen(r.c.id)} rowLabel={(r) => `${r.c.name}. Abrir ficha del cliente`} />
        )}
      </Card>
      {open && <ClientDetail id={open} onClose={() => setOpen(null)} />}
      {creating && <NewClient onClose={() => setCreating(false)} onCreated={(id) => setOpen(id)} />}
    </div>
  )
}

function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const me = useMe()!
  const state = useStore()
  const guard = useGuard()
  const c = state.clients.find((x) => x.id === id)!
  const st = clientStats(state, c)
  const entries = state.accounts.filter((a) => a.clientId === id).sort((a, b) => b.at.localeCompare(a.at))
  const quotes = state.quotes.filter((q) => q.clientId === id)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('transferencia')
  const [limit, setLimit] = useState(String(c.creditLimit))
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const rental = c.businessId === 'alquiler'
  const payAmount = Number(amount)
  const amountError = amount && payAmount > st.balance ? `El cobro no puede superar el saldo (${money(st.balance)}).` : amount && payAmount <= 0 ? 'Ingresá un monto mayor a cero.' : ''

  // productos que más compra
  const fav = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of st.sales) for (const i of s.items) m.set(i.name, (m.get(i.name) ?? 0) + i.qty)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [st.sales])

  return (
    <Modal open onClose={onClose} title={c.name} width="max-w-3xl">
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-200">
        <span>{c.phone}</span>
        {c.email && <span className="wrap-any">· {c.email}</span>}
        {c.cuit && <span>· CUIT {c.cuit}</span>}
        <span>· {c.ivaCondition}</span>
        {c.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: rental ? 'Facturado total' : 'Compró en total', v: money(st.total) },
          { k: rental ? 'Alquileres y compras' : 'Visitas', v: String(st.visits) },
          { k: 'Ticket promedio', v: money(st.avg) },
          { k: 'Última visita', v: st.last ? date(st.last) : 'Sin visitas' },
        ].map((x) => (
          <div key={x.k} className="min-w-0 rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
            <div className="text-xs text-ink-300">{x.k}</div>
            <div className="tabular wrap-any mt-0.5 font-bold text-white">{x.v}</div>
          </div>
        ))}
      </div>

      {rental && c.sizes && (
        <div className="mt-3 rounded-2xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
          <span className="text-ink-300">Talles guardados:</span> <b className="text-white">calzado {c.sizes.calzado}</b> · altura {c.sizes.altura} cm · ropa {c.sizes.ropa}
          <span className="block text-xs text-ink-300">Se proponen solos en la próxima reserva.</span>
        </div>
      )}

      {(c.creditLimit > 0 || can(me, 'clientes.credito')) && (
        <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Cuenta corriente</div>
              <div className="text-sm text-ink-200">
                {c.creditLimit > 0 ? (
                  <>
                    Saldo <b className={st.balance > 0 ? 'text-amber-200' : 'text-white'}>{money(st.balance)}</b> de un límite de {money(c.creditLimit)}
                    {st.debtDays > 0 && <span className="block text-xs text-ink-300">Deuda más antigua: {st.debtDays} días</span>}
                  </>
                ) : (
                  'Este cliente todavía no tiene cuenta corriente habilitada.'
                )}
              </div>
            </div>
            {can(me, 'clientes.credito') && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  state.updateClient(c.id, { creditLimit: Number(limit) || 0 })
                }}
              >
                <Input className="w-36" label="Límite de crédito" type="number" inputMode="numeric" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} />
                <Button type="submit" variant="secondary">
                  Guardar
                </Button>
              </form>
            )}
          </div>
          {st.balance > 0 && (
            <form
              className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
              onSubmit={(e) => {
                e.preventDefault()
                guard(() => {
                  const err = state.payAccount(c.id, payAmount, method)
                  setError(err ?? '')
                  if (!err) setAmount('')
                })
              }}
            >
              <Input label="Monto a cobrar" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} error={amountError} hint={!amountError ? `Saldo actual: ${money(st.balance)}` : undefined} />
              <Select label="Medio de pago" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo (suma a la caja abierta)</option>
                <option value="tarjeta">Tarjeta</option>
              </Select>
              <div className="flex gap-2 sm:mt-6">
                <Button type="button" variant="ghost" onClick={() => setAmount(String(st.balance))}>
                  Cobrar todo
                </Button>
                <Button type="submit" disabled={!payAmount || !!amountError}>
                  Registrar cobro
                </Button>
              </div>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          {entries.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto" tabIndex={0} role="region" aria-label="Movimientos de la cuenta corriente">
              {entries.map((e) => (
                <div key={e.id} className="flex justify-between gap-3 border-t border-white/10 py-2 text-sm">
                  <span className="min-w-0 text-ink-200">
                    {date(e.at)} · {e.ref}
                    {e.method && ` · ${payLabel[e.method]}`}
                  </span>
                  <span className={cx('tabular shrink-0 font-semibold', e.type === 'cargo' ? 'text-amber-200' : 'text-emerald-300')}>
                    {e.type === 'cargo' ? 'Cargo +' : 'Pago −'}
                    {money(e.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-white">{rental ? 'Alquileres' : 'Últimas compras'}</h3>
          {rental
            ? st.reservations.slice(0, 8).map((r) => (
                <div key={r.id} className="border-b border-white/10 py-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-white">
                      #{r.number} · {date(r.from)} ({r.days} d)
                    </span>
                    <span className="tabular shrink-0 text-ink-100">{money(r.total)}</span>
                  </div>
                  <div className="wrap-any text-xs text-ink-300">{linesText(r)}</div>
                </div>
              ))
            : st.sales.slice(0, 8).map((s) => (
                <div key={s.id} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm">
                  <span className="text-ink-200">
                    {dateTime(s.at)} · {s.items.length} producto{s.items.length === 1 ? '' : 's'}
                  </span>
                  <span className="tabular shrink-0 text-white">{money(s.total)}</span>
                </div>
              ))}
          {!st.sales.length && !st.reservations.length && <p className="text-sm text-ink-300">Todavía no hay movimientos de este cliente.</p>}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-white">Lo que más compra</h3>
          {fav.length ? (
            fav.map(([name, q]) => (
              <div key={name} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm">
                <span className="wrap-any text-ink-100">{name}</span>
                <span className="tabular shrink-0 text-ink-300">{q}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-300">Sin datos de compras.</p>
          )}
          {quotes.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-sm font-semibold text-white">Presupuestos</h3>
              {quotes.map((q) => (
                <div key={q.id} className="flex justify-between gap-3 border-b border-white/10 py-2 text-sm">
                  <span className="text-ink-200">
                    #{q.number} · {date(q.at)} · {q.status}
                  </span>
                  <span className="tabular shrink-0 text-white">{money(q.total)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <form
        className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          guard(() => {
            if (!text.trim()) return
            state.sendMessage({ businessId: c.businessId, channel: 'WhatsApp', to: `${c.name} · ${c.phone}`, subject: 'Mensaje directo', body: text.trim() })
            setText('')
          })
        }}
      >
        <Input label="Mensaje directo por WhatsApp" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Hola ${c.name.split(' ')[0]}, …`} />
        <div className="flex items-center gap-2">
          <Button type="submit" variant="secondary" disabled={!text.trim()}>
            <MessageCircle size={15} aria-hidden /> Enviar
          </Button>
          <Simulated />
        </div>
      </form>
    </Modal>
  )
}

function NewClient({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const me = useMe()!
  const state = useStore()
  const guard = useGuard()
  const rental = state.businessId === 'alquiler'
  const [f, setF] = useState({ name: '', phone: '', email: '', cuit: '', limit: '0', calzado: '', altura: '', ropa: 'M' })
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const cuitDigits = f.cuit.replace(/\D/g, '')
  const errors = {
    name: !f.name.trim() ? 'Escribí el nombre o la razón social.' : state.clients.some((c) => c.businessId === state.businessId && c.name.toLowerCase() === f.name.trim().toLowerCase()) ? 'Ya existe un cliente con ese nombre.' : '',
    phone: !f.phone.trim() ? 'El teléfono sirve para avisos y recordatorios.' : f.phone.replace(/\D/g, '').length < 8 ? 'El teléfono parece incompleto.' : '',
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) ? 'El email no parece válido.' : '',
    cuit: f.cuit && !isValidCuit(cuitDigits) ? 'El CUIT no es válido (11 dígitos, revisá el dígito verificador).' : '',
  }
  const valid = Object.values(errors).every((e) => !e)
  const submit = () =>
    guard(() => {
      setTouched(true)
      if (!valid) return
      const c: Client = state.addClient({
        name: f.name.trim(),
        phone: f.phone.trim(),
        email: f.email.trim() || undefined,
        cuit: cuitDigits || undefined,
        ivaCondition: cuitDigits ? 'IVA Responsable Inscripto' : 'Consumidor final',
        creditLimit: Number(f.limit) || 0,
        tags: ['nuevo'],
        sizes: rental ? { calzado: f.calzado || undefined, altura: Number(f.altura) || undefined, ropa: f.ropa } : undefined,
      })
      onClose()
      onCreated(c.id)
    })
  return (
    <Modal
      open
      onClose={onClose}
      title="Nuevo cliente"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            <Plus size={15} aria-hidden /> Crear cliente
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="sm:col-span-2">
          <Input label="Nombre o razón social *" value={f.name} onChange={set('name')} error={touched ? errors.name : ''} />
        </div>
        <Input label="Teléfono *" type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} error={touched ? errors.phone : ''} />
        <Input label="Email" type="email" inputMode="email" value={f.email} onChange={set('email')} error={touched ? errors.email : ''} />
        <Input label="CUIT" inputMode="numeric" value={f.cuit} onChange={set('cuit')} hint="Para facturar con factura A." error={touched || f.cuit.length > 10 ? errors.cuit : ''} />
        {can(me, 'clientes.credito') && <Input label="Límite de cuenta corriente" type="number" inputMode="numeric" min={0} value={f.limit} onChange={set('limit')} hint="0 = sin cuenta corriente." />}
        {rental && (
          <>
            <Input label="Calzado" inputMode="numeric" value={f.calzado} onChange={set('calzado')} placeholder="Ej.: 40" />
            <Input label="Altura (cm)" inputMode="numeric" value={f.altura} onChange={set('altura')} placeholder="Ej.: 172" />
            <Select label="Talle de ropa" value={f.ropa} onChange={set('ropa')}>
              {['S', 'M', 'L', 'XL'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </Select>
          </>
        )}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}
