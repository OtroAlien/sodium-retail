import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, Camera, CheckCircle2, Minus, Plus, Search, Split, Trash2, Landmark, WifiOff, Percent } from 'lucide-react'
import { currentSession, sellableStockOf, useMe, useOnline, useStore, type CartLine } from '../store'
import { businesses } from '../data/seed'
import { can, discountCap } from '../lib/permissions'
import { formatCuit, money } from '../lib/format'
import { demoCuits, lookupCuit } from '../lib/arca'
import type { Customer, Payment, ReceiptKind, Sale } from '../types'
import { Badge, Button, Card, Input, Modal, Select, cx } from '../components/ui'
import Scanner from '../components/Scanner'
import Receipt from '../components/Receipt'
import { OpenSessionForm } from './Caja'

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
      <div className="min-w-0">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
              placeholder="Buscar por nombre o escanear código de barras…"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Button variant="secondary" size="lg" onClick={() => setScanOpen(true)} title="Escanear con la cámara">
            <Camera size={20} />
          </Button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setCategory(null)} className={cx('whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium', !category ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
            Todo
          </button>
          {categories.map((c) => (
            <button key={c} onClick={() => setCategory(c === category ? null : c)} className={cx('whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium', category === c ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200')}>
              {c}
            </button>
          ))}
        </div>
        {notice && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</div>}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const stock = sellableStockOf(state.lots, p.id)
            return (
              <button
                key={p.id}
                onClick={() => add(p.id)}
                className={cx('flex flex-col rounded-xl border bg-white p-3 text-left transition hover:border-brand-500 hover:shadow-sm', stock === 0 ? 'border-slate-200 opacity-50' : 'border-slate-200')}
              >
                <span className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-slate-800">{p.name}</span>
                <span className="tabular mt-1 text-base font-semibold text-brand-700">{money(p.price)}</span>
                <span className={cx('mt-0.5 text-[11px]', stock <= p.minStock ? 'text-amber-600' : 'text-slate-400')}>
                  Stock {stock}
                  {!p.barcode && ' · sin código'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ticket */}
      <Card className="flex h-fit flex-col lg:sticky lg:top-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="font-semibold">Ticket</div>
          <div className="text-xs text-slate-500">
            {session.register} · {me.name.split(' ')[0]}
          </div>
        </div>
        {!online && (
          <div className="flex items-center gap-2 bg-rose-50 px-4 py-2 text-xs text-rose-700">
            <WifiOff size={14} /> Sin conexión: se puede vender y cobrar en efectivo. Todo queda guardado en el equipo.
          </div>
        )}
        <div className="max-h-[45vh] min-h-[160px] overflow-y-auto px-2 py-2">
          {lines.length === 0 ? (
            <div className="px-2 py-10 text-center text-sm text-slate-400">Escaneá o tocá un producto para agregarlo</div>
          ) : (
            lines.map((l) => (
              <div key={l.productId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{l.product.name}</div>
                  <div className="tabular text-xs text-slate-500">{money(l.product.price)} c/u</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="rounded-md p-1 text-slate-500 hover:bg-slate-200"
                    onClick={() => setCart((c) => c.flatMap((x) => (x.productId === l.productId ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))}
                    aria-label="Quitar uno"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="tabular w-6 text-center text-sm font-semibold">{l.qty}</span>
                  <button className="rounded-md p-1 text-slate-500 hover:bg-slate-200" onClick={() => add(l.productId)} aria-label="Agregar uno">
                    <Plus size={14} />
                  </button>
                </div>
                <div className="tabular w-20 text-right text-sm font-semibold">{money(l.qty * l.product.price)}</div>
                <button className="rounded-md p-1 text-slate-400 hover:text-rose-600" onClick={() => setCart((c) => c.filter((x) => x.productId !== l.productId))} aria-label="Eliminar">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          {can(me.role, 'descuento') ? (
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-slate-600">
                <Percent size={14} /> Descuento <span className="text-xs text-slate-400">(tope {cap}%)</span>
              </span>
              <input
                type="number"
                min={0}
                max={cap}
                value={discount || ''}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Math.min(cap, Number(e.target.value) || 0)))}
                className="tabular w-16 rounded-md border border-slate-300 px-2 py-1 text-right text-sm"
              />
            </div>
          ) : (
            <div className="mb-2 text-xs text-slate-400">Tu rol no permite aplicar descuentos.</div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>Subtotal</span>
              <span className="tabular">{money(subtotal)}</span>
            </div>
          )}
          <div className="flex items-end justify-between">
            <span className="text-sm text-slate-600">Total</span>
            <span className="tabular text-3xl font-bold text-slate-900">{money(total)}</span>
          </div>
          <Button size="lg" className="mt-3 w-full" disabled={!lines.length} onClick={() => setPayOpen(true)}>
            Cobrar
          </Button>
        </div>
      </Card>

      {/* en el teléfono el ticket queda abajo: barra fija con total y cobro */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden">
          <div className="flex-1">
            <div className="text-xs text-slate-500">{lines.reduce((a, l) => a + l.qty, 0)} productos</div>
            <div className="tabular text-xl font-bold">{money(total)}</div>
          </div>
          <Button size="lg" onClick={() => setPayOpen(true)}>
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
      <p className="text-sm text-slate-600">
        El código <span className="font-mono font-semibold">{code}</span> todavía no está cargado en el catálogo.
      </p>
      {allowed ? (
        <>
          <p className="mt-2 text-sm text-slate-600">Asignalo al producto correspondiente: la próxima vez se reconoce solo.</p>
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
            className={cx('flex flex-col items-center gap-1 rounded-xl border py-3 text-sm font-medium', method === m ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
          >
            <Icon size={20} /> {label}
          </button>
        ))}
      </div>

      {method === 'mixto' && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Input label="Parte en efectivo" type="number" min={0} value={cashPart} onChange={(e) => setCashPart(e.target.value)} autoFocus />
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">Parte por transferencia</span>
            <div className="tabular rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold">{money(transferAmount)}</div>
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
            <span className="text-sm font-medium">{change < 0 ? 'Falta' : 'Vuelto'}</span>
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

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="mb-2 text-xs font-medium text-slate-600">Comprobante</div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['B', 'Factura B', 'Consumidor final'],
              ['A', 'Factura A', 'Con CUIT'],
              ['ticket', 'Interno', 'Sin factura'],
            ] as const
          ).map(([k, label, hint]) => (
            <button key={k} onClick={() => setKind(k)} className={cx('rounded-xl border px-2 py-2 text-left', kind === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:bg-slate-50')}>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-[11px] text-slate-500">{hint}</div>
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
            <div className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-slate-500">
              CUITs de prueba:
              {demoCuits.map((c) => (
                <button key={c} className="font-mono text-brand-700 hover:underline" onClick={() => setCuit(c)}>
                  {formatCuit(c)}
                </button>
              ))}
            </div>
            {cuitError && <div className="mt-2 text-xs text-rose-600">{cuitError}</div>}
            {customer && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div className="font-medium">{customer.name}</div>
                <div className="text-xs text-slate-500">
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
