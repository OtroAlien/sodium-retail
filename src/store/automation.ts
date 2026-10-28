// Automatizaciones (simuladas): cada ejecución deja resultados visibles en el sistema.
import type { Actions, GetState, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { greet } from '../lib/greet'
import { addDays, date, daysUntil, money, todayISO, toISODate, uid } from '../lib/format'
import { AUTOMATIONS } from '../lib/automations'
import { BUSINESS_IDS, businesses } from '../data/seed'
import { lateDays, lateFeeFor } from '../lib/rental'
import { clientBalance, oldestDebtDays, stockOf } from './selectors'

export function automationSlice(set: SetState, get: GetState, h: Helpers) {
  const owner = () => get().users.find((u) => u.role === 'admin')!
  const phoneOf = (clientId: string) => {
    const c = get().clients.find((x) => x.id === clientId)
    return c ? `${c.name} · ${c.phone}` : 'Cliente'
  }

  const runners: Record<string, () => string> = {
    'resumen-diario': () => {
      const s = get()
      const today = todayISO()
      const lines = BUSINESS_IDS.map((b) => {
        const sales = s.sales.filter((x) => x.businessId === b && x.status === 'completada' && toISODate(new Date(x.at)) === today)
        const total = sales.reduce((a, x) => a + x.total, 0)
        return `${businesses[b].name}: ${money(total)} (${sales.length} ventas)`
      })
      const low = s.products.filter((p) => stockOf(s.lots, p.id) <= p.minStock).length
      const late = s.reservations.filter((r) => r.status === 'entregada' && r.to < today).length
      const pendingInv = s.invoices.filter((i) => i.status !== 'emitido').length
      h.message({
        businessId: null,
        channel: 'WhatsApp',
        to: `${owner().name} (dueño)`,
        subject: `Resumen del ${date(today)}`,
        body: `Buenas noches, ${owner().name.split(' ')[0]}. Resumen de hoy:\n${lines.join('\n')}\n\nAlertas: ${low} productos bajo mínimo · ${late} devoluciones atrasadas · ${pendingInv} comprobantes pendientes.`,
      })
      return 'Resumen enviado al dueño por WhatsApp.'
    },
    reposicion: () => {
      const n = get().generateReorders()
      return n ? `Se armaron ${n} órdenes de compra en borrador. Revisalas en Proveedores y compras.` : 'No hay productos bajo mínimo sin pedido en curso.'
    },
    vencimientos: () => {
      const s = get()
      const ids = new Set(s.products.filter((p) => p.businessId === s.businessId).map((p) => p.id))
      const targets = [...new Set(s.lots.filter((l) => ids.has(l.productId) && l.qty > 0 && l.expiry && daysUntil(l.expiry) >= 0 && daysUntil(l.expiry) <= 3).map((l) => l.productId))]
      if (!targets.length) return 'No hay lotes por vencer en los próximos 3 días.'
      const n = get().setPromo(targets, 20, 3, 'liquidación por vencimiento (automática)')
      return `${n} productos pasaron a 20% de descuento por 3 días. El precio promocional ya se aplica en caja.`
    },
    'cuentas-corrientes': () => {
      const s = get()
      const debtors = s.clients.filter((c) => c.businessId === s.businessId && clientBalance(s.accounts, c.id) > 0 && oldestDebtDays(s.accounts, c.id) >= 15)
      for (const c of debtors)
        h.message({
          businessId: c.businessId,
          channel: 'WhatsApp',
          to: `${c.name} · ${c.phone}`,
          subject: 'Recordatorio de saldo',
          body: `Hola ${greet(c)}, te recordamos que tu cuenta corriente tiene un saldo de ${money(clientBalance(s.accounts, c.id))}. Podés abonar en el local o por transferencia a ${businesses[c.businessId].transferAccounts[0]}. ¡Gracias!`,
        })
      return debtors.length ? `Se enviaron ${debtors.length} recordatorios de saldo.` : 'No hay clientes con saldo de más de 15 días.'
    },
    presupuestos: () => {
      const s = get()
      const open = s.quotes.filter((q) => q.businessId === s.businessId && q.status === 'abierto' && Date.now() - new Date(q.at).getTime() >= 3 * 86400000 && q.followUps === 0)
      for (const q of open) get().followUpQuote(q.id)
      return open.length ? `Seguimiento enviado a ${open.length} presupuestos abiertos.` : 'No hay presupuestos de 3 días o más sin seguimiento.'
    },
    inactivos: () => {
      const s = get()
      const limit = Date.now() - 30 * 86400000
      const inactive = s.clients.filter((c) => {
        if (c.businessId !== s.businessId) return false
        const last = s.sales.filter((x) => x.clientId === c.id).reduce((a, x) => Math.max(a, new Date(x.at).getTime()), 0)
        // sin compras en 30 días y cliente desde hace más de 30 días
        return last < limit && new Date(c.createdAt).getTime() < limit
      })
      for (const c of inactive)
        h.message({
          businessId: c.businessId,
          channel: 'WhatsApp',
          to: `${c.name} · ${c.phone}`,
          subject: 'Te extrañamos',
          body: `Hola ${greet(c)}, hace un tiempo que no te vemos por ${businesses[c.businessId].name}. Te dejamos un 10% de descuento en tu próxima compra con el código VOLVE10, válido por 15 días.`,
        })
      return inactive.length ? `Se enviaron ${inactive.length} cupones de reactivación.` : 'No hay clientes inactivos hace más de 30 días.'
    },
    'recordatorio-retiro': () => {
      const tomorrow = addDays(1)
      const list = get().reservations.filter((r) => r.status === 'reservada' && r.from === tomorrow)
      for (const r of list)
        h.message({
          businessId: 'alquiler',
          channel: 'WhatsApp',
          to: phoneOf(r.clientId),
          subject: `Retiro mañana · reserva #${r.number}`,
          body: `¡Hola! Mañana te esperamos para retirar tu equipo (reserva #${r.number}) de 8 a 10 h. Saldo: ${money(r.total - r.deposit)}. Depósito en garantía: ${money(r.guarantee)}. Reservado: ${r.lines.map((l) => `${l.qty}× ${l.type} ${l.size}`).join(', ')}.`,
        })
      return list.length ? `Se enviaron ${list.length} recordatorios de retiro para mañana.` : 'No hay retiros para mañana.'
    },
    'recordatorio-devolucion': () => {
      const today = todayISO()
      const list = get().reservations.filter((r) => r.status === 'entregada' && r.to <= today)
      for (const r of list) {
        const late = r.to < today
        h.message({
          businessId: 'alquiler',
          channel: 'WhatsApp',
          to: phoneOf(r.clientId),
          subject: late ? `Devolución atrasada · reserva #${r.number}` : `Devolución hoy · reserva #${r.number}`,
          body: late
            ? `Hola, la devolución de la reserva #${r.number} venció el ${date(r.to)}. Llevás ${lateDays(r.to, today)} día(s) de demora y el recargo acumulado es ${money(lateFeeFor(r, today))}. Por favor acercate hoy.`
            : `Hola, te recordamos que hoy hasta las 19 h es la devolución de tu reserva #${r.number}. ¡Esperamos que hayas disfrutado la nieve!`,
        })
      }
      return list.length ? `Se avisó a ${list.length} clientes (devoluciones de hoy y atrasadas).` : 'No hay devoluciones para hoy ni atrasadas.'
    },
    limpieza: () => {
      const today = todayISO()
      const old = get().rentalItems.filter((i) => i.state === 'limpieza' && i.stateSince < today)
      if (!old.length) return 'No hay prendas demoradas en limpieza.'
      const enc = get().users.find((u) => u.businessId === 'alquiler' && u.role === 'encargado')
      h.message({
        businessId: 'alquiler',
        channel: 'WhatsApp',
        to: `${enc?.name ?? 'Encargado'} (encargado)`,
        subject: 'Prendas demoradas en limpieza',
        body: `Hay ${old.length} prendas en limpieza desde hace más de un día: ${old.map((i) => `${i.code} (${i.type} ${i.size})`).join(', ')}. Si ya están listas, marcalas como disponibles.`,
      })
      return `Aviso enviado al encargado por ${old.length} prendas.`
    },
    'reactivacion-temporada': () => {
      const s = get()
      const upcoming = new Set(s.reservations.filter((r) => r.status === 'reservada').map((r) => r.clientId))
      const list = s.clients.filter((c) => c.businessId === 'alquiler' && c.tags.includes('temporada pasada') && !upcoming.has(c.id))
      for (const c of list)
        h.message({
          businessId: 'alquiler',
          channel: 'WhatsApp',
          to: `${c.name} · ${c.phone}`,
          subject: 'Preventa de temporada',
          body: `¡Hola ${greet(c)}! Se viene la temporada de nieve. Como cliente de la temporada pasada tenés 10% off reservando antes del 30/11. Ya tenemos tus talles guardados${c.sizes?.calzado ? ` (calzado ${c.sizes.calzado})` : ''}.`,
        })
      return list.length ? `Se invitó a ${list.length} clientes de la temporada pasada.` : 'No hay clientes de la temporada pasada sin reserva.'
    },
  }

  return {
    setAutomation: (id, enabled) => {
      set((s) => ({ automations: { ...s.automations, [id]: enabled } }))
      const def = AUTOMATIONS.find((a) => a.id === id)
      h.audit('automatización', `${def?.title ?? id}: ${enabled ? 'activada' : 'pausada'}`)
      h.enqueue(`Automatización ${def?.title ?? id}`)
      h.notify(`“${def?.title ?? id}” ${enabled ? 'activada' : 'pausada'}.`)
    },
    runAutomation: (id) => {
      const def = AUTOMATIONS.find((a) => a.id === id)
      const run = runners[id]
      if (!def || !run) return 'Automatización desconocida'
      const summary = run()
      set((s) => ({ automationRuns: [{ id: uid('ar-'), ruleId: id, businessId: def.global ? null : s.businessId, at: now(), summary }, ...s.automationRuns].slice(0, 100) }))
      h.audit('automatización', `${def.title} (ejecución manual): ${summary}`)
      return summary
    },
  } satisfies Partial<Actions>
}
