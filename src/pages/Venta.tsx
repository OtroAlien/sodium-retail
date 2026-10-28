import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Banknote, BookUser, Camera, CheckCircle2, CreditCard, FileSignature, Landmark, Minus, Percent, Plus, QrCode, ScanLine, Search, Split, Trash2, WifiOff, XCircle } from 'lucide-react'
import { currentSession, formatQty, hasPromo, priceOf, sellableStockOf, unitOf, useMe, useOnline, useStore, type CartLine } from '../store'
import { clientBalance } from '../store/selectors'
import { businesses } from '../data/seed'
import { can, discountCap } from '../lib/permissions'
import { formatCuit, money } from '../lib/format'
import { demoCuits, lookupCuit } from '../lib/arca'
import { categoryStyle } from '../lib/categories'
import type { Client, Customer, Payment, Product, Quote, ReceiptKind, Sale } from '../types'
import { Badge, Button, Empty, Input, Modal, Select, cx, useGuard } from '../components/ui'
import { ClientPicker, Simulated } from '../components/common'
import Scanner from '../components/Scanner'
import Receipt from '../components/Receipt'
import { OpenSessionForm } from './Caja'
import { useConfirm } from '../components/feedback'

type Method = 'efectivo' | 'transferencia' | 'mixto' | 'tarjeta' | 'qr' | 'cuenta_corriente'

/** un mosaico del catálogo: un producto, o un grupo de variantes (ferretería) */
interface Tile {
  key: string
  name: string
  category: string
  products: Product[]
}

