import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Camera, CheckCircle2, Minus, Plus, ScanLine, Search, Split, Trash2, Landmark, WifiOff, Percent } from 'lucide-react'
import { currentSession, sellableStockOf, useMe, useOnline, useStore, type CartLine } from '../store'
import { businesses } from '../data/seed'
import { can, discountCap } from '../lib/permissions'
import { formatCuit, money } from '../lib/format'
import { demoCuits, lookupCuit } from '../lib/arca'
import type { Customer, Payment, ReceiptKind, Sale } from '../types'
import { Badge, Button, Input, Modal, Select, cx } from '../components/ui'
import Scanner from '../components/Scanner'
import Receipt from '../components/Receipt'
import { OpenSessionForm } from './Caja'
import { categoryStyle } from '../lib/categories'

type Method = 'efectivo' | 'transferencia' | 'mixto'

export default function Venta() {
  const me = useMe()!
  const online = useOnline()
  const state = useStore()
  const session = currentSession(state)
  const biz = businesses[state.businessId]

  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [notice, setNotice] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [unknownCode, setUnknownCode] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500)
      return () => clearTimeout(t)
    }
  }, [notice])

  const add = useCallback(
    (productId: string) => {
      const p = state.products.find((x) => x.id === productId)!
      const inCart = cart.find((l) => l.productId === productId)?.qty ?? 0
      if (sellableStockOf(state.lots, productId) <= inCart) {
        setNotice(`Sin stock vendible de ${p.name}`)
        return
      }
      setCart((c) => (c.some((l) => l.productId === productId) ? c.map((l) => (l.productId === productId ? { ...l, qty: l.qty + 1 } : l)) : [...c, { productId, qty: 1 }]))
    },
    [cart, state.products, state.lots],
  )

  const handleCode = useCallback(
    (code: string) => {
      setScanOpen(false)
      const p = products.find((x) => x.barcode === code)
      if (p) add(p.id)
      else setUnknownCode(code)
    },
    [products, add],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.barcode?.includes(q)))
  }, [products, query, category])

  const onSearchEnter = () => {
    const q = query.trim()
    if (!q) return
    const exact = products.find((p) => p.barcode === q)
    if (exact) add(exact.id)
    else if (/^\d{8,14}$/.test(q)) setUnknownCode(q)
    else if (filtered.length === 1) add(filtered[0].id)
    else return
    setQuery('')
  }

  const lines = cart.map((l) => ({ ...l, product: state.products.find((p) => p.id === l.productId)! }))
  const subtotal = lines.reduce((a, l) => a + l.qty * l.product.price, 0)
  const total = Math.round(subtotal * (1 - discount / 100) * 100) / 100
  const cap = discountCap(me.role)

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-xl font-semibold">Vender</h1>
        <OpenSessionForm compact />
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 pb-20 lg:grid-cols-[1fr_380px] lg:pb-0">
      {/* Productos */}
      <div className="min-w-0 animate-rise">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
              placeholder="Buscar producto o escanear código…"
              className="h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-24 text-base font-medium text-ink-900 shadow-soft ring-1 ring-ink-900/[0.06] outline-none transition placeholder:text-ink-300 focus:ring-2 focus:ring-brand-500"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-canvas px-2 py-1 text-[10px] font-bold text-ink-400 ring-1 ring-ink-200 sm:block">ENTER</kbd>
          </div>
          <button
            onClick={() => setScanOpen(true)}
            title="Escanear con la cámara"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink-900 text-lime-400 shadow-soft transition hover:bg-ink-800 active:scale-95"
          >
            <Camera size={22} />
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory(null)}
            className={cx('whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition', !category ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-ink-300')}
          >
            Todo
          </button>
          {categories.map((c) => {
            const { icon: Icon } = categoryStyle(c)
            return (
              <button
                key={c}
                onClick={() => setCategory(c === category ? null : c)}
                className={cx('flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition', category === c ? 'bg-ink-900 text-white' : 'bg-white text-ink-600 ring-1 ring-ink-200 hover:ring-ink-300')}
              >
                <Icon size={14} className={category === c ? 'text-lime-400' : 'text-ink-400'} />
                {c}
              </button>
            )
          })}
        </div>
        {notice && <div className="mt-3 rounded-xl bg-amber-50 px-5 py-3.5 text-sm font-medium text-amber-800 ring-1 ring-amber-200 animate-rise">{notice}</div>}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const stock = sellableStockOf(state.lots, p.id)
            const qtyInCart = cart.find((l) => l.productId === p.id)?.qty ?? 0
            const { icon: Icon, tone } = categoryStyle(p.category)
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                disabled={stock === 0}
                className={cx(
                  'group relative flex flex-col rounded-2xl bg-white p-3.5 text-left shadow-soft ring-1 transition',
                  qtyInCart ? 'ring-2 ring-brand-500' : 'ring-ink-900/[0.06] hover:-translate-y-0.5 hover:shadow-lift hover:ring-brand-200',
                  stock === 0 && 'cursor-not-allowed opacity-40 hover:translate-y-0',
                )}
              >
                <div className="mb-3 flex items-start justify-between">
                  <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                    <Icon size={20} />
                  </span>
                  {qtyInCart > 0 && <span className="tabular flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-500 px-2 text-xs font-extrabold text-white animate-pop">{qtyInCart}</span>}
                </div>
                <span className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-ink-900">{p.name}</span>
                <span className="tabular mt-2 text-lg font-extrabold tracking-tight text-ink-900">{money(p.price)}</span>
                <span className={cx('mt-0.5 text-[11px] font-semibold', stock === 0 ? 'text-rose-600' : stock <= p.minStock ? 'text-amber-600' : 'text-ink-300')}>
                  {stock === 0 ? 'Sin stock' : `${stock} en stock`}
                  {!p.barcode && <span className="text-ink-300"> · sin código</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ticket: panel oscuro para que el total sea lo primero que se ve */}
      <div className="ink-surface flex h-fit flex-col overflow-hidden rounded-3xl text-white shadow-2xl animate-rise lg:sticky lg:top-0">
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <div>
            <div className="text-lg font-extrabold tracking-tight">Ticket</div>
            <div className="text-xs font-medium text-ink-300">
              {session.register} · {me.name.split(' ')[0]}
            </div>
          </div>
          {lines.length > 0 && (
            <button onClick={() => setCart([])} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-300 transition hover:bg-white/10 hover:text-white">
              Vaciar
            </button>
          )}
        </div>
        {!online && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-200 ring-1 ring-rose-400/30">
            <WifiOff size={14} className="mt-px shrink-0" /> Sin conexión: se puede vender y cobrar en efectivo. Todo queda guardado en el equipo.
          </div>
        )}
        <div className="max-h-[42vh] min-h-[180px] overflow-y-auto px-3">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center px-2 py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-ink-300">
                <ScanLine size={22} />
              </div>
              <div className="text-sm font-semibold text-ink-200">Ticket vacío</div>
              <div className="mt-0.5 text-xs text-ink-400">Escaneá o tocá un producto para agregarlo</div>
            </div>
          ) : (
            lines.map((l) => (
              <div key={l.productId} className="group flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-white/[0.05]">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{l.product.name}</div>
                  <div className="tabular text-xs text-ink-300">{money(l.product.price)} c/u</div>
                </div>
                <div className="flex items-center rounded-lg bg-white/[0.07] p-0.5">
                  <button
                    className="rounded-md p-1.5 text-ink-200 transition hover:bg-white/10"
                    onClick={() => setCart((c) => c.flatMap((x) => (x.productId === l.productId ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))}
                    aria-label="Quitar uno"
                  >
                    <Minus size={13} />
                  </button>
                  <span className="tabular w-6 text-center text-sm font-bold">{l.qty}</span>
                  <button className="rounded-md p-1.5 text-ink-200 transition hover:bg-white/10" onClick={() => add(l.productId)} aria-label="Agregar uno">
                    <Plus size={13} />
                  </button>
                </div>
                <div className="tabular w-[84px] text-right text-sm font-bold">{money(l.qty * l.product.price)}</div>
                <button className="rounded-md p-1 text-ink-400 transition hover:text-rose-400" onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))} aria-label="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="mt-2 border-t border-white/10 px-5 pb-5 pt-4">
          {can(me.role, 'descuento') ? (
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-ink-200">
                <Percent size={14} className="text-lime-400" /> Descuento <span className="text-xs text-ink-400">tope {cap}%</span>
              </span>
              <input
                type="number"
                min={0}
                max={cap}
                value={discount || ''}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Math.min(cap, Number(e.target.value) || 0)))}
                className="tabular w-16 rounded-lg border-0 bg-white/10 px-2 py-1.5 text-right text-sm font-bold text-white outline-none ring-1 ring-white/15 placeholder:text-ink-400 focus:ring-lime-400"
              />
            </div>
          ) : (
            <div className="mb-3 text-xs text-ink-400">Tu rol no permite aplicar descuentos.</div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-ink-300">
              <span>Subtotal</span>
              <span className="tabular line-through">{money(subtotal)}</span>
            </div>
          )}
          <div className="flex items-end justify-between">
            <span className="pb-1.5 text-sm font-semibold text-ink-300">Total</span>
            <span key={total} className="tabular text-4xl font-extrabold tracking-tight text-lime-400 animate-pop">
              {money(total)}
            </span>
          </div>
          <Button variant="lime" size="lg" className="mt-4 h-14 w-full text-lg" disabled={!lines.length} onClick={() => setPayOpen(true)}>
            Cobrar
          </Button>
        </div>
      </div>

      {/* en el teléfono el ticket queda abajo: barra fija con total y cobro */}
      {lines.length > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 flex items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-2xl lg:hidden">
          <div className="flex-1">
            <div className="text-xs font-medium text-ink-300">{lines.reduce((a, l) => a + l.qty, 0)} productos</div>
            <div className="tabular text-xl font-extrabold text-lime-400">{money(total)}</div>
          </div>
          <Button variant="lime" size="lg" onClick={() => setPayOpen(true)}>
            Cobrar
          </Button>
        </div>
      )}

      <Scanner open={scanOpen} onClose={() => setScanOpen(false)} onCode={handleCode} />

      <UnknownCodeModal
        code={unknownCode}
        onClose={() => {
          setUnknownCode(null)
          searchRef.current?.focus()
        }}
        onAssigned={(id) => {
          add(id)
          setUnknownCode(null)
        }}
      />

      <PaymentModal
        open={payOpen}
        total={total}
        accounts={biz.transferAccounts}
        online={online}
        onClose={() => setPayOpen(false)}
        onConfirm={(p) => {
          const res = state.completeSale({ cart, discountPct: discount, ...p })
          if (res.error) return res.error
          setPayOpen(false)
          setCart([])
          setDiscount(0)
          setDone(res.sale!)
          return null
        }}
      />

      <Modal
        open={!!done}
        onClose={() => {
          setDone(null)
          searchRef.current?.focus()
        }}
        title="Venta registrada"
        footer={
          <Button
            onClick={() => {
              setDone(null)
              searchRef.current?.focus()
            }}
          >
            Nueva venta
          </Button>
        }
      >
        {done && (
          <>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 size={16} />
              Venta #{done.number} por {money(done.total)}
              {done.change ? ` · vuelto ${money(done.change)}` : ''}
              {done.createdOffline && <Badge tone="amber">guardada sin conexión</Badge>}
            </div>
            <Receipt sale={useStore.getState().sales.find((s) => s.id === done.id) ?? done} />
          </>
        )}
      </Modal>
    </div>
  )
}

