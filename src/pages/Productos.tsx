import { useMemo, useRef, useState } from 'react'
import { Download, FileUp, PackageSearch, Percent, Plus, Search } from 'lucide-react'
import { formatQty, hasPromo, priceOf, stockOf, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, dateTime, daysUntil, money } from '../lib/format'
import type { Product } from '../types'
import { Badge, Button, Card, Empty, Input, Modal, PageHeader, Rule, ScrollArea, Select, cx, useGuard } from '../components/ui'
import { categoryStyle } from '../lib/categories'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'

/** unidades vendidas en los últimos 7 días por producto */
function useSold7d() {
  const sales = useStore((s) => s.sales)
  return useMemo(() => {
    const from = Date.now() - 7 * 86400000
    const map = new Map<string, number>()
    for (const s of sales) {
      if (s.status !== 'completada' || new Date(s.at).getTime() < from) continue
      for (const i of s.items) if (i.productId) map.set(i.productId, (map.get(i.productId) ?? 0) + i.qty * (i.factor ?? 1))
    }
    return map
  }, [sales])
}

export default function Productos() {
  const me = useMe()!
  const state = useStore()
  const sold = useSold7d()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [detail, setDetail] = useState<string | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const canEdit = can(me, 'precios.editar')
  const showCost = can(me, 'costos.ver')

  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const term = q.trim().toLowerCase()
  const rows = products.filter((p) => (!cat || p.category === cat) && (!term || p.name.toLowerCase().includes(term) || p.barcode?.includes(term)))

  const columns: Col<Product>[] = [
    {
      key: 'producto',
      header: 'Producto',
      mobile: 'title',
      className: 'min-w-[16rem]',
      cell: (p) => (
        <div className="flex items-center gap-3">
          <CategoryIcon category={p.category} />
          <div className="min-w-0">
            <div className="wrap-any font-semibold text-white">{p.name}</div>
            <div className="text-xs font-normal text-ink-300">
              {p.category}
              {p.tracksLots && ' · por lote'}
              {p.units && p.units.length > 1 && ` · se vende por ${p.units.map((u) => u.label.toLowerCase()).join(' o ')}`}
            </div>
            {hasPromo(p) && (
              <Badge tone="green" className="mt-1">
                Promo {money(priceOf(p))} hasta {p.promoUntil!.split('-').reverse().slice(0, 2).join('/')}
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'precio',
      header: 'Precio',
      align: 'right',
      mobile: 'value',
      cell: (p) => (canEdit ? <PriceCell product={p} /> : <span className="tabular whitespace-nowrap font-bold">{money(p.price)}</span>),
    },
    { key: 'codigo', header: 'Código de barras', className: 'font-mono text-xs text-ink-200', cell: (p) => p.barcode ?? <Badge tone="amber">Sin código</Badge> },
    ...(showCost
      ? ([
          { key: 'costo', header: 'Costo', align: 'right', className: 'tabular text-ink-200', cell: (p) => money(p.cost) },
          { key: 'margen', header: 'Margen', align: 'right', className: 'tabular text-ink-200', cell: (p) => `${p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%` },
        ] as Col<Product>[])
      : []),
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      cell: (p) => {
        const stock = stockOf(state.lots, p.id)
        return (
          <span className="tabular whitespace-nowrap font-semibold">
            {formatQty(stock, p.baseUnit)}
            {stock <= p.minStock && <span className="block text-xs font-medium text-amber-200">bajo el mínimo ({p.minStock})</span>}
          </span>
        )
      },
    },
    { key: 'vendido', header: 'Vendido en 7 días', align: 'right', className: 'tabular text-ink-200', cell: (p) => formatQty(Math.round((sold.get(p.id) ?? 0) * 100) / 100, p.baseUnit) },
    {
      key: 'alcanza',
      header: 'Stock alcanza para',
      align: 'right',
      className: 'tabular whitespace-nowrap',
      cell: (p) => {
        const s7 = sold.get(p.id) ?? 0
        const cover = s7 ? Math.round(stockOf(state.lots, p.id) / (s7 / 7)) : null
        return cover === null ? <span className="text-ink-300">sin ventas</span> : <span className={cover < 4 ? 'font-semibold text-rose-300' : 'text-ink-200'}>{cover} días</span>
      },
    },
  ]

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Productos y precios"
        tag="M2"
        subtitle={`${products.length} productos · ${canEdit ? 'tocá un precio para editarlo; tocá el nombre para ver lotes, stock y proveedores' : 'lista de precios en modo lectura para tu usuario'}`}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <FileUp size={16} aria-hidden /> Importar planilla
              </Button>
              <Button variant="secondary" onClick={() => setBulkOpen(true)}>
                <Percent size={16} aria-hidden /> Cambio masivo
              </Button>
              <Button onClick={() => setNewOpen(true)}>
                <Plus size={16} aria-hidden /> Nuevo producto
              </Button>
            </>
          )
        }
      />
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_14rem]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
          <Input className="pl-10" type="search" aria-label="Buscar productos" placeholder="Buscar por nombre o código de barras" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Filtrar por categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <p className="mb-2 text-sm text-ink-300" aria-live="polite">
        {rows.length === products.length ? `${rows.length} productos` : `${rows.length} de ${products.length} productos`}
      </p>
      <Card>
        {rows.length === 0 ? (
          <Empty
            icon={<PackageSearch size={22} />}
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQ('')
                  setCat('')
                }}
              >
                Quitar filtros
              </Button>
            }
          >
            No encontramos productos para {term ? `“${q.trim()}”` : 'esa categoría'}. Revisá la ortografía o probá con el código de barras.
          </Empty>
        ) : (
          <DataTable
            caption="Lista de productos y precios"
            columns={columns}
            rows={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => setDetail(p.id)}
            rowLabel={(p) => `${p.name}. Abrir detalle de stock y lotes`}
          />
        )}
      </Card>

      {detail && <ProductModal productId={detail} onClose={() => setDetail(null)} />}
      <BulkModal open={bulkOpen} onClose={() => setBulkOpen(false)} categories={categories} />
      <NewProductModal open={newOpen} onClose={() => setNewOpen(false)} categories={categories} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

