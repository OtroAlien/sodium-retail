// Piezas de interfaz compartidas entre pantallas.
import { useMemo, useState, type ReactNode } from 'react'
import { FlaskConical, Plus, Search, UserRound, X } from 'lucide-react'
import { useStore } from '../store'
import { clientBalance } from '../store/selectors'
import { money } from '../lib/format'
import type { Client, PayMethod } from '../types'
import { Button, Input, cx } from './ui'

export const payLabel: Record<PayMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta: 'Tarjeta (Mercado Pago)',
  qr: 'QR (Mercado Pago)',
  cuenta_corriente: 'Cuenta corriente',
}

/** marca visible para acciones o integraciones que en la demo no son reales */
export function Simulated({ children = 'Simulado', className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full bg-violet-400/12 px-2 py-0.5 text-xs font-semibold text-violet-200 ring-1 ring-inset ring-violet-300/25', className)}>
      <FlaskConical size={11} />
      {children}
    </span>
  )
}

/** selector de cliente registrado del negocio actual, con alta rápida */
export function ClientPicker({ value, onChange, placeholder = 'Buscar cliente por nombre, teléfono o CUIT' }: { value?: string; onChange: (c: Client | null) => void; placeholder?: string }) {
  const businessId = useStore((s) => s.businessId)
  const all = useStore((s) => s.clients)
  const accounts = useStore((s) => s.accounts)
  const addClient = useStore((s) => s.addClient)
  const clients = useMemo(() => all.filter((c) => c.businessId === businessId), [all, businessId])
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [phone, setPhone] = useState('')
  const selected = clients.find((c) => c.id === value)

  if (selected) {
    const bal = clientBalance(accounts, selected.id)
    return (
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2 ring-1 ring-white/12">
        <UserRound size={16} className="text-brand-200" />
        <div className="min-w-0 flex-1">
          <div className="wrap-any text-sm font-semibold text-white">{selected.name}</div>
          <div className="wrap-any text-xs text-ink-300">
            {selected.phone}
            {selected.creditLimit > 0 && ` · cuenta corriente: saldo ${money(bal)} de ${money(selected.creditLimit)}`}
          </div>
        </div>
        <button onClick={() => onChange(null)} className="rounded-full p-1 text-ink-300 hover:bg-white/10 hover:text-white" aria-label="Quitar cliente">
          <X size={15} />
        </button>
      </div>
    )
  }

  const term = q.trim().toLowerCase()
  const matches = term ? clients.filter((c) => c.name.toLowerCase().includes(term) || c.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '#') || c.cuit?.includes(term)).slice(0, 5) : []
  return (
    <div>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <Input className="pl-9" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {matches.length > 0 && (
        <div className="mt-1 overflow-hidden rounded-xl ring-1 ring-white/10">
          {matches.map((c) => (
            <button key={c.id} onClick={() => onChange(c)} className="flex w-full items-center justify-between gap-2 bg-white/[0.04] px-3 py-2 text-left text-sm hover:bg-white/10">
              <span className="wrap-any font-medium text-white">{c.name}</span>
              <span className="shrink-0 text-xs text-ink-300">{c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {term && !matches.length && !adding && (
        <button onClick={() => setAdding(true)} className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-200 hover:text-white">
          <Plus size={13} /> Crear cliente “{q.trim()}”
        </button>
      )}
      {adding && (
        <div className="mt-2 flex gap-2">
          <Input placeholder="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Button
            size="sm"
            className="h-[42px] shrink-0"
            disabled={!phone.trim()}
            onClick={() => {
              const c = addClient({ name: q.trim(), phone: phone.trim(), ivaCondition: 'Consumidor final', creditLimit: 0, tags: ['nuevo'] })
              setAdding(false)
              setQ('')
              setPhone('')
              onChange(c)
            }}
          >
            Crear
          </Button>
        </div>
      )}
    </div>
  )
}

/** barras horizontales con etiqueta y valor directo (una sola serie) */
export function HBars({ rows, format = money, max }: { rows: { label: ReactNode; value: number; hint?: string }[]; format?: (n: number) => string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="wrap-any font-medium text-ink-100">{r.label}</span>
            <span className="tabular shrink-0 font-semibold text-white">
              {format(r.value)}
              {r.hint && <span className="ml-1.5 text-xs font-normal text-ink-300">{r.hint}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={cx('h-full rounded-full', i === 0 ? 'bg-white' : 'bg-brand-400')} style={{ width: `${Math.max(2, (r.value / top) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => (typeof c === 'string' && /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : String(c))).join(';')).join('\n')
  const a = document.createElement('a')
  // BOM para que Excel abra bien los acentos
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = filename
  a.click()
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-white">{children}</h2>
      {right}
    </div>
  )
}