function UnknownCodeModal({ code, onClose, onAssigned }: { code: string | null; onClose: () => void; onAssigned: (productId: string) => void }) {
  const me = useMe()!
  const state = useStore()
  const [productId, setProductId] = useState('')
  const [error, setError] = useState('')
  const candidates = state.products.filter((p) => p.businessId === state.businessId && !p.barcode)
  const allowed = can(me.role, 'codigo.asignar')
  return (
    <Modal open={!!code} onClose={onClose} title="Código no registrado">
      <p className="text-sm text-ink-600">
        El código <span className="font-mono font-semibold">{code}</span> todavía no está cargado en el catálogo.
      </p>
      {allowed ? (
        <>
          <p className="mt-2 text-sm text-ink-600">Asignalo al producto correspondiente: la próxima vez se reconoce solo.</p>
          <div className="mt-3">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Elegir producto sin código…</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          {error && <div className="mt-2 text-sm text-rose-600">{error}</div>}
          <div className="mt-4 flex justify-end">
            <Button
              disabled={!productId}
              onClick={() => {
                const err = state.assignBarcode(productId, code!)
                if (err) setError(err)
                else {
                  setProductId('')
                  onAssigned(productId)
                }
              }}
            >
              Asignar y agregar al ticket
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Pedile a un Encargado que lo asigne. Mientras tanto, buscá el producto por nombre.</p>
      )}
    </Modal>
  )
}