/** precio editable en línea: borde visible, nombre accesible y respuesta al guardar */
function PriceCell({ product }: { product: Product }) {
  const updatePrice = useStore((s) => s.updatePrice)
  const notify = useStore((s) => s.notify)
  const [value, setValue] = useState<string | null>(null)
  const save = () => {
    if (value === null) return
    const n = Number(value)
    if (!(n > 0)) notify('El precio tiene que ser mayor a cero. Se mantuvo el anterior.', 'error')
    else if (n !== product.price) updatePrice(product.id, n)
    setValue(null)
  }
  return (
    <label className="inline-flex items-center gap-1 text-ink-300" onClick={(e) => e.stopPropagation()}>
      <span aria-hidden>$</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        aria-label={`Precio de ${product.name}`}
        value={value ?? product.price}
        onFocus={(e) => {
          setValue(String(product.price))
          e.target.select()
        }}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setValue(null)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="tabular min-h-11 w-28 rounded-lg border-0 bg-white/[0.06] px-2.5 text-right text-base font-bold text-white outline-none ring-1 ring-white/20 focus:bg-white/[0.1] focus:ring-2 focus:ring-brand-200 sm:min-h-9 sm:text-sm"
      />
    </label>
  )
}

const REASONS = ['Conteo', 'Rotura', 'Pérdida', 'Vencido', 'Ingreso de mercadería']

function ProductModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const me = useMe()!
  const state = useStore()
  const guard = useGuard()
  const p = state.products.find((x) => x.id === productId)!
  const lots = state.lots.filter((l) => l.productId === productId).sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))
  const history = state.priceHistory.filter((h) => h.productId === productId)
  const moves = state.movements.filter((m) => m.productId === productId).slice(0, 12)
  const offers = state.supplierPrices.filter((o) => o.productId === productId).sort((a, b) => a.cost - b.cost)
  const [lotId, setLotId] = useState(lots[0]?.id ?? 'nuevo')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [expiry, setExpiry] = useState('')
  const [error, setError] = useState('')
  const user = (id: string) => state.users.find((u) => u.id === id)?.name.split(' ')[0] ?? id
  const hint = !Number(delta) ? 'Escribí la cantidad: positiva suma, negativa resta.' : !reason ? 'Elegí el motivo del ajuste.' : ''

  return (
    <Modal open onClose={onClose} title={p.name} width="max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge>{p.category}</Badge>
        <Badge tone="brand">Precio {money(p.price)}</Badge>
        {can(me, 'costos.ver') && <Badge>Costo {money(p.cost)}</Badge>}
        <Badge>Stock mínimo {p.minStock}</Badge>
        <span className="font-mono text-xs text-ink-300">{p.barcode ?? 'sin código de barras'}</span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-white">Stock por lote</h3>
      <ScrollArea label="Stock por lote" className="mb-4 rounded-xl ring-1 ring-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wider text-ink-300">
            <tr>
              <th className="px-3 py-2 font-bold">Lote</th>
              <th className="px-3 py-2 font-bold">Vencimiento</th>
              <th className="px-3 py-2 text-right font-bold">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l, i) => {
              const d = l.expiry ? daysUntil(l.expiry) : null
              return (
                <tr key={l.id} className="border-t border-white/10">
                  <td className="px-3 py-2 font-mono text-xs">
                    {l.code}
                    {i === 0 && d !== null && d >= 0 && l.qty > 0 && <span className="block font-sans text-xs text-brand-100">se vende primero</span>}
                  </td>
                  <td className="px-3 py-2">
                    {l.expiry ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {date(l.expiry)}
                        {d! < 0 ? <Badge tone="red">Vencido</Badge> : d! <= state.expiryWarnDays ? <Badge tone="amber">Vence en {d} d</Badge> : null}
                      </span>
                    ) : (
                      <span className="text-ink-300">No vence</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right font-bold">{formatQty(l.qty, p.baseUnit)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ScrollArea>

      {can(me, 'stock.ajustar') ? (
        <form
          className="mb-4 rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10 sm:p-4"
          onSubmit={(e) => {
            e.preventDefault()
            guard(() => {
              const err = state.adjustStock({ productId, lotId, delta: Number(delta), reason, expiry: lotId === 'nuevo' ? expiry || null : undefined })
              setError(err ?? '')
              if (!err) {
                setDelta('')
                setReason('')
              }
            })
          }}
        >
          <h3 className="mb-3 text-sm font-semibold text-white">Ajuste de stock</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Lote" value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} · {l.qty} en stock
                </option>
              ))}
              <option value="nuevo">Lote nuevo…</option>
            </Select>
            <Input label={`Cantidad (${p.baseUnit ?? 'u'})`} type="number" inputMode="decimal" placeholder="Ej.: 24 o −3" value={delta} onChange={(e) => setDelta(e.target.value)} />
            <Select label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Elegir…</option>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            {lotId === 'nuevo' && <Input label="Vencimiento del lote nuevo" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />}
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-ink-300">{hint}</p>
            <Button type="submit" disabled={!!hint}>
              Registrar ajuste
            </Button>
          </div>
          <div className="mt-3">
            <Rule id="M2-R5">El stock nunca se edita directamente: cambia solo por ventas, compras o ajustes con motivo.</Rule>
          </div>
        </form>
      ) : null}

      {p.units && p.units.length > 1 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-white">Formas de venta</h3>
          <div className="flex flex-wrap gap-2">
            {p.units.map((u) => (
              <Badge key={u.id} tone="brand">
                {u.label}
                {u.factor !== 1 && ` (${formatQty(u.factor, p.baseUnit)})`} · {money(u.price)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {offers.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1 text-sm font-semibold text-white">Proveedores y último costo</h3>
          <div className="overflow-hidden rounded-xl ring-1 ring-white/10">
            {offers.map((o, i) => (
              <div key={o.supplierId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/10 px-3 py-2.5 text-sm first:border-0">
                <span className="text-white">
                  {state.suppliers.find((x) => x.id === o.supplierId)?.name}
                  {i === 0 && offers.length > 1 && (
                    <Badge tone="green" className="ml-2">
                      Más barato
                    </Badge>
                  )}
                </span>
                <span className="tabular text-ink-200">
                  {can(me, 'costos.ver') ? money(o.cost) : 'costo reservado al Administrador'} <span className="text-xs text-ink-300">· {date(o.at)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-white">Historial de precios</h3>
          {history.length === 0 ? (
            <p className="text-sm text-ink-300">Sin cambios de precio registrados.</p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex flex-wrap justify-between gap-x-3 border-b border-white/10 py-1.5 text-xs">
                <span className="text-ink-300">
                  {dateTime(h.at)} · {user(h.userId)}
                  {h.note && ` · ${h.note}`}
                </span>
                <span className="tabular text-ink-100">
                  {money(h.oldPrice)} → <b>{money(h.newPrice)}</b>
                </span>
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-white">Últimos movimientos de stock</h3>
          {moves.length === 0 ? (
            <p className="text-sm text-ink-300">Todavía no hay movimientos nuevos de este producto.</p>
          ) : (
            moves.map((m) => (
              <div key={m.id} className="flex justify-between gap-3 border-b border-white/10 py-1.5 text-xs">
                <span className="text-ink-300">
                  {dateTime(m.at)} · {m.type}
                  {m.reason && ` · ${m.reason}`}
                </span>
                <span className={cx('tabular shrink-0 font-semibold', m.delta < 0 ? 'text-rose-300' : 'text-emerald-300')}>
                  {m.delta > 0 ? '+' : ''}
                  {m.delta}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

function BulkModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const state = useStore()
  const confirm = useConfirm()
  const guard = useGuard()
  const [cat, setCat] = useState('')
  const [pct, setPct] = useState('10')
  const n = Number(pct)
  const count = state.products.filter((p) => p.businessId === state.businessId && (!cat || p.category === cat)).length
  const error = !pct ? 'Ingresá un porcentaje.' : !n ? 'El porcentaje no puede ser cero.' : n < -90 || n > 200 ? 'Usá un valor entre −90% y 200%.' : ''
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambio masivo de precios"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!!error}
            onClick={() =>
              guard(async () => {
                const ok = await confirm({
                  title: 'Confirmar cambio de precios',
                  message: (
                    <>
                      Vas a {n > 0 ? 'aumentar' : 'bajar'} un <b>{Math.abs(n)}%</b> el precio de <b>{count} productos</b> ({cat || 'todas las categorías'}). Queda registrado con el precio anterior y se aplica de inmediato en caja.
                    </>
                  ),
                  confirmLabel: 'Aplicar cambio',
                  danger: !cat,
                })
                if (ok) {
                  state.bulkPrice(cat || null, n)
                  onClose()
                }
              })
            }
          >
            Revisar y aplicar
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input label="Porcentaje (+ aumento, − rebaja)" type="number" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} error={error} />
      </div>
      <p className="mt-3 text-sm text-ink-200">
        Se modificarán <b className="text-white">{count} productos</b>. Los precios se redondean a $10 y las unidades alternativas (cajas, rollos) acompañan el cambio.
      </p>
      <p className="mt-1 text-xs text-ink-300">El cambio rige desde que se guarda y conserva el historial del precio anterior (M2-R4).</p>
    </Modal>
  )
}

function NewProductModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const addProduct = useStore((s) => s.addProduct)
  const products = useStore((s) => s.products)
  const businessId = useStore((s) => s.businessId)
  const guard = useGuard()
  const empty = { name: '', category: categories[0] ?? '', barcode: '', cost: '', price: '', minStock: '5', qty: '', expiry: '' }
  const [f, setF] = useState(empty)
  const [touched, setTouched] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const errors = {
    name: !f.name.trim() ? 'Escribí el nombre del producto.' : '',
    price: !(Number(f.price) > 0) ? 'Ingresá un precio mayor a cero.' : '',
    barcode: f.barcode && products.some((p) => p.businessId === businessId && p.barcode === f.barcode.trim()) ? 'Ese código ya pertenece a otro producto.' : '',
    cost: f.cost && Number(f.cost) < 0 ? 'El costo no puede ser negativo.' : '',
  }
  const valid = !errors.name && !errors.price && !errors.barcode && !errors.cost
  const submit = () =>
    guard(() => {
      setTouched(true)
      if (!valid) return
      addProduct(
        { name: f.name.trim(), category: f.category || 'Sin categoría', barcode: f.barcode.trim() || null, cost: Number(f.cost) || 0, price: Number(f.price), minStock: Number(f.minStock) || 0, tracksLots: !!f.expiry, baseUnit: 'u' },
        Number(f.qty) || 0,
        f.expiry || null,
      )
      setF(empty)
      setTouched(false)
      onClose()
    })
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo producto"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit}>Guardar producto</Button>
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
          <Input label="Nombre *" value={f.name} onChange={set('name')} error={touched ? errors.name : ''} />
        </div>
        <Input label="Categoría" list="cats" value={f.category} onChange={set('category')} />
        <datalist id="cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input label="Código de barras" value={f.barcode} onChange={set('barcode')} hint="Opcional: se puede asignar al escanear en la caja." error={touched || f.barcode ? errors.barcode : ''} />
        <Input label="Costo" type="number" inputMode="decimal" value={f.cost} onChange={set('cost')} error={touched ? errors.cost : ''} />
        <Input label="Precio de venta *" type="number" inputMode="decimal" value={f.price} onChange={set('price')} error={touched ? errors.price : ''} />
        <Input label="Stock mínimo" type="number" inputMode="numeric" value={f.minStock} onChange={set('minStock')} />
        <Input label="Stock de apertura" type="number" inputMode="numeric" value={f.qty} onChange={set('qty')} />
        <div className="sm:col-span-2">
          <Input label="Vencimiento" type="date" value={f.expiry} onChange={set('expiry')} hint="Completalo solo si el producto se controla por lote." />
        </div>
        {/* permite enviar con Enter */}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  )
}

const TEMPLATE = 'nombre;categoria;codigo;costo;precio;stock_minimo;stock\nFernet 750 ml;Bebidas;7790000000017;7800;12500;6;18\nPastillas de menta;Golosinas;;350;700;20;60\n'

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importProducts = useStore((s) => s.importProducts)
  const guard = useGuard()
  const file = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Parameters<typeof importProducts>[0]>([])
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')

  const parse = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) {
      setError('El archivo está vacío o no tiene filas debajo de los títulos. Descargá la plantilla para ver el formato.')
      setPreview([])
      return
    }
    const sep = lines[0].includes(';') ? ';' : ','
    const parsed = lines.slice(1).map((l) => {
      const [name, category, barcode, cost, price, minStock, qty] = l.split(sep).map((x) => x.trim())
      return { name, category, barcode: barcode || null, cost: Number(cost) || 0, price: Number(price) || 0, minStock: Number(minStock) || 0, qty: Number(qty) || 0 }
    })
    const ok = parsed.filter((r) => r.name && r.price > 0)
    setSkipped(parsed.length - ok.length)
    setPreview(ok)
    setError(ok.length ? '' : 'Ninguna fila tiene nombre y precio válidos. Revisá que el separador sea “;” o “,”.')
  }
  const close = () => {
    setPreview([])
    setSkipped(0)
    setError('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Importar catálogo desde planilla"
      width="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            disabled={!preview.length}
            onClick={() =>
              guard(() => {
                importProducts(preview)
                close()
              })
            }
          >
            {preview.length ? `Importar ${preview.length} productos` : 'Importar'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-200">Carga inicial del catálogo (unos 500 artículos en el kiosco). Exportá la planilla como CSV con estas columnas:</p>
      <code className="wrap-any mt-2 block rounded-lg bg-white/[0.06] px-3 py-2 text-xs">nombre; categoria; codigo; costo; precio; stock_minimo; stock</code>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => file.current?.click()}>
          <FileUp size={16} aria-hidden /> Elegir archivo CSV
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob(['﻿' + TEMPLATE], { type: 'text/csv' }))
            a.download = 'plantilla-catalogo.csv'
            a.click()
          }}
        >
          <Download size={16} aria-hidden /> Descargar plantilla
        </Button>
        <Button variant="ghost" onClick={() => parse(TEMPLATE)}>
          Probar con un ejemplo
        </Button>
        <input
          ref={file}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          aria-label="Archivo CSV del catálogo"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) parse(await f.text())
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-400/12 px-3 py-2 text-sm text-rose-200 ring-1 ring-rose-300/25">
          {error}
        </p>
      )}
      {preview.length > 0 && (
        <>
          <p className="mt-3 text-sm text-ink-200">
            Vista previa: {preview.length} productos listos{skipped > 0 && <span className="text-amber-200"> · {skipped} fila{skipped > 1 ? 's' : ''} omitida{skipped > 1 ? 's' : ''} por falta de nombre o precio</span>}.
          </p>
          <ScrollArea label="Vista previa de la importación" className="mt-2 max-h-60 overflow-y-auto rounded-xl ring-1 ring-white/10">
            <table className="w-full min-w-[30rem] text-xs">
              <thead className="bg-white/[0.03] text-left text-ink-300">
                <tr>
                  <th className="px-3 py-2 font-semibold">Producto</th>
                  <th className="px-3 py-2 font-semibold">Categoría</th>
                  <th className="px-3 py-2 font-semibold">Código</th>
                  <th className="px-3 py-2 text-right font-semibold">Precio</th>
                  <th className="px-3 py-2 text-right font-semibold">Stock</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-t border-white/10">
                    <td className="px-3 py-1.5">{r.name}</td>
                    <td className="px-3 py-1.5 text-ink-300">{r.category}</td>
                    <td className="px-3 py-1.5 font-mono text-ink-300">{r.barcode ?? '—'}</td>
                    <td className="tabular px-3 py-1.5 text-right">{money(r.price)}</td>
                    <td className="tabular px-3 py-1.5 text-right">{r.qty} u.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </>
      )}
    </Modal>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const { icon: Icon, tone } = categoryStyle(category)
  return (
    <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)} aria-hidden>
      <Icon size={17} />
    </span>
  )
}
