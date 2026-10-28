import { useMemo, useState } from 'react'
import { CreditCard, GitCompareArrows } from 'lucide-react'
import { useOnline, useStore } from '../store'
import { dateTime, money } from '../lib/format'
import { Badge, Button, Card, Empty, PageHeader, Rule, Stat } from '../components/ui'
import { DataTable, type Col } from '../components/DataTable'
import type { MpMovement } from '../types'
import { Simulated } from '../components/common'

export default function Cobros() {
  const state = useStore()
  const online = useOnline()
  const biz = state.businessId
  const [result, setResult] = useState('')
  const mine = useMemo(() => state.mp.filter((m) => m.businessId === biz).sort((a, b) => b.at.localeCompare(a.at)), [state.mp, biz])
  const ok = mine.filter((m) => m.status !== 'rechazado')
  const gross = ok.reduce((a, m) => a + m.amount, 0)
  const fees = ok.reduce((a, m) => a + m.fee, 0)
  const pending = ok.filter((m) => m.status === 'pendiente').reduce((a, m) => a + m.amount - m.fee, 0)
  const noSale = mine.filter((m) => m.match === 'sin venta')
  const diff = mine.filter((m) => m.match === 'diferencia')
  const missing = useMemo(
    () => state.sales.filter((s) => s.businessId === biz && s.status === 'completada' && s.payments.some((p) => p.mpId) && Date.now() - new Date(s.at).getTime() < 10 * 86400000 && !mine.some((m) => m.saleId === s.id)),
    [state.sales, mine, biz],
  )


  const columns: Col<MpMovement>[] = [
    {
      key: 'op',
      header: 'Operación',
      mobile: 'title',
      cell: (m) => (
        <>
          <div className="font-mono text-xs text-white">{m.id}</div>
          <div className="wrap-any text-xs font-normal text-ink-300">{m.description}</div>
        </>
      ),
    },
    { key: 'bruto', header: 'Bruto', align: 'right', mobile: 'value', cell: (m) => <span className="tabular whitespace-nowrap font-semibold">{money(m.amount)}</span> },
    { key: 'fecha', header: 'Fecha', className: 'whitespace-nowrap text-ink-200', cell: (m) => dateTime(m.at) },
    { key: 'medio', header: 'Medio', className: 'text-ink-200', cell: (m) => (m.method === 'qr' ? 'QR' : 'Tarjeta') },
    { key: 'fee', header: 'Comisión', align: 'right', className: 'tabular text-ink-200', cell: (m) => money(m.fee) },
    { key: 'estado', header: 'Estado', cell: (m) => <Badge tone={m.status === 'acreditado' ? 'green' : m.status === 'pendiente' ? 'amber' : 'red'}>{m.status === 'acreditado' ? 'Acreditado' : m.status === 'pendiente' ? 'Pendiente de acreditar' : 'Rechazado o devuelto'}</Badge> },
    { key: 'conc', header: 'Conciliación', cell: (m) => <Badge tone={m.match === 'ok' ? 'green' : 'amber'}>{m.match === 'ok' ? 'Coincide con la venta' : m.match === 'sin venta' ? 'Pago sin venta' : 'Importe distinto'}</Badge> },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Cobros digitales"
        tag="A2"
        subtitle="Tarjeta de crédito y débito con terminales Point, QR y transferencias de Mercado Pago, conciliados contra las ventas."
        actions={
          <Button disabled={!online} onClick={() => setResult(state.reconcileMp())}>
            <GitCompareArrows size={16} /> Conciliar ahora
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-300">
        Datos de Mercado Pago de ejemplo. <Simulated>Integración simulada</Simulated>
      </div>
      {result && <div className="mb-4 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">{result}</div>}
      <div className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cobrado (últimos 10 días)" value={money(gross)} hint={`${ok.length} operaciones`} />
        <Stat label="Comisiones estimadas" value={money(fees)} hint={gross ? `${((fees / gross) * 100).toFixed(1).replace('.', ',')}% promedio` : ''} />
        <Stat label="Neto a acreditar" value={money(pending)} hint="pendiente de liquidación" />
        <Stat label="Diferencias a revisar" value={noSale.length + diff.length + missing.length} tone={noSale.length + diff.length + missing.length ? 'amber' : 'green'} />
      </div>

      {(noSale.length > 0 || diff.length > 0 || missing.length > 0) && (
        <Card className="mb-4 p-5">
          <div className="mb-3 font-bold text-white">Para revisar</div>
          <div className="space-y-2 text-sm">
            {noSale.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-400/10 px-3 py-2 ring-1 ring-amber-300/25">
                <span className="text-amber-100">
                  Pago sin venta: {m.method === 'qr' ? 'QR' : 'tarjeta'} por {money(m.amount)} el {dateTime(m.at)} ({m.id}). Puede ser una venta que no se registró en caja.
                </span>
              </div>
            ))}
            {diff.map((m) => (
              <div key={m.id} className="rounded-xl bg-amber-400/10 px-3 py-2 text-amber-100 ring-1 ring-amber-300/25">
                Importe distinto: {m.description} acreditó {money(m.amount)}, distinto a lo cobrado en caja.
              </div>
            ))}
            {missing.map((s) => (
              <div key={s.id} className="rounded-xl bg-amber-400/10 px-3 py-2 text-amber-100 ring-1 ring-amber-300/25">
                Venta sin acreditación: #{s.number} del {dateTime(s.at)} por {money(s.total)}. Verificar en la terminal si se aprobó.
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        {mine.length === 0 ? (
          <Empty icon={<CreditCard size={22} />}>Todavía no hay cobros digitales en este negocio. Cobrá una venta con tarjeta o QR y aparece acá.</Empty>
        ) : (
          <DataTable caption="Cobros digitales de Mercado Pago" columns={columns} rows={mine.slice(0, 120)} rowKey={(m) => m.id} />
        )}
      </Card>
      <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
        <Rule id="A2">Un pago aprobado en la terminal cierra la venta sin intervención manual.</Rule>
        <Rule id="A2">Un pago rechazado deja la venta abierta para elegir otro medio.</Rule>
        <Rule id="A2">La conciliación detecta ventas sin pago y pagos sin venta.</Rule>
        <Rule id="M4-R2">Sin conexión no se confirman pagos con tarjeta ni QR.</Rule>
      </div>
    </div>
  )
}
