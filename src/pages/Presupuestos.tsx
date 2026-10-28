import { useMemo, useState } from 'react'
import { FileSignature, MessageCircle, Printer, ShoppingCart } from 'lucide-react'
import { useStore } from '../store'
import { date, money, todayISO } from '../lib/format'
import type { Quote } from '../types'
import { Badge, Button, Card, Empty, Modal, PageHeader, Segmented, Stat } from '../components/ui'
import { Simulated } from '../components/common'
import { DataTable, type Col } from '../components/DataTable'
import { useConfirm } from '../components/feedback'

const statusLabel = { abierto: 'Abierto', aceptado: 'Aceptado', vencido: 'Vencido', rechazado: 'Rechazado' } as const
const tone = { abierto: 'blue', aceptado: 'green', vencido: 'slate', rechazado: 'red' } as const

export default function Presupuestos() {
  const state = useStore()
  const today = todayISO()
  const [filter, setFilter] = useState<'abierto' | 'todos'>('abierto')
  const [open, setOpen] = useState<Quote | null>(null)
  // un presupuesto abierto con la validez cumplida se muestra como vencido
  const statusOf = (q: Quote) => (q.status === 'abierto' && q.validUntil < today ? 'vencido' : q.status)
  const quotes = useMemo(() => state.quotes.filter((q) => q.businessId === state.businessId).sort((a, b) => b.at.localeCompare(a.at)), [state.quotes, state.businessId])
  const list = filter === 'abierto' ? quotes.filter((q) => statusOf(q) === 'abierto') : quotes
  const openQ = quotes.filter((q) => statusOf(q) === 'abierto')
  const decided = quotes.filter((q) => q.status === 'aceptado' || q.status === 'rechazado' || statusOf(q) === 'vencido')
  const conversion = decided.length ? (quotes.filter((q) => q.status === 'aceptado').length / decided.length) * 100 : 0
  const ageDays = (q: Quote) => Math.floor((Date.now() - new Date(q.at).getTime()) / 86400000)


  const columns: Col<Quote>[] = [
    {
      key: 'cliente',
      header: 'Presupuesto y cliente',
      mobile: 'title',
      className: 'min-w-[14rem]',
      cell: (q) => (
        <>
          <span className="tabular text-ink-300">#{q.number}</span> <span className="wrap-any font-semibold text-white">{q.clientName}</span>
          {q.note && <div className="wrap-any text-xs font-normal text-ink-300">{q.note}</div>}
        </>
      ),
    },
    { key: 'total', header: 'Total', align: 'right', mobile: 'value', cell: (q) => <span className="tabular whitespace-nowrap font-semibold text-white">{money(q.total)}</span> },
    {
      key: 'fecha',
      header: 'Emitido',
      className: 'whitespace-nowrap text-ink-200',
      cell: (q) => (
        <>
          {date(q.at)} <span className="text-ink-300">(hace {ageDays(q)} d)</span>
        </>
      ),
    },
    { key: 'valido', header: 'Válido hasta', className: 'whitespace-nowrap text-ink-200', cell: (q) => date(q.validUntil) },
    {
      key: 'estado',
      header: 'Estado',
      cell: (q) => {
        const st = statusOf(q)
        return (
          <>
            <Badge tone={tone[st]}>{statusLabel[st]}</Badge>
            {q.followUps > 0 && st === 'abierto' && <div className="mt-0.5 text-xs text-ink-300">{q.followUps} seguimiento{q.followUps > 1 ? 's' : ''} enviado{q.followUps > 1 ? 's' : ''}</div>}
          </>
        )
      },
    },
    {
      key: 'acc',
      header: 'Acciones',
      mobile: 'actions',
      align: 'right',
      className: 'whitespace-nowrap',
      cell: (q) =>
        statusOf(q) === 'abierto' ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" onClick={() => state.loadQuote(q.id)}>
              <ShoppingCart size={13} aria-hidden /> Convertir en venta
            </Button>
            <Button size="sm" variant="secondary" onClick={() => state.followUpQuote(q.id)}>
              <MessageCircle size={14} aria-hidden /> Enviar seguimiento
            </Button>
          </div>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Presupuestos"
        subtitle="Se arman desde la caja con precios congelados, se envían al cliente y se convierten en venta con un clic. Los abiertos reciben seguimiento automático."
        actions={
          <Button onClick={() => state.setPage('venta')}>
            <ShoppingCart size={16} aria-hidden /> Armar presupuesto en caja
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <Stat label="Abiertos" value={openQ.length} hint={money(openQ.reduce((a, q) => a + q.total, 0))} />
        <Stat label="Tasa de cierre" value={`${Math.round(conversion)}%`} hint="aceptados sobre decididos" />
        <Stat label="Sin seguimiento" value={openQ.filter((q) => q.followUps === 0 && ageDays(q) >= 3).length} tone={openQ.some((q) => q.followUps === 0 && ageDays(q) >= 3) ? 'amber' : undefined} hint="abiertos hace 3 días o más" />
        <Stat label="Ticket promedio" value={money(quotes.length ? quotes.reduce((a, q) => a + q.total, 0) / quotes.length : 0)} />
      </div>
      <div className="mb-3">
        <Segmented
          label="Presupuestos a mostrar"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'abierto', label: 'Abiertos' },
            { value: 'todos', label: 'Todos' },
          ]}
        />
      </div>
      <Card>
        {list.length === 0 ? (
          <Empty icon={<FileSignature size={22} />} action={<Button onClick={() => state.setPage('venta')}>Armar un presupuesto</Button>}>
            No hay presupuestos {filter === 'abierto' ? 'abiertos' : 'cargados'}. Armá uno desde la caja con “Guardar como presupuesto”.
          </Empty>
        ) : (
          <DataTable caption="Presupuestos" columns={columns} rows={list} rowKey={(q) => q.id} onRowClick={setOpen} rowLabel={(q) => `Presupuesto ${q.number} de ${q.clientName}. Abrir detalle`} />
        )}
      </Card>
      {open && <QuoteDetail q={open} status={statusOf(open)} onClose={() => setOpen(null)} />}
    </div>
  )
}

