import { useMemo, useState } from 'react'
import { FileSearch, RefreshCw, ServerCrash } from 'lucide-react'
import { useOnline, useStore } from '../store'
import { dateTime, formatCuit, money } from '../lib/format'
import { invoiceNumber } from '../lib/arca'
import type { Invoice, InvoiceStatus } from '../types'
import { Button, Card, Empty, Modal, PageHeader, Rule, Segmented, Stat } from '../components/ui'
import Receipt, { InvoiceStatusBadge } from '../components/Receipt'
import { DataTable, type Col } from '../components/DataTable'

export default function Comprobantes() {
  const state = useStore()
  const online = useOnline()
  const [filter, setFilter] = useState<InvoiceStatus | 'todos'>('todos')
  const [open, setOpen] = useState<string | null>(null)

  const all = useMemo(() => state.invoices.filter((i) => i.businessId === state.businessId), [state.invoices, state.businessId])
  const list = all.filter((i) => filter === 'todos' || i.status === filter)
  const count = (s: InvoiceStatus) => all.filter((i) => i.status === s).length
  const inv = all.find((i) => i.id === open)
  const sale = inv && state.sales.find((s) => s.id === inv.saleId)

  const columns: Col<Invoice>[] = [
    { key: 'kind', header: 'Comprobante', mobile: 'title', className: 'font-semibold', cell: (i) => i.kind },
    { key: 'total', header: 'Total', align: 'right', mobile: 'value', cell: (i) => <span className="tabular whitespace-nowrap font-semibold">{money(i.total)}</span> },
    { key: 'num', header: 'Número', className: 'tabular font-mono text-xs whitespace-nowrap', cell: (i) => invoiceNumber(i.pointOfSale, i.number) },
    {
      key: 'cliente',
      header: 'Cliente',
      className: 'min-w-[10rem]',
      cell: (i) => (
        <>
          <span className="wrap-any">{i.customer.name}</span>
          {i.customer.cuit && <div className="font-mono text-xs text-ink-300">CUIT {formatCuit(i.customer.cuit)}</div>}
        </>
      ),
    },
    { key: 'fecha', header: 'Fecha', className: 'whitespace-nowrap text-ink-200', cell: (i) => dateTime(i.createdAt) },
    { key: 'cae', header: 'CAE', className: 'font-mono text-xs text-ink-200', cell: (i) => i.cae ?? 'Todavía sin CAE' },
    {
      key: 'estado',
      header: 'Estado',
      className: 'min-w-[11rem]',
      cell: (i) => (
        <>
          <InvoiceStatusBadge inv={i} />
          {i.status !== 'emitido' && i.lastError && <div className="mt-1 text-xs leading-snug text-ink-200">{i.lastError}</div>}
        </>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Comprobantes ARCA"
        tag="M5"
        subtitle="Facturas A y B y notas de crédito emitidas desde la venta, sin tipear nada en otro sistema."
        actions={
          <Button variant="secondary" disabled={!online || !count('pendiente')} onClick={() => state.retryPendingInvoices()}>
            <RefreshCw size={16} aria-hidden /> Reintentar pendientes
          </Button>
        }
      />

      {(state.arcaDown || !online) && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 p-3 text-sm text-amber-100">
          <ServerCrash size={18} className="mt-0.5 shrink-0" aria-hidden />
          <div>
            <b>Modo contingencia.</b> {!online ? 'No hay internet.' : 'ARCA no responde.'} Las ventas se completan igual y los comprobantes quedan pendientes. Se reintentan solos cada pocos segundos.
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <Stat label="Emitidos" value={count('emitido')} tone="green" />
        <Stat label="Pendientes" value={count('pendiente')} tone={count('pendiente') ? 'amber' : undefined} />
        <Stat label="Rechazados" value={count('rechazado')} tone={count('rechazado') ? 'red' : undefined} />
      </div>

      <div className="mb-3">
        <Segmented
          label="Filtrar por estado"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'emitido', label: 'Emitidos' },
            { value: 'pendiente', label: 'Pendientes' },
            { value: 'rechazado', label: 'Rechazados' },
          ]}
        />
      </div>

      <Card>
        {list.length === 0 ? (
          <Empty icon={<FileSearch size={22} />} action={filter !== 'todos' && <Button variant="secondary" onClick={() => setFilter('todos')}>Ver todos</Button>}>
            {filter === 'todos' ? 'Todavía no hay comprobantes. Hacé una venta con Factura A o B y aparece acá.' : `No hay comprobantes ${filter === 'emitido' ? 'emitidos' : filter === 'pendiente' ? 'pendientes' : 'rechazados'} en este negocio.`}
          </Empty>
        ) : (
          <DataTable caption="Listado de comprobantes" columns={columns} rows={list} rowKey={(i) => i.id} onRowClick={(i) => setOpen(i.id)} rowLabel={(i) => `${i.kind} ${invoiceNumber(i.pointOfSale, i.number)}. Ver comprobante`} />
        )}
      </Card>

      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        <Rule id="M5-R1">Un comprobante emitido no se modifica: se corrige con una nota de crédito.</Rule>
        <Rule id="M5-R2">Los pendientes se reintentan solos hasta emitirse o fallar con aviso.</Rule>
        <Rule id="M5-R3">La numeración respeta el punto de venta y la secuencia: el número se asigna al obtener el CAE.</Rule>
        <Rule id="M5-R4">Cada negocio con CUIT propio usa su propio certificado y punto de venta.</Rule>
      </div>

      <Modal open={!!inv} onClose={() => setOpen(null)} title={inv ? `${inv.kind} ${invoiceNumber(inv.pointOfSale, inv.number)}` : ''}>
        {inv && sale && <Receipt sale={sale} invoiceId={inv.id} />}
      </Modal>
    </div>
  )
}