export default function Venta() {
  const me = useMe()!
  const online = useOnline()
  const state = useStore()
  const session = currentSession(state)
  const biz = businesses[state.businessId]
  const hardware = biz.kind === 'hardware'

  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))), [products])

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [clientId, setClientId] = useState<string | undefined>()
  const [quoteId, setQuoteId] = useState<string | undefined>()
  const [discount, setDiscount] = useState(0)
  const [notice, setNotice] = useState('')
  const [scanOpen, setScanOpen] = useState(false)
  const [unknownCode, setUnknownCode] = useState<string | null>(null)
  const [variantTile, setVariantTile] = useState<Tile | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [done, setDone] = useState<Sale | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // carrito preparado desde otra pantalla (ej.: presupuesto aceptado)
  useEffect(() => {
    const d = state.posDraft
    if (!d) return
    setCart(d.lines)
    setClientId(d.clientId)
    setQuoteId(d.quoteId)
    setDiscount(d.discountPct ?? 0)
    state.setPosDraft(null)
    setNotice(d.quoteId ? 'Presupuesto cargado en el ticket. Revisá y cobrá.' : '')
  }, [state.posDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4000)
      return () => clearTimeout(t)
    }
  }, [notice])

  const baseQtyInCart = (productId: string, except?: CartLine) =>
    cart.filter((l) => l.productId === productId && l !== except).reduce((a, l) => a + l.qty * unitOf(products.find((p) => p.id === productId)!, l.unitId).factor, 0)

  const add = useCallback(
    (productId: string, unitId?: string, qty = 1) => {
      const p = state.products.find((x) => x.id === productId)!
      const factor = unitOf(p, unitId).factor
      if (sellableStockOf(state.lots, productId) < baseQtyInCart(productId) + qty * factor) {
        setNotice(`Sin stock suficiente de ${p.name}`)
        return
      }
      const same = (l: CartLine) => l.productId === productId && (l.unitId ?? 'base') === (unitId ?? 'base')
      setCart((c) => (c.some(same) ? c.map((l) => (same(l) ? { ...l, qty: l.qty + qty } : l)) : [...c, { productId, qty, unitId: unitId === 'base' ? undefined : unitId }]))
    },
    [cart, state.products, state.lots], // eslint-disable-line react-hooks/exhaustive-deps
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

  const tiles = useMemo<Tile[]>(() => {
    const q = query.trim().toLowerCase()
    const list = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.barcode?.includes(q)))
    if (!hardware) return list.map((p) => ({ key: p.id, name: p.name, category: p.category, products: [p] }))
    const groups = new Map<string, Tile>()
    for (const p of list) {
      const key = p.group ?? p.id
      const t = groups.get(key) ?? { key, name: p.group ?? p.name, category: p.category, products: [] }
      t.products.push(p)
      groups.set(key, t)
    }
    return [...groups.values()]
  }, [products, query, category, hardware])

  const onTile = (t: Tile) => {
    if (t.products.length === 1 && !(t.products[0].units && t.products[0].units.length > 1)) add(t.products[0].id)
    else setVariantTile(t)
  }

  const onSearchEnter = () => {
    const q = query.trim()
    if (!q) return
    const exact = products.find((p) => p.barcode === q)
    if (exact) add(exact.id)
    else if (/^\d{8,14}$/.test(q)) setUnknownCode(q)
    else if (tiles.length === 1) onTile(tiles[0])
    else return
    setQuery('')
  }

  const lines = cart.map((l) => {
    const product = state.products.find((p) => p.id === l.productId)!
    const unit = unitOf(product, l.unitId)
    // un precio congelado (presupuesto) manda sobre el precio actual
    return { ...l, product, unit: l.price !== undefined ? { ...unit, price: l.price } : unit }
  })
  const subtotal = lines.reduce((a, l) => a + l.qty * l.unit.price, 0)
  const total = Math.round(subtotal * (1 - discount / 100) * 100) / 100
  const cap = discountCap(me)
  const client = state.clients.find((c) => c.id === clientId)

  const confirm = useConfirm()
  const clearTicket = async () => {
    // con más de un renglón se pide confirmación para no perder el armado por un toque accidental
    if (cart.length >= 2 && !(await confirm({ title: 'Vaciar el ticket', message: `Se van a quitar ${cart.length} productos del ticket actual. No se registra ninguna venta.`, confirmLabel: 'Vaciar ticket', danger: true }))) return
    resetTicket()
  }
  const resetTicket = () => {
    setCart([])
    setDiscount(0)
    setClientId(undefined)
    setQuoteId(undefined)
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Vender</h1>
        <OpenSessionForm compact />
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_400px]">
      <div className="min-w-0 animate-rise">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" aria-hidden />
            <input
              ref={searchRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchEnter()}
              aria-label="Buscar producto o escanear un código de barras"
              enterKeyHint="search"
              placeholder={hardware ? 'Buscar producto o medida…' : 'Buscar producto…'}
              className="glass h-14 w-full rounded-full border-0 pl-12 pr-4 text-base font-medium sm:pr-24 text-white outline-none transition placeholder:text-ink-400 focus:ring-2 focus:ring-brand-200"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-white/[0.06] px-2 py-1 text-[11px] font-bold text-ink-300 ring-1 ring-white/15 sm:block">ENTER</kbd>
          </div>
          <button onClick={() => setScanOpen(true)} aria-label="Escanear código con la cámara" title="Escanear con la cámara" className="glass flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15 active:scale-95">
            <Camera size={22} aria-hidden />
          </button>
        </div>
        <div className="scroll-x mt-4 flex gap-2 pb-1" role="group" aria-label="Categorías">
          <button onClick={() => setCategory(null)} aria-pressed={!category} className={cx('min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition', !category ? 'bg-white text-ink-900 shadow-glow' : 'glass text-ink-200 hover:text-white')}>
            Todo
          </button>
          {categories.map((c) => {
            const { icon: Icon } = categoryStyle(c)
            return (
              <button
                key={c}
                onClick={() => setCategory(c === category ? null : c)}
                aria-pressed={category === c}
                className={cx('flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition', category === c ? 'bg-white text-ink-900 shadow-glow' : 'glass text-ink-200 hover:text-white')}
              >
                <Icon size={14} className={category === c ? 'text-ink-900' : 'text-ink-300'} aria-hidden />
                {c}
              </button>
            )
          })}
        </div>
        {notice && <div className="mt-3 rounded-xl bg-amber-400/12 px-4 py-2.5 text-sm font-medium text-amber-200 ring-1 ring-amber-300/25 animate-rise">{notice}</div>}
        {tiles.length === 0 && (
          <div className="glass mt-4 rounded-2xl">
            <Empty
              icon={<Search size={22} />}
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery('')
                    setCategory(null)
                  }}
                >
                  Quitar búsqueda y filtros
                </Button>
              }
            >
              No encontramos productos {query.trim() ? `para “${query.trim()}”` : 'en esta categoría'}. Probá con otra palabra o escaneá el código de barras.
            </Empty>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {tiles.map((t) => {
            const p = t.products[0]
            const multi = t.products.length > 1
            const stock = t.products.reduce((a, x) => a + sellableStockOf(state.lots, x.id), 0)
            const low = t.products.some((x) => sellableStockOf(state.lots, x.id) <= x.minStock)
            const inCart = cart.filter((l) => t.products.some((x) => x.id === l.productId)).reduce((a, l) => a + l.qty, 0)
            const { icon: Icon, tone } = categoryStyle(t.category)
            const minPrice = Math.min(...t.products.map((x) => priceOf(x)))
            const promo = !multi && hasPromo(p)
            return (
              <button
                key={t.key}
                onClick={() => onTile(t)}
                disabled={stock <= 0}
                className={cx(
                  'glass group relative flex flex-col rounded-2xl p-3.5 text-left ring-1 transition',
                  inCart ? 'ring-2 ring-white/70 shadow-glow' : 'ring-white/10 hover:-translate-y-0.5 hover:shadow-lift hover:ring-white/30',
                  stock <= 0 && 'cursor-not-allowed opacity-40 hover:translate-y-0',
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', tone)}>
                    <Icon size={20} aria-hidden />
                  </span>
                  {inCart > 0 ? (
                    <span className="tabular flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-xs font-bold text-ink-900 shadow-glow animate-pop">{inCart}</span>
                  ) : promo ? (
                    <Badge tone="green">Promo</Badge>
                  ) : multi ? (
                    <Badge>{t.products.length} variantes</Badge>
                  ) : null}
                </div>
                <span className="wrap-any min-h-[2.5rem] text-sm font-semibold leading-snug text-white">{t.name}</span>
                <span className="mt-2 flex items-baseline gap-2">
                  <span className="tabular text-lg font-bold tracking-tight text-white">
                    {multi ? <span className="mr-1 text-xs font-medium text-ink-300">desde</span> : null}
                    {money(minPrice)}
                  </span>
                  {promo && <span className="tabular text-xs text-ink-400 line-through">{money(p.price)}</span>}
                </span>
                <span className={cx('mt-0.5 text-xs font-semibold', stock <= 0 ? 'text-rose-300' : low ? 'text-amber-200' : 'text-ink-300')}>
                  {stock <= 0 ? 'Sin stock' : low ? 'Poco stock · ' : ''}{stock <= 0 ? '' : multi ? `${t.products.filter((x) => sellableStockOf(state.lots, x.id) > 0).length} con stock` : `${formatQty(stock, p.baseUnit)} en stock`}
                  {!multi && p.units && p.units.length > 1 && <span className="text-ink-300"> · {p.units.length} formas de venta</span>}
                  {!multi && !p.barcode && <span className="text-ink-300"> · sin código</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ticket */}
      <section id="ticket" aria-label="Ticket de la venta" className="ink-surface flex h-fit flex-col overflow-hidden rounded-3xl text-white shadow-2xl animate-rise lg:sticky lg:top-0">
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 className="wrap-any text-lg font-bold tracking-tight">{quoteId ? `Ticket · presupuesto #${state.quotes.find((q) => q.id === quoteId)?.number}` : 'Ticket'}</h2>
            <div className="text-xs font-medium text-ink-300">
              {session.register} · {me.name.split(' ')[0]}
            </div>
          </div>
          {lines.length > 0 && (
            <button onClick={clearTicket} className="min-h-11 rounded-full px-3 text-sm font-semibold text-ink-200 transition hover:bg-white/10 hover:text-white">
              Vaciar
            </button>
          )}
        </div>
        <div className="px-4 pb-2">
          <ClientPicker value={clientId} onChange={(c) => setClientId(c?.id)} placeholder="Cliente (opcional): historial y cuenta corriente" />
        </div>
        {!online && (
          <div role="status" className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-rose-500/15 px-3 py-2 text-xs font-medium text-rose-100 ring-1 ring-rose-400/30">
            <WifiOff size={14} className="mt-px shrink-0" aria-hidden /> Sin conexión: se puede vender y cobrar en efectivo. Todo queda guardado en el equipo.
          </div>
        )}
        <ul className="max-h-[42dvh] min-h-[150px] space-y-1 overflow-y-auto overscroll-contain px-3" aria-label="Productos del ticket">
          {lines.length === 0 ? (
            <li className="flex flex-col items-center px-2 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.06] text-ink-300" aria-hidden>
                <ScanLine size={22} />
              </div>
              <div className="text-sm font-semibold text-ink-100">Ticket vacío</div>
              <div className="mt-0.5 text-sm text-ink-300">Escaneá o tocá un producto para agregarlo</div>
            </li>
          ) : (
            lines.map((l) => {
              const key = `${l.productId}-${l.unitId ?? 'base'}`
              const decrease = () => setCart((c) => c.flatMap((x) => (x.productId === l.productId && x.unitId === l.unitId ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x])))
              return (
                <li key={key} className="rounded-xl px-2 py-2 transition hover:bg-white/[0.04]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="wrap-any text-sm font-semibold">{l.product.name}</div>
                      <div className="tabular text-xs text-ink-300">
                        {money(l.unit.price)} {l.unit.id === 'base' ? (l.product.baseUnit && l.product.baseUnit !== 'u' ? `por ${l.product.baseUnit}` : 'c/u') : `· ${l.unit.label}`}
                        {l.price !== undefined ? <span className="ml-1 text-brand-200">precio de presupuesto</span> : l.unit.id === 'base' && hasPromo(l.product) && <span className="ml-1 text-emerald-300">promo</span>}
                      </div>
                    </div>
                    <div className="tabular shrink-0 text-sm font-bold">{money(l.qty * l.unit.price)}</div>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <div className="flex items-center rounded-full bg-white/[0.07]" role="group" aria-label={`Cantidad de ${l.product.name}`}>
                      <button className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-100 transition hover:bg-white/10 lg:h-9 lg:w-9" onClick={decrease} aria-label={`Quitar una unidad de ${l.product.name}`}>
                        <Minus size={15} aria-hidden />
                      </button>
                      <span className="tabular w-9 text-center text-sm font-bold" aria-live="polite">
                        {l.qty}
                      </span>
                      <button className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-100 transition hover:bg-white/10 lg:h-9 lg:w-9" onClick={() => add(l.productId, l.unitId)} aria-label={`Agregar una unidad de ${l.product.name}`}>
                        <Plus size={15} aria-hidden />
                      </button>
                    </div>
                    <button
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-300 transition hover:bg-white/10 hover:text-rose-300 lg:h-9 lg:w-9"
                      onClick={() => setCart((c) => c.filter((x) => !(x.productId === l.productId && x.unitId === l.unitId)))}
                      aria-label={`Quitar ${l.product.name} del ticket`}
                    >
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
        <div className="mt-2 border-t border-white/10 px-5 pb-5 pt-4">
          {cap > 0 ? (
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <label htmlFor="descuento" className="flex items-center gap-1.5 font-medium text-ink-100">
                <Percent size={14} className="text-brand-200" aria-hidden /> Descuento % <span className="text-xs text-ink-300">(máx. {cap}%)</span>
              </label>
              <input
                id="descuento"
                type="number"
                inputMode="decimal"
                min={0}
                max={cap}
                value={discount || ''}
                placeholder="0"
                onChange={(e) => setDiscount(Math.max(0, Math.min(cap, Number(e.target.value) || 0)))}
                className="tabular min-h-11 w-20 rounded-xl border-0 bg-white/10 px-2 text-right text-base font-bold text-white outline-none ring-1 ring-white/25 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-200 sm:text-sm"
              />
            </div>
          ) : (
            <div className="mb-3 text-xs text-ink-300">Tu usuario no puede aplicar descuentos.</div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-ink-200">
              <span>Subtotal</span>
              <span className="tabular line-through">{money(subtotal)}</span>
            </div>
          )}
          <div className="flex items-end justify-between gap-3">
            <span className="pb-1.5 text-sm font-semibold text-ink-200">Total</span>
            <span key={total} className="tabular text-glow wrap-any text-right text-4xl font-bold tracking-tight text-white animate-pop">
              {money(total)}
            </span>
          </div>
          <Button variant="lime" size="lg" className="mt-4 h-14 w-full text-lg" disabled={!lines.length} onClick={() => setPayOpen(true)}>
            Cobrar
          </Button>
          {!lines.length && <p className="mt-2 text-center text-xs text-ink-300">Agregá al menos un producto para poder cobrar.</p>}
          {hardware && (
            <Button variant="secondary" className="mt-2 w-full" disabled={!lines.length} onClick={() => setQuoteOpen(true)}>
              <FileSignature size={16} aria-hidden /> Guardar como presupuesto
            </Button>
          )}
        </div>
      </section>

      {/* en el teléfono el ticket queda abajo: barra fija con total, acceso al detalle y cobro */}
      {lines.length > 0 && (
        <div className="glass-strong safe-bottom fixed inset-x-3 bottom-3 z-30 flex items-center gap-2 rounded-2xl px-3 pt-3 text-white lg:hidden">
          <button
            onClick={() => document.getElementById('ticket')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="min-h-11 flex-1 rounded-xl px-1 text-left"
            aria-label={`Ver el ticket: ${lines.reduce((a, l) => a + l.qty, 0)} productos, ${money(total)}`}
          >
            <span className="block text-xs font-medium text-ink-300">{lines.reduce((a, l) => a + l.qty, 0)} productos · ver ticket</span>
            <span className="tabular block text-xl font-bold text-white">{money(total)}</span>
          </button>
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

      {variantTile && <VariantModal tile={variantTile} onClose={() => setVariantTile(null)} onAdd={(id, unitId, qty) => add(id, unitId, qty)} />}

      <PaymentModal
        open={payOpen}
        total={total}
        accounts={biz.transferAccounts}
        online={online}
        client={client}
        onClose={() => setPayOpen(false)}
        onConfirm={(p) => {
          const res = state.completeSale({ cart, discountPct: discount, clientId, quoteId, ...p })
          if (res.error) return res.error
          setPayOpen(false)
          resetTicket()
          setDone(res.sale!)
          return null
        }}
      />

      {quoteOpen && (
        <QuoteModal
          cart={cart}
          client={client}
          discount={discount}
          total={total}
          onClose={() => setQuoteOpen(false)}
          onSaved={(q) => {
            setNotice(`Presupuesto #${q.number} guardado. Lo encontrás en Presupuestos.`)
            resetTicket()
          }}
        />
      )}

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
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
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

function VariantModal({ tile, onClose, onAdd }: { tile: Tile; onClose: () => void; onAdd: (productId: string, unitId: string | undefined, qty: number) => void }) {
  const lots = useStore((s) => s.lots)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [unit, setUnit] = useState<Record<string, string>>({})
  return (
    <Modal open onClose={onClose} title={tile.name} width="max-w-2xl">
      <p className="mb-3 text-sm text-ink-300">Elegí la medida o variante, la forma de venta y la cantidad. El stock se descuenta en la unidad base.</p>
      <div className="space-y-2">
        {tile.products.map((p) => {
          const stock = sellableStockOf(lots, p.id)
          const units = p.units && p.units.length ? p.units : [{ id: 'base', label: 'Unidad', factor: 1, price: p.price }]
          const u = unitOf(p, unit[p.id])
          const q = Number(qty[p.id] ?? 1) || 0
          return (
            <div key={p.id} className="rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-white">{p.variant ?? p.name}</div>
                  <div className={cx('text-xs', stock <= p.minStock ? 'text-amber-200' : 'text-ink-300')}>
                    Stock {formatQty(stock, p.baseUnit)}
                    {stock <= p.minStock && ' · bajo mínimo'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {units.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => setUnit({ ...unit, [p.id]: x.id })}
                      className={cx('rounded-full px-3 py-1.5 text-xs font-semibold transition', u.id === x.id ? 'bg-white text-ink-900' : 'bg-white/[0.06] text-ink-200 ring-1 ring-white/12 hover:bg-white/10')}
                    >
                      {x.label} · {money(x.id === 'base' ? priceOf(p) : x.price)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2.5 flex items-center justify-end gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  aria-label={`Cantidad de ${p.variant ?? p.name}`}
                  value={qty[p.id] ?? '1'}
                  onChange={(e) => setQty({ ...qty, [p.id]: e.target.value })}
                  className="tabular min-h-11 w-24 rounded-xl border-0 bg-white/[0.06] px-3 text-right text-base text-white outline-none ring-1 ring-white/20 focus:ring-2 focus:ring-brand-200 sm:text-sm"
                />
                <span className="tabular w-28 text-right text-sm font-semibold text-white">{money(q * u.price)}</span>
                <Button size="sm" disabled={q <= 0 || stock < q * u.factor} onClick={() => onAdd(p.id, u.id === 'base' ? undefined : u.id, q)}>
                  Agregar
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}

function QuoteModal({ cart, client, discount, total, onClose, onSaved }: { cart: CartLine[]; client?: Client; discount: number; total: number; onClose: () => void; onSaved: (q: Quote) => void }) {
  const createQuote = useStore((s) => s.createQuote)
  const sendMessage = useStore((s) => s.sendMessage)
  const [name, setName] = useState(client?.name ?? '')
  const [days, setDays] = useState('15')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState<Quote | null>(null)
  const [sent, setSent] = useState(false)
  return (
    <Modal open onClose={onClose} title={saved ? `Presupuesto #${saved.number}` : 'Guardar presupuesto'}>
      {!saved ? (
        <div className="space-y-3">
          <Input label="Cliente" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre o empresa" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Validez (días)" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-ink-300">Total</span>
              <div className="tabular rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm font-bold text-white ring-1 ring-white/12">{money(total)}</div>
            </div>
          </div>
          <Input label="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: obra, entrega, condiciones" />
          <p className="text-xs text-ink-400">Los precios quedan congelados durante la validez. Se convierte en venta con un clic desde Presupuestos.</p>
          <div className="flex justify-end">
            <Button
              disabled={!name.trim()}
              onClick={() => {
                const q = createQuote({ cart, clientId: client?.id, clientName: name.trim(), discountPct: discount, note: note.trim() || undefined, validDays: Number(days) || 15 })
                setSaved(q)
                onSaved(q)
              }}
            >
              Guardar presupuesto
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
            Guardado por {money(saved.total)}, válido hasta el {saved.validUntil.split('-').reverse().join('/')}.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button
              variant="secondary"
              disabled={sent}
              onClick={() => {
                sendMessage({ businessId: saved.businessId, channel: 'WhatsApp', to: client ? `${client.name} · ${client.phone}` : saved.clientName, subject: `Presupuesto #${saved.number}`, body: `Hola, te enviamos el presupuesto #${saved.number} por ${money(saved.total)}, válido hasta el ${saved.validUntil.split('-').reverse().join('/')}.` })
                setSent(true)
              }}
            >
              {sent ? 'Enviado' : 'Enviar por WhatsApp'}
            </Button>
            <Simulated />
          </div>
        </div>
      )}
    </Modal>
  )
}

function UnknownCodeModal({ code, onClose, onAssigned }: { code: string | null; onClose: () => void; onAssigned: (productId: string) => void }) {
  const me = useMe()!
  const state = useStore()
  const [productId, setProductId] = useState('')
  const [error, setError] = useState('')
  const candidates = state.products.filter((p) => p.businessId === state.businessId && !p.barcode)
  const allowed = can(me, 'codigo.asignar')
  return (
    <Modal open={!!code} onClose={onClose} title="Código no registrado">
      <p className="text-sm text-ink-200">
        El código <span className="font-mono font-semibold">{code}</span> todavía no está cargado en el catálogo.
      </p>
      {allowed ? (
        <>
          <p className="mt-2 text-sm text-ink-200">Asignalo al producto correspondiente: la próxima vez se reconoce solo.</p>
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
          {error && <div className="mt-2 text-sm text-rose-300">{error}</div>}
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
        <p className="mt-2 rounded-xl bg-amber-400/12 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-300/25">Pedile a un Encargado que lo asigne. Mientras tanto, buscá el producto por nombre.</p>
      )}
    </Modal>
  )
}

function PaymentModal({
  open,
  total,
  accounts,
  online,
  client,
  onClose,
  onConfirm,
}: {
  open: boolean
  total: number
  accounts: string[]
  online: boolean
  client?: Client
  onClose: () => void
  onConfirm: (p: { payments: Payment[]; cashReceived?: number; receiptKind: ReceiptKind; customer?: Customer }) => string | null
}) {
  const accountsData = useStore((s) => s.accounts)
  const [method, setMethod] = useState<Method>('efectivo')
  const [received, setReceived] = useState('')
  const [cashPart, setCashPart] = useState('')
  const [account, setAccount] = useState(accounts[0])
  const [kind, setKind] = useState<ReceiptKind>('B')
  const [cuit, setCuit] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [cuitError, setCuitError] = useState('')
  const [error, setError] = useState('')
  const [terminal, setTerminal] = useState<'idle' | 'waiting' | 'rejected'>('idle')

  useEffect(() => {
    if (open) {
      setMethod('efectivo')
      setReceived('')
      setCashPart('')
      setError('')
      setCuitError('')
      setTerminal('idle')
      // un cliente con CUIT factura A con sus datos ya completos
      if (client?.cuit) {
        setKind('A')
        setCuit(client.cuit)
        setCustomer({ cuit: client.cuit, name: client.name, ivaCondition: client.ivaCondition, address: client.address })
      } else {
        setKind('B')
        setCuit('')
        setCustomer(null)
      }
    }
  }, [open, client])

  const cashAmount = method === 'efectivo' ? total : method === 'mixto' ? Math.min(total, Number(cashPart) || 0) : 0
  const transferAmount = method === 'transferencia' ? total : method === 'mixto' ? Math.round((total - cashAmount) * 100) / 100 : 0
  const receivedNum = received === '' ? cashAmount : Number(received)
  const change = cashAmount > 0 ? receivedNum - cashAmount : 0
  const ccAvailable = client && client.creditLimit > 0 ? client.creditLimit - clientBalance(accountsData, client.id) : 0

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

  const payments = (): Payment[] => {
    if (method === 'tarjeta' || method === 'qr') return [{ method, amount: total, cardBrand: method === 'tarjeta' ? 'Visa débito' : undefined }]
    if (method === 'cuenta_corriente') return [{ method, amount: total }]
    const list: Payment[] = []
    if (cashAmount > 0) list.push({ method: 'efectivo', amount: cashAmount })
    if (transferAmount > 0) list.push({ method: 'transferencia', amount: transferAmount, account })
    return list
  }

  const guard = useGuard()
  const finish = () =>
    guard(() => {
    const err = onConfirm({ payments: payments(), cashReceived: cashAmount > 0 ? receivedNum : undefined, receiptKind: kind, customer: kind === 'A' ? customer ?? undefined : undefined })
    if (err) {
      setError(err)
      setTerminal('idle')
    }
    })

  const confirm = () => {
    setError('')
    // A2: el cobro digital espera la confirmación de la terminal
    if (method === 'tarjeta' || method === 'qr') setTerminal('waiting')
    else finish()
  }

  const invalidReason =
    cashAmount > 0 && receivedNum < cashAmount
      ? `Falta ${money(cashAmount - receivedNum)}: el efectivo recibido no alcanza.`
      : kind === 'A' && !customer
        ? 'Para la factura A consultá el CUIT del cliente.'
        : method === 'mixto' && (cashAmount <= 0 || cashAmount >= total)
          ? 'En el pago mixto, la parte en efectivo tiene que ser mayor a cero y menor al total.'
          : method === 'cuenta_corriente' && total > ccAvailable
            ? 'El total supera el crédito disponible del cliente.'
            : ''
  const invalid =
    (cashAmount > 0 && receivedNum < cashAmount) ||
    (kind === 'A' && !customer) ||
    (method === 'mixto' && (cashAmount <= 0 || cashAmount >= total)) ||
    (method === 'cuenta_corriente' && total > ccAvailable)

  const methods: [Method, string, typeof Banknote, boolean][] = [
    ['efectivo', 'Efectivo', Banknote, true],
    ['transferencia', 'Transferencia', Landmark, true],
    ['tarjeta', 'Tarjeta', CreditCard, online],
    ['qr', 'QR', QrCode, online],
    ['mixto', 'Mixto', Split, true],
    ['cuenta_corriente', 'Cuenta cte.', BookUser, !!client && client.creditLimit > 0],
  ]

  return (
    <Modal open={open} onClose={onClose} title={`Cobrar ${money(total)}`} width="max-w-xl">
      {terminal !== 'idle' ? (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            {method === 'qr' ? <QrCode size={30} /> : <CreditCard size={30} />}
          </div>
          <div className="mt-4 text-lg font-bold text-white">{terminal === 'waiting' ? (method === 'qr' ? 'Esperando el pago con QR…' : 'Pasá la tarjeta por la terminal Point…') : 'Pago rechazado'}</div>
          <div className="tabular mt-1 text-3xl font-bold text-white">{money(total)}</div>
          <div className="mt-2 flex justify-center">
            <Simulated>Terminal Mercado Pago simulada</Simulated>
          </div>
          {terminal === 'waiting' ? (
            <>
              <p className="mx-auto mt-3 max-w-sm text-sm text-ink-300">En el sistema real la venta se cierra sola cuando Mercado Pago confirma el pago. Los datos de la tarjeta nunca pasan por el sistema.</p>
              <div className="mt-5 flex justify-center gap-2">
                <Button variant="success" onClick={finish}>
                  <CheckCircle2 size={16} /> Simular pago aprobado
                </Button>
                <Button variant="danger" onClick={() => setTerminal('rejected')}>
                  <XCircle size={16} /> Simular rechazo
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mx-auto mt-3 max-w-sm text-sm text-rose-200">La tarjeta fue rechazada (fondos insuficientes). La venta sigue abierta: elegí otro medio de pago.</p>
              <div className="mt-5 flex justify-center">
                <Button variant="secondary" onClick={() => setTerminal('idle')}>
                  Elegir otro medio
                </Button>
              </div>
            </>
          )}
          {error && <div className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {methods.map(([m, label, Icon, enabled]) => (
              <button
                key={m}
                onClick={() => enabled && setMethod(m)}
                disabled={!enabled}
                title={!enabled ? (m === 'cuenta_corriente' ? 'Elegí un cliente con cuenta corriente' : 'Requiere conexión (M4-R2)') : ''}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-2xl py-3 text-sm font-medium ring-1 transition disabled:cursor-not-allowed disabled:opacity-35',
                  method === m ? 'bg-white/[0.14] text-white ring-white/40' : 'bg-white/[0.04] text-ink-200 ring-white/10 hover:bg-white/[0.08]',
                )}
              >
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>

          {method === 'mixto' && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Input label="Parte en efectivo" type="number" min={0} value={cashPart} onChange={(e) => setCashPart(e.target.value)} autoFocus />
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-ink-300">Parte por transferencia</span>
                <div className="tabular rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold ring-1 ring-white/12">{money(transferAmount)}</div>
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
              <div className={cx('mt-3 flex items-center justify-between rounded-2xl px-4 py-3 ring-1', change < 0 ? 'bg-rose-400/12 text-rose-200 ring-rose-300/25' : 'bg-emerald-400/12 text-emerald-200 ring-emerald-300/25')}>
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
              {!online && <p className="mt-1 text-xs text-amber-200">Sin conexión: la transferencia se registra y se verifica al volver internet.</p>}
            </div>
          )}

          {(method === 'tarjeta' || method === 'qr') && (
            <div className="mt-4 rounded-2xl bg-white/[0.04] p-3 text-sm text-ink-200 ring-1 ring-white/10">
              Se cobra {money(total)} {method === 'qr' ? 'con el QR de Mercado Pago' : 'en la terminal Point de Mercado Pago'}. Al confirmar, la caja espera la aprobación del pago (add-on A2).
            </div>
          )}

          {method === 'cuenta_corriente' && client && (
            <div className={cx('mt-4 rounded-2xl p-3 text-sm ring-1', total > ccAvailable ? 'bg-rose-400/12 text-rose-200 ring-rose-300/25' : 'bg-white/[0.04] text-ink-200 ring-white/10')}>
              Se carga a la cuenta de <b className="text-white">{client.name}</b>. Disponible: {money(ccAvailable)} de {money(client.creditLimit)}.
              {total > ccAvailable && ' El total supera el disponible.'}
            </div>
          )}

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-2 text-xs font-semibold text-ink-300">Comprobante</div>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['B', 'Factura B', 'Consumidor final'],
                  ['A', 'Factura A', 'Con CUIT'],
                  ['ticket', 'Interno', 'Sin factura'],
                ] as const
              ).map(([k, label, hint]) => (
                <button key={k} onClick={() => setKind(k)} className={cx('rounded-2xl px-3 py-2 text-left ring-1 transition', kind === k ? 'bg-white/[0.14] ring-white/40' : 'bg-white/[0.04] ring-white/10 hover:bg-white/[0.08]')}>
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-ink-300">{hint}</div>
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
                <div className="mt-1.5 flex flex-wrap gap-1 text-xs text-ink-400">
                  CUITs de prueba:
                  {demoCuits.map((c) => (
                    <button key={c} className="font-mono text-brand-200 hover:underline" onClick={() => setCuit(c)}>
                      {formatCuit(c)}
                    </button>
                  ))}
                </div>
                {cuitError && <div className="mt-2 text-xs text-rose-300">{cuitError}</div>}
                {customer && (
                  <div className="mt-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm ring-1 ring-white/10">
                    <div className="font-medium text-white">{customer.name}</div>
                    <div className="text-xs text-ink-300">
                      {customer.ivaCondition}
                      {customer.address && ` · ${customer.address}`}
                    </div>
                  </div>
                )}
              </div>
            )}
            {kind !== 'ticket' && !online && <p className="mt-2 text-xs text-amber-200">Sin conexión: la venta se completa y la factura queda en contingencia hasta que vuelva internet.</p>}
          </div>

          {error && <div className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">{error}</div>}
          <Button size="lg" variant="success" className="mt-5 w-full" disabled={invalid} onClick={confirm}>
            {method === 'tarjeta' || method === 'qr' ? 'Cobrar con Mercado Pago' : 'Confirmar venta'}
          </Button>
          {invalidReason && <p className="mt-2 text-center text-sm text-amber-200">{invalidReason}</p>}
        </>
      )}
    </Modal>
  )
}