function QuoteDetail({ q, status, onClose }: { q: Quote; status: Quote['status']; onClose: () => void }) {
  const state = useStore()
  const confirm = useConfirm()
  const subtotal = q.items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
  return (
    <Modal open onClose={onClose} title={`Presupuesto #${q.number}`} width="max-w-2xl">
      <div className="print-area rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
        <div className="flex justify-between text-sm">
          <div>
            <div className="font-semibold text-white">{q.clientName}</div>
            <div className="text-ink-300">
              Emitido {date(q.at)} · válido hasta {date(q.validUntil)}
            </div>
          </div>
          <Badge tone={tone[status]}>{status}</Badge>
        </div>
        <div className="mt-3 space-y-1">
          {q.items.map((i) => (
            <div key={i.productId + (i.unitId ?? '')} className="flex justify-between gap-3 text-sm">
              <span className="text-ink-200">
                {i.qty} × {i.name}
                {i.unitLabel && <span className="text-ink-400"> ({i.unitLabel})</span>}
              </span>
              <span className="tabular text-white">{money(i.qty * i.unitPrice)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-sm">
          {q.discountPct > 0 && (
            <div className="flex justify-between text-ink-300">
              <span>Descuento {q.discountPct}%</span>
              <span className="tabular">−{money(subtotal - q.total)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-white">
            <span>Total</span>
            <span className="tabular">{money(q.total)}</span>
          </div>
        </div>
        {q.note && <p className="mt-2 text-xs text-ink-300">{q.note}</p>}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={15} /> Imprimir
        </Button>
        {status === 'abierto' && (
          <>
            <Button
              variant="secondary"
              onClick={async () => {
                if (await confirm({ title: 'Marcar como rechazado', message: `El presupuesto #${q.number} de ${q.clientName} deja de estar abierto y no recibe más seguimientos.`, confirmLabel: 'Marcar rechazado', danger: true })) {
                  state.setQuoteStatus(q.id, 'rechazado')
                  onClose()
                }
              }}
            >
              Marcar rechazado
            </Button>
            <Button variant="secondary" onClick={() => state.followUpQuote(q.id)}>
              <MessageCircle size={15} /> Seguimiento
            </Button>
            <Button onClick={() => state.loadQuote(q.id)}>
              <ShoppingCart size={15} /> Convertir en venta
            </Button>
          </>
        )}
        <Simulated>Envíos simulados</Simulated>
      </div>
    </Modal>
  )
}
