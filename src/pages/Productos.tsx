import { useMemo, useRef, useState } from 'react'
import { Download, FileUp, Percent, Plus, Search } from 'lucide-react'
import { stockOf, useMe, useStore } from '../store'
import { can } from '../lib/permissions'
import { date, dateTime, daysUntil, money } from '../lib/format'
import type { Product } from '../types'
import { Badge, Button, Card, Input, Modal, PageHeader, Rule, Select, cx } from '../components/ui'

/** unidades vendidas en los últimos 7 días por producto */
function useSold7d() {
  const sales = useStore((s) => s.sales)
  return useMemo(() => {
    const from = Date.now() - 7 * 86400000
    const map = new Map<string, number>()
    for (const s of sales) {
      if (s.status !== 'completada' || new Date(s.at).getTime() < from) continue
      for (const i of s.items) map.set(i.productId, (map.get(i.productId) ?? 0) + i.qty)
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
  const canEdit = can(me.role, 'precios.editar')
  const showCost = can(me.role, 'costos.ver')

  const products = useMemo(() => state.products.filter((p) => p.businessId === state.businessId), [state.products, state.businessId])
  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products])
  const rows = products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.barcode?.includes(q)))

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Productos y precios"
        tag="M2"
        subtitle={`${products.length} productos · lista de precios editable en línea${canEdit ? '' : ' (solo lectura para tu rol)'}`}
        actions={
          canEdit && (
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <FileUp size={16} /> Importar planilla
              </Button>
              <Button variant="secondary" onClick={() => setBulkOpen(true)}>
                <Percent size={16} /> Cambio masivo
              </Button>
              <Button onClick={() => setNewOpen(true)}>
                <Plus size={16} /> Nuevo producto
              </Button>
            </>
          )
        }
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="Buscar por nombre o código" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-48" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Producto</th>
              <th className="px-4 py-2 font-medium">Código</th>
              {showCost && <th className="px-4 py-2 text-right font-medium">Costo</th>}
              <th className="px-4 py-2 text-right font-medium">Precio</th>
              {showCost && <th className="px-4 py-2 text-right font-medium">Margen</th>}
              <th className="px-4 py-2 text-right font-medium">Stock</th>
              <th className="px-4 py-2 text-right font-medium" title="Unidades vendidas en los últimos 7 días">Salió 7d</th>
              <th className="px-4 py-2 text-right font-medium" title="Días que dura el stock al ritmo de venta actual">Alcanza</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stock = stockOf(state.lots, p.id)
              const s7 = sold.get(p.id) ?? 0
              const cover = s7 ? Math.round(stock / (s7 / 7)) : null
              return (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="min-w-[200px] cursor-pointer px-4 py-2" onClick={() => setDetail(p.id)}>
                    <div className="font-medium text-slate-800 hover:text-brand-700">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {p.category}
                      {p.tracksLots && ' · por lote'}
                    </div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.barcode ?? <Badge tone="amber">sin código</Badge>}</td>
                  {showCost && <td className="tabular px-4 py-2 text-right text-slate-500">{money(p.cost)}</td>}
                  <td className="px-4 py-2 text-right">
                    {canEdit ? <PriceCell product={p} /> : <span className="tabular font-medium">{money(p.price)}</span>}
                  </td>
                  {showCost && <td className="tabular px-4 py-2 text-right text-slate-500">{p.price ? Math.round(((p.price - p.cost) / p.price) * 100) : 0}%</td>}
                  <td className={cx('tabular px-4 py-2 text-right font-medium', stock <= p.minStock && 'text-amber-600')}>{stock}</td>
                  <td className="tabular px-4 py-2 text-right text-slate-600">{s7}</td>
                  <td className={cx('tabular px-4 py-2 text-right', cover !== null && cover < 4 ? 'text-rose-600' : 'text-slate-500')}>{cover === null ? '—' : `${cover} d`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>

      {detail && <ProductModal productId={detail} onClose={() => setDetail(null)} />}
      <BulkModal open={bulkOpen} onClose={() => setBulkOpen(false)} categories={categories} />
      <NewProductModal open={newOpen} onClose={() => setNewOpen(false)} categories={categories} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

function PriceCell({ product }: { product: Product }) {
  const updatePrice = useStore((s) => s.updatePrice)
  const [value, setValue] = useState<string | null>(null)
  const save = () => {
    if (value !== null && Number(value) > 0) updatePrice(product.id, Number(value))
    setValue(null)
  }
  return (
    <input
      type="number"
      value={value ?? product.price}
      onFocus={(e) => {
        setValue(String(product.price))
        e.target.select()
      }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setValue(null)
      }}
      className="tabular w-24 rounded-md border border-transparent bg-transparent px-2 py-1 text-right font-medium hover:border-slate-300 focus:border-brand-600 focus:bg-white focus:outline-none"
    />
  )
}

const REASONS = ['Conteo', 'Rotura', 'Pérdida', 'Vencido', 'Ingreso de mercadería']

function ProductModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const me = useMe()!
  const state = useStore()
  const p = state.products.find((x) => x.id === productId)!
  const lots = state.lots.filter((l) => l.productId === productId).sort((a, b) => (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))
  const history = state.priceHistory.filter((h) => h.productId === productId)
  const moves = state.movements.filter((m) => m.productId === productId).slice(0, 12)
  const [lotId, setLotId] = useState(lots[0]?.id ?? 'nuevo')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [expiry, setExpiry] = useState('')
  const [msg, setMsg] = useState('')
  const user = (id: string) => state.users.find((u) => u.id === id)?.name.split(' ')[0] ?? id

  return (
    <Modal open onClose={onClose} title={p.name} width="max-w-2xl">
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Badge>{p.category}</Badge>
        <Badge tone="brand">{money(p.price)}</Badge>
        {can(me.role, 'costos.ver') && <Badge>Costo {money(p.cost)}</Badge>}
        <Badge>Stock mínimo {p.minStock}</Badge>
        <span className="font-mono text-xs text-slate-500">{p.barcode ?? 'sin código de barras'}</span>
      </div>

      <h3 className="mb-1 text-sm font-semibold">Stock por lote</h3>
      <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-1.5 font-medium">Lote</th>
              <th className="px-3 py-1.5 font-medium">Vencimiento</th>
              <th className="px-3 py-1.5 text-right font-medium">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((l, i) => {
              const d = l.expiry ? daysUntil(l.expiry) : null
              return (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="px-3 py-1.5 font-mono text-xs">
                    {l.code}
                    {i === 0 && d !== null && d >= 0 && l.qty > 0 && <span className="ml-2 font-sans text-[10px] text-brand-700">se vende primero</span>}
                  </td>
                  <td className="px-3 py-1.5">
                    {l.expiry ? (
                      <span className="flex items-center gap-2">
                        {date(l.expiry)}
                        {d! < 0 ? <Badge tone="red">vencido</Badge> : d! <= state.expiryWarnDays ? <Badge tone="amber">vence en {d} d</Badge> : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">No vence</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-1.5 text-right font-medium">{l.qty}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {can(me.role, 'stock.ajustar') ? (
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <h3 className="mb-2 text-sm font-semibold">Ajuste de stock</h3>
          <div className="grid gap-2 sm:grid-cols-4">
            <Select value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} ({l.qty})
                </option>
              ))}
              <option value="nuevo">Lote nuevo…</option>
            </Select>
            <Input type="number" placeholder="+/- cantidad" value={delta} onChange={(e) => setDelta(e.target.value)} />
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Motivo…</option>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
            <Button
              disabled={!Number(delta) || !reason}
              onClick={() => {
                const err = state.adjustStock({ productId, lotId, delta: Number(delta), reason, expiry: lotId === 'nuevo' ? expiry || null : undefined })
                setMsg(err ?? 'Ajuste registrado y auditado.')
                if (!err) {
                  setDelta('')
                  setReason('')
                }
              }}
            >
              Registrar
            </Button>
          </div>
          {lotId === 'nuevo' && (
            <div className="mt-2 max-w-xs">
              <Input label="Vencimiento del lote nuevo" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </div>
          )}
          {msg && <div className="mt-2 text-xs text-slate-600">{msg}</div>}
          <div className="mt-2">
            <Rule id="M2-R5">El stock nunca se edita directamente: cambia solo por ventas, compras o ajustes con motivo.</Rule>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold">Historial de precios</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-500">Sin cambios registrados.</p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex justify-between border-b border-slate-100 py-1 text-xs">
                <span className="text-slate-500">
                  {dateTime(h.at)} · {user(h.userId)}
                  {h.note && ` · ${h.note}`}
                </span>
                <span className="tabular">
                  {money(h.oldPrice)} → <b>{money(h.newPrice)}</b>
                </span>
              </div>
            ))
          )}
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Últimos movimientos</h3>
          {moves.length === 0 ? (
            <p className="text-xs text-slate-500">Sin movimientos en esta demo todavía.</p>
          ) : (
            moves.map((m) => (
              <div key={m.id} className="flex justify-between border-b border-slate-100 py-1 text-xs">
                <span className="text-slate-500">
                  {dateTime(m.at)} · {m.type}
                  {m.reason && ` · ${m.reason}`}
                </span>
                <span className={cx('tabular font-medium', m.delta < 0 ? 'text-rose-600' : 'text-emerald-600')}>
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
  const bulkPrice = useStore((s) => s.bulkPrice)
  const [cat, setCat] = useState('')
  const [pct, setPct] = useState('10')
  const [done, setDone] = useState<number | null>(null)
  return (
    <Modal
      open={open}
      onClose={() => {
        setDone(null)
        onClose()
      }}
      title="Cambio masivo de precios"
      footer={
        <Button disabled={!Number(pct)} onClick={() => setDone(bulkPrice(cat || null, Number(pct)))}>
          Aplicar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Select label="Categoría" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <Input label="Porcentaje (+ aumento / - rebaja)" type="number" value={pct} onChange={(e) => setPct(e.target.value)} />
      </div>
      <p className="mt-3 text-xs text-slate-500">Los precios se redondean a $10. El cambio rige desde que se guarda y conserva el historial del precio anterior (M2-R4).</p>
      {done !== null && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Listo: {done} precios actualizados.</div>}
    </Modal>
  )
}

function NewProductModal({ open, onClose, categories }: { open: boolean; onClose: () => void; categories: string[] }) {
  const addProduct = useStore((s) => s.addProduct)
  const [f, setF] = useState({ name: '', category: categories[0] ?? '', barcode: '', cost: '', price: '', minStock: '5', qty: '', expiry: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const valid = f.name.trim() && Number(f.price) > 0
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo producto"
      footer={
        <Button
          disabled={!valid}
          onClick={() => {
            addProduct(
              { name: f.name.trim(), category: f.category || 'Sin categoría', barcode: f.barcode || null, cost: Number(f.cost) || 0, price: Number(f.price), minStock: Number(f.minStock) || 0, tracksLots: !!f.expiry },
              Number(f.qty) || 0,
              f.expiry || null,
            )
            setF({ ...f, name: '', barcode: '', cost: '', price: '', qty: '', expiry: '' })
            onClose()
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Input label="Nombre" value={f.name} onChange={set('name')} autoFocus />
        </div>
        <Input label="Categoría" list="cats" value={f.category} onChange={set('category')} />
        <datalist id="cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Input label="Código de barras (opcional)" value={f.barcode} onChange={set('barcode')} placeholder="Se puede asignar al escanear" />
        <Input label="Costo" type="number" value={f.cost} onChange={set('cost')} />
        <Input label="Precio de venta" type="number" value={f.price} onChange={set('price')} />
        <Input label="Stock mínimo" type="number" value={f.minStock} onChange={set('minStock')} />
        <Input label="Stock de apertura" type="number" value={f.qty} onChange={set('qty')} />
        <Input label="Vencimiento (si se controla por lote)" type="date" value={f.expiry} onChange={set('expiry')} />
      </div>
    </Modal>
  )
}

const TEMPLATE = 'nombre;categoria;codigo;costo;precio;stock_minimo;stock\nFernet 750 ml;Bebidas;7790000000017;7800;12500;6;18\nPastillas de menta;Golosinas;;350;700;20;60\n'

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importProducts = useStore((s) => s.importProducts)
  const file = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Parameters<typeof importProducts>[0]>([])
  const [done, setDone] = useState<number | null>(null)

  const parse = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    const sep = lines[0]?.includes(';') ? ';' : ','
    return lines.slice(1).map((l) => {
      const [name, category, barcode, cost, price, minStock, qty] = l.split(sep).map((x) => x.trim())
      return { name, category, barcode: barcode || null, cost: Number(cost) || 0, price: Number(price) || 0, minStock: Number(minStock) || 0, qty: Number(qty) || 0 }
    }).filter((r) => r.name && r.price > 0)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setPreview([])
        setDone(null)
        onClose()
      }}
      title="Importar catálogo desde planilla"
      width="max-w-2xl"
      footer={
        <Button disabled={!preview.length} onClick={() => { setDone(importProducts(preview)); setPreview([]) }}>
          Importar {preview.length || ''} productos
        </Button>
      }
    >
      <p className="text-sm text-slate-600">Carga inicial del catálogo (unos 500 artículos en el kiosco). Exportá la planilla como CSV con estas columnas:</p>
      <code className="mt-2 block rounded bg-slate-50 px-2 py-1 text-xs">nombre; categoria; codigo; costo; precio; stock_minimo; stock</code>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => file.current?.click()}>
          <FileUp size={16} /> Elegir archivo CSV
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const a = document.createElement('a')
            a.href = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }))
            a.download = 'plantilla-catalogo.csv'
            a.click()
          }}
        >
          <Download size={16} /> Descargar plantilla
        </Button>
        <Button variant="ghost" onClick={() => setPreview(parse(TEMPLATE))}>
          Usar ejemplo
        </Button>
        <input
          ref={file}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) setPreview(parse(await f.text()))
            e.target.value = ''
          }}
        />
      </div>
      {preview.length > 0 && (
        <div className="mt-3 max-h-60 overflow-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <tbody>
              {preview.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 first:border-0">
                  <td className="px-2 py-1">{r.name}</td>
                  <td className="px-2 py-1 text-slate-500">{r.category}</td>
                  <td className="px-2 py-1 font-mono text-slate-500">{r.barcode ?? '—'}</td>
                  <td className="tabular px-2 py-1 text-right">{money(r.price)}</td>
                  <td className="tabular px-2 py-1 text-right">{r.qty} u.</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {done !== null && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done} productos importados. Ya están en el listado.</div>}
    </Modal>
  )
}
