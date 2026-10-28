// Clientes, cuentas corrientes y presupuestos.
import type { Client, Quote } from '../types'
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { addDays, money, uid } from '../lib/format'
import { can } from '../lib/permissions'
import { clientBalance, currentSession, unitOf } from './selectors'

export function customersSlice(set: SetState, get: GetState, h: Helpers) {
  return {
    addClient: (c) => {
      const client: Client = { ...c, id: uid('c-'), businessId: get().businessId, createdAt: now() }
      if (client.creditLimit > 0 && !can(h.me(), 'clientes.credito')) client.creditLimit = 0
      set((s) => ({ clients: [client, ...s.clients] }))
      h.audit('clientes', `Alta de cliente ${client.name}${client.creditLimit ? ` con cuenta corriente de ${money(client.creditLimit)}` : ''}`)
      h.enqueue(`Alta de cliente ${client.name}`)
      h.notify(`Cliente ${client.name} creado.`)
      return client
    },
    updateClient: (id, patch) => {
      const c = get().clients.find((x) => x.id === id)
      if (!c) return
      if (patch.creditLimit !== undefined && patch.creditLimit !== c.creditLimit && !can(h.me(), 'clientes.credito')) delete patch.creditLimit
      set((s) => ({ clients: s.clients.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      if (patch.creditLimit !== undefined && patch.creditLimit !== c.creditLimit)
        h.audit('cuenta corriente', `Límite de ${c.name}`, money(c.creditLimit), money(patch.creditLimit))
      h.enqueue(`Cliente ${c.name}`)
      h.notify(`Datos de ${c.name} guardados.`)
    },
    payAccount: (clientId, amount, method) => {
      const c = get().clients.find((x) => x.id === clientId)
      if (!c) return 'Cliente inexistente'
      if (amount <= 0) return 'El monto debe ser mayor a cero'
      if (method === 'efectivo') {
        if (!currentSession(get())) return 'Para cobrar en efectivo abrí una caja'
        get().addCashMovement('ingreso', amount, `Cobro de cuenta corriente: ${c.name}`)
      }
      const before = clientBalance(get().accounts, clientId)
      set((s) => ({ accounts: [{ id: uid('ae-'), businessId: c.businessId, clientId, at: now(), type: 'pago', amount, ref: 'Pago a cuenta', method }, ...s.accounts] }))
      h.audit('cuenta corriente', `Cobro a ${c.name}: ${money(amount)} (${method})`, money(before), money(before - amount))
      h.enqueue(`Cobro de cuenta corriente ${c.name}`)
      h.notify(`Cobro de ${money(amount)} registrado en la cuenta de ${c.name}.`)
      return null
    },

    createQuote: ({ cart, clientId, clientName, discountPct, note, validDays }) => {
      const products = get().products
      const items = cart.map((l) => {
        const p = products.find((x) => x.id === l.productId)!
        const u = unitOf(p, l.unitId)
        return { productId: p.id, name: p.name, qty: l.qty, unitId: u.id, unitLabel: u.id === 'base' ? undefined : u.label, unitPrice: l.price ?? u.price }
      })
      const subtotal = items.reduce((a, i) => a + i.qty * i.unitPrice, 0)
      const number = get().quoteSeq + 1
      const q: Quote = {
        id: uid('q-'),
        number,
        businessId: get().businessId,
        clientId,
        clientName,
        at: now(),
        validUntil: addDays(validDays),
        items,
        discountPct,
        total: Math.round(subtotal * (1 - discountPct / 100)),
        status: 'abierto',
        userId: get().currentUserId ?? 'sistema',
        followUps: 0,
        note,
      }
      set((s) => ({ quotes: [q, ...s.quotes], quoteSeq: number }))
      h.audit('presupuesto', `Presupuesto #${number} para ${clientName} por ${money(q.total)}`)
      h.enqueue(`Presupuesto #${number}`)
      h.notify(`Presupuesto #${number} guardado.`)
      return q
    },
    setQuoteStatus: (id, status) => {
      const q = get().quotes.find((x) => x.id === id)
      if (!q) return
      set((s) => ({ quotes: s.quotes.map((x) => (x.id === id ? { ...x, status } : x)) }))
      h.audit('presupuesto', `Presupuesto #${q.number}`, q.status, status)
      h.enqueue(`Presupuesto #${q.number} ${status}`)
      h.notify(`Presupuesto #${q.number} marcado como ${status}.`)
    },
    followUpQuote: (id) => {
      const q = get().quotes.find((x) => x.id === id)
      if (!q) return
      const client = get().clients.find((c) => c.id === q.clientId)
      h.message({
        businessId: q.businessId,
        channel: 'WhatsApp',
        to: client ? `${client.name} · ${client.phone}` : q.clientName,
        subject: `Seguimiento presupuesto #${q.number}`,
        body: `Hola ${q.clientName.split(' ')[0]}, ¿pudiste revisar el presupuesto #${q.number} por ${money(q.total)}? Los precios se mantienen hasta el ${q.validUntil.split('-').reverse().join('/')}. Si querés lo dejamos preparado para retirar.`,
      })
      set((s) => ({ quotes: s.quotes.map((x) => (x.id === id ? { ...x, followUps: x.followUps + 1 } : x)) }))
      h.enqueue(`Seguimiento presupuesto #${q.number}`)
      h.notify(`Seguimiento enviado a ${q.clientName} por WhatsApp (simulado).`)
    },
    loadQuote: (id) => {
      const q = get().quotes.find((x) => x.id === id)
      if (!q) return
      set({
        posDraft: { lines: q.items.map((i) => ({ productId: i.productId, qty: i.qty, unitId: i.unitId === 'base' ? undefined : i.unitId, price: i.unitPrice })), clientId: q.clientId, quoteId: q.id, discountPct: q.discountPct },
        page: 'venta',
      })
    },
  } satisfies Partial<Actions>
}
