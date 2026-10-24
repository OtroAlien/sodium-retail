import { QRCodeSVG } from 'qrcode.react'
import { AlertTriangle, MessageCircle, Printer } from 'lucide-react'
import { useStore } from '../store'
import { businesses } from '../data/seed'
import { dateTime, formatCuit, money } from '../lib/format'
import { invoiceNumber, qrUrl } from '../lib/arca'
import type { Invoice, Sale } from '../types'
import { Badge, Button } from './ui'

export function InvoiceStatusBadge({ inv }: { inv: Invoice }) {
  if (inv.status === 'emitido') return <Badge tone="green">Emitido</Badge>
  if (inv.status === 'pendiente') return <Badge tone="amber">Pendiente</Badge>
  return <Badge tone="red">Rechazado</Badge>
}

/** Comprobante de una venta: interno o factura con CAE y QR (M1 / M5) */
export default function Receipt({ sale, invoiceId }: { sale: Sale; invoiceId?: string }) {
  const invoices = useStore((s) => s.invoices)
  const users = useStore((s) => s.users)
  const inv = invoices.find((i) => i.id === (invoiceId ?? sale.invoiceId))
  const biz = businesses[sale.businessId]
  const seller = users.find((u) => u.id === sale.userId)
  const isCredit = inv?.kind.startsWith('Nota')

  const text = [
    `${biz.legalName}`,
    inv ? `${inv.kind} ${invoiceNumber(inv.pointOfSale, inv.number)}` : `Comprobante interno #${sale.number}`,
    ...sale.items.map((i) => `${i.qty} x ${i.name}: ${money(i.qty * i.unitPrice)}`),
    sale.discountPct ? `Descuento ${sale.discountPct}%` : '',
    `TOTAL ${money(sale.total)}`,
    inv?.cae ? `CAE ${inv.cae}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div>
      <div className="print-area mx-auto max-w-sm rounded-lg border border-dashed border-ink-200 bg-white p-4 font-mono text-[12px] leading-relaxed text-ink-900">
        <div className="text-center">
          <div className="text-sm font-bold">{biz.legalName}</div>
          <div>CUIT {formatCuit(biz.cuit)} · {biz.ivaCondition}</div>
          <div>{biz.address}</div>
        </div>
        <div className="my-2 border-t border-dashed border-ink-200" />
        {inv ? (
          <div className="text-center">
            <div className="text-sm font-bold uppercase">{inv.kind}</div>
            <div>N° {invoiceNumber(inv.pointOfSale, inv.number)}</div>
          </div>
        ) : (
          <div className="text-center font-bold">COMPROBANTE INTERNO N° {sale.number}</div>
        )}
        <div className="mt-1 flex justify-between">
          <span>{dateTime(sale.at)}</span>
          <span>Atendió: {seller?.name.split(' ')[0]}</span>
        </div>
        {inv && (
          <div className="mt-1">
            Cliente: {inv.customer.name}
            {inv.customer.cuit && <> · CUIT {formatCuit(inv.customer.cuit)}</>}
            <br />
            {inv.customer.ivaCondition}
          </div>
        )}
        <div className="my-2 border-t border-dashed border-ink-200" />
        {sale.items.map((i) => (
          <div key={i.productId} className="flex justify-between gap-2">
            <span className="truncate">
              {i.qty} x {i.name}
            </span>
            <span className="tabular shrink-0">{money(i.qty * i.unitPrice)}</span>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-ink-200" />
        {sale.discountPct > 0 && (
          <div className="flex justify-between">
            <span>Descuento {sale.discountPct}%</span>
            <span className="tabular">-{money(sale.subtotal - sale.total)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold">
          <span>{isCredit ? 'TOTAL A FAVOR' : 'TOTAL'}</span>
          <span className="tabular">{money(sale.total)}</span>
        </div>
        {!isCredit &&
          sale.payments.map((p, idx) => (
            <div key={idx} className="flex justify-between">
              <span>{p.method === 'efectivo' ? 'Efectivo' : `Transferencia${p.account ? ` (${p.account.split(' (')[0]})` : ''}`}</span>
              <span className="tabular">{money(p.amount)}</span>
            </div>
          ))}
        {!isCredit && sale.change ? (
          <div className="flex justify-between">
            <span>Recibido {money(sale.cashReceived ?? 0)} · Vuelto</span>
            <span className="tabular">{money(sale.change)}</span>
          </div>
        ) : null}

        {inv && inv.status === 'emitido' && inv.cae && inv.number != null && (
          <>
            <div className="my-2 border-t border-dashed border-ink-200" />
            <div className="flex items-center gap-3">
              <QRCodeSVG
                value={qrUrl({ date: inv.issuedAt ?? sale.at, cuit: biz.cuit, pos: inv.pointOfSale, kind: inv.kind, number: inv.number, total: inv.total, customerCuit: inv.customer.cuit, cae: inv.cae })}
                size={84}
              />
              <div>
                <div className="font-bold">CAE {inv.cae}</div>
                <div>Vto. CAE {inv.caeExpiry?.split('-').reverse().join('/')}</div>
                <div className="mt-1 text-[10px] text-ink-400">Comprobante autorizado (simulación de ARCA)</div>
              </div>
            </div>
          </>
        )}
        {inv && inv.status !== 'emitido' && (
          <div className="mt-2 flex items-start gap-1.5 rounded bg-amber-50 p-2 font-sans text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>{inv.status === 'pendiente' ? `Comprobante en contingencia: ${inv.lastError ?? 'pendiente de CAE.'}` : inv.lastError}</span>
          </div>
        )}
        {sale.status === 'anulada' && !isCredit && <div className="mt-2 text-center text-sm font-bold text-rose-600">*** VENTA ANULADA ***</div>}
      </div>

      <div className="no-print mt-4 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir
        </Button>
        <Button variant="secondary" onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank')}>
          <MessageCircle size={16} /> Enviar por WhatsApp
        </Button>
      </div>
    </div>
  )
}