function PaymentModal({
  open,
  total,
  accounts,
  online,
  onClose,
  onConfirm,
}: {
  open: boolean
  total: number
  accounts: string[]
  online: boolean
  onClose: () => void
  onConfirm: (p: { payments: Payment[]; cashReceived?: number; receiptKind: ReceiptKind; customer?: Customer }) => string | null
}) {
  const [method, setMethod] = useState<Method>('efectivo')
  const [received, setReceived] = useState('')
  const [cashPart, setCashPart] = useState('')
  const [account, setAccount] = useState(accounts[0])
  const [kind, setKind] = useState<ReceiptKind>('B')
  const [cuit, setCuit] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cuitError, setCuitError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setMethod('efectivo')
      setReceived('')
      setCashPart('')
      setKind('B')
      setCuit('')
      setCustomer(null)
      setError('')
      setCuitError('')
    }
  }, [open])

  const cashAmount = method === 'efectivo' ? total : method === 'mixto' ? Math.min(total, Number(cashPart) || 0) : 0
  const transferAmount = Math.round((total - cashAmount) * 100) / 100
  const receivedNum = received === '' ? cashAmount : Number(received)
  const change = cashAmount > 0 ? receivedNum - cashAmount : 0

  const bills = [1000, 2000, 5000, 10000, 20000].filter((b) => b > cashAmount).slice(0, 3)
  const roundUp = Math.ceil(cashAmount / 1000) * 1000

  const lookup = () => {
    const res = lookupCuit(cuit)
    if (!res) {
      setCustomer(null)
      setCuitError('CUIT inválido (revisá el dígito verificador).')
      return
    }
    setCuitError(res.active ? '' : 'Atención: el CUIT figura inactivo en el padrón. ARCA va a rechazar la factura.')
    setCustomer({ cuit: res.cuit, name: res.name, ivaCondition: res.ivaCondition, address: res.address })
  }

  const confirm = () => {
    const payments: Payment[] = []
    if (cashAmount > 0) payments.push({ method: 'efectivo', amount: cashAmount })
    if (transferAmount > 0) payments.push({ method: 'transferencia', amount: transferAmount, account })
    const err = onConfirm({
      payments,
      cashReceived: cashAmount > 0 ? receivedNum : undefined,
      receiptKind: kind,
      customer: kind === 'A' ? customer ?? undefined : undefined,
    })
    if (err) setError(err)
  }

  const invalid = (cashAmount > 0 && receivedNum < cashAmount) || (kind === 'A' && !customer) || (method === 'mixto' && (cashAmount <= 0 || cashAmount >= total))

  return (
    <Modal open={open} onClose={onClose} title={`Cobrar ${money(total)}`} width="max-w-xl">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['efectivo', 'Efectivo', Banknote],
            ['transferencia', 'Transferencia', Landmark],
            ['mixto', 'Mixto', Split],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            onClick={() => setMethod(m)}
            className={cx('flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-medium', method === m ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-ink-900/10 text-ink-600 hover:bg-canvas')}
          >
            <Icon size={20} /> {label}
          </button>
        ))}
      </div>

      {method === 'mixto' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Input label="Parte en efectivo" type="number" min={0} value={cashPart} onChange={(e) => setCashPart(e.target.value)} autoFocus />
          <div>
            <span className="mb-1 block text-xs font-medium text-ink-600">Parte por transferencia</span>
            <div className="tabular rounded-lg bg-canvas px-3 py-2 text-sm font-semibold">{money(transferAmount)}</div>
          </div>
        </div>
      )}

      {cashAmount > 0 && (
        <div className="mt-4">
          <Input label={`Efectivo recibido (a cobrar ${money(cashAmount)})`} type="number" min={0} value={received} placeholder={String(cashAmount)} onChange={(e) => setReceived(e.target.value)} autoFocus={method === 'efectivo'} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setReceived(String(cashAmount))}>
              Justo
            </Button>
            {roundUp > cashAmount && (
              <Button size="sm" variant="secondary" onClick={() => setReceived(String(roundUp))}>
                {money(roundUp)}
              </Button>
            )}
            {bills
              .filter((b) => b !== roundUp)
              .map((b) => (
                <Button key={b} size="sm" variant="secondary" onClick={() => setReceived(String(b))}>
                  {money(b)}
                </Button>
              ))}
          </div>
          <div className={cx('mt-3 flex items-center justify-between rounded-xl px-4 py-3', change < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800')}>
            <span className="text-sm font-bold">{change < 0 ? 'Falta' : 'Vuelto'}</span>
            <span className="tabular text-2xl font-bold">{money(Math.abs(change))}</span>
          </div>
        </div>
      )}

      {transferAmount > 0 && (
        <div className="mt-4">
          <Select label={`Cuenta que recibe la transferencia (${money(transferAmount)})`} value={account} onChange={(e) => setAccount(e.target.value)}>
            {accounts.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          {!online && <p className="mt-1 text-xs text-amber-700">Sin conexión: la transferencia se registra y se verifica al volver internet.</p>}
        </div>
      )}

      <div className="mt-5 border-t border-ink-900/[0.06] pt-4">
        <div className="mb-2 text-xs font-medium text-ink-600">Comprobante</div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['B', 'Factura B', 'Consumidor final'],
              ['A', 'Factura A', 'Con CUIT'],
              ['ticket', 'Interno', 'Sin factura'],
            ] as const
          ).map(([k, label, hint]) => (
            <button key={k} onClick={() => setKind(k)} className={cx('rounded-xl border px-2 py-2 text-left', kind === k ? 'border-brand-600 bg-brand-50' : 'border-ink-900/10 hover:bg-canvas')}>
              <div className="text-sm font-bold">{label}</div>
              <div className="text-[11px] text-ink-400">{hint}</div>
            </button>
          ))}
        </div>
        {kind === 'A' && (
          <div className="mt-3">
            <div className="flex gap-2">
              <Input placeholder="CUIT del cliente" value={cuit} onChange={(e) => setCuit(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup()} />
              <Button variant="secondary" onClick={lookup} disabled={!online} title={online ? '' : 'La consulta al padrón requiere conexión'}>
                Consultar
              </Button>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-ink-400">
              CUITs de prueba:
              {demoCuits.map((c) => (
                <button key={c} className="font-mono text-brand-700 hover:underline" onClick={() => setCuit(c)}>
                  {formatCuit(c)}
                </button>
              ))}
            </div>
            {cuitError && <div className="mt-2 text-xs text-rose-600">{cuitError}</div>}
            {customer && (
              <div className="mt-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                <div className="font-bold">{customer.name}</div>
                <div className="text-xs text-ink-400">
                  {customer.ivaCondition} · {customer.address}
                </div>
              </div>
            )}
          </div>
        )}
        {kind !== 'ticket' && !online && <p className="mt-2 text-xs text-amber-700">Sin conexión: la venta se completa y la factura queda en contingencia hasta que vuelva internet.</p>}
      </div>

      {error && <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <Button size="lg" variant="success" className="mt-5 w-full" disabled={invalid} onClick={confirm}>
        Confirmar venta
      </Button>
    </Modal>
  )
}
