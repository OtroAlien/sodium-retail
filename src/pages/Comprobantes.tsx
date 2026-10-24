import { useMemo, useState } from 'react'
import { RefreshCw, ServerCrash } from 'lucide-react'
import { useOnline, useStore } from '../store'
import { dateTime, formatCuit, money } from '../lib/format'
import { invoiceNumber } from '../lib/arca'
import type { InvoiceStatus } from '../types'
import { Button, Card, Empty, Modal, PageHeader, Rule, Stat, cx } from '../components/ui'
import Receipt, { InvoiceStatusBadge } from '../components/Receipt'

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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Comprobantes ARCA"
        tag="M5"
        subtitle="Facturas A y B y notas de crédito emitidas desde la venta, sin tipear nada en otro sistema."
        actions={
          <Button variant="secondary" disabled={!online || !count('pendiente')} onClick={() => state.retryPendingInvoices()}>
            <RefreshCw size={16} /> Reintentar pendientes
          </Button>
        }
      />

      {(state.arcaDown || !online) && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ServerCrash size={18} className="mt-0.5 shrink-0" />
          <div>
            <b>Modo contingencia.</b> {!online ? 'No hay internet.' : 'ARCA no responde.'} Las ventas se completan igual y los comprobantes quedan pendientes. Se reintentan solos cada pocos segundos.
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Emitidos" value={count('emitido')} tone="green" />
        <Stat label="Pendientes" value={count('pendiente')} tone={count('pendiente') ? 'amber' : undefined} />
        <Stat label="Rechazados" value={count('rechazado')} tone={count('rechazado') ? 'red' : undefined} />
      </div>

      <div className="mb-3 flex gap-1 rounded-lg bg-white p-1 ring-1 ring-slate-200 sm:w-fit">
        {(['todos', 'emitido', 'pendiente', 'rechazado'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cx('flex-1 rounded-md px-3 py-1 text-sm capitalize', filter === f ? 'bg-brand-700 text-white' : 'text-slate-600')}>
            {f}
          </button>
        ))}
      </div>

      <Card className="overflow-x-auto">
        {list.length === 0 ? (
          <Empty>Todavía no hay comprobantes. Hacé una venta con Factura A o B.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Comprobante</th>
                <th className="px-4 py-2 font-medium">Número</th>
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">CAE</th>
                <th className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id} onClick={() => setOpen(i.id)} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium">{i.kind}</td>
                  <td className="tabular px-4 py-2.5 font-mono text-xs">{invoiceNumber(i.pointOfSale, i.number)}</td>
                  <td className="px-4 py-2.5">
                    {i.customer.name}
                    {i.customer.cuit && <div className="font-mono text-[11px] text-slate-500">{formatCuit(i.customer.cuit)}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{dateTime(i.createdAt)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{money(i.total)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{i.cae ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <InvoiceStatusBadge inv={i} />
                    {i.status !== 'emitido' && i.lastError && <div className="mt-0.5 max-w-[220px] text-[11px] text-slate-500">{i.lastError}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
