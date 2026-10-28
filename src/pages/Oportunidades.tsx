import { useMemo, useState } from 'react'
import { CalendarHeart, CheckCircle2, CircleDollarSign, FileSignature, HardHat, PackageOpen, Users, Combine } from 'lucide-react'
import { useStore } from '../store'
import { clientBalance } from '../store/selectors'
import { greet } from '../lib/greet'
import { money } from '../lib/format'
import { opportunities, type Opportunity } from '../lib/analytics'
import { businesses } from '../data/seed'
import { Badge, Button, Card, Empty, IconBubble, PageHeader } from '../components/ui'
import { Simulated } from '../components/common'

const icons: Record<Opportunity['kind'], typeof Users> = {
  clientes: Users,
  stock: PackageOpen,
  presupuestos: FileSignature,
  cobranza: CircleDollarSign,
  combo: Combine,
  temporada: CalendarHeart,
  upsell: HardHat,
}

export default function Oportunidades() {
  const state = useStore()
  const biz = state.businessId
  const list = useMemo(() => opportunities(state, biz), [state, biz])
  const [done, setDone] = useState<Record<string, string>>({})
  const total = list.reduce((a, o) => a + o.value, 0)

  const run = (o: Opportunity) => {
    const msg = (to: string, subject: string, body: string) => state.sendMessage({ businessId: biz, channel: 'WhatsApp', to, subject, body })
    const client = (id: string) => state.clients.find((c) => c.id === id)!
    let result = ''
    switch (o.action?.run) {
      case 'promo-vencimiento':
        result = `${state.setPromo(o.targets, 20, 4, 'oportunidad: liquidación por vencimiento')} productos con 20% off por 4 días. Ya se aplica en caja.`
        break
      case 'promo-lenta':
        result = `${state.setPromo(o.targets, 15, 7, 'oportunidad: stock inmovilizado')} productos con 15% off por 7 días.`
        break
      case 'cupon-inactivos':
        o.targets.forEach((id) => msg(`${client(id).name} · ${client(id).phone}`, 'Te extrañamos', `Hola ${greet(client(id))}, te dejamos un 10% de descuento en tu próxima compra en ${businesses[biz].name} con el código VOLVE10.`))
        result = `Se enviaron ${o.targets.length} cupones.`
        break
      case 'recordatorio-saldo':
        o.targets.forEach((id) => msg(`${client(id).name} · ${client(id).phone}`, 'Recordatorio de saldo', `Hola ${greet(client(id))}, tu cuenta corriente tiene un saldo de ${money(clientBalance(state.accounts, id))}. Podés abonar en el local o por transferencia. ¡Gracias!`))
        result = `Se enviaron ${o.targets.length} recordatorios de saldo.`
        break
      case 'seguimiento':
        o.targets.forEach((id) => state.followUpQuote(id))
        result = `Seguimiento enviado a ${o.targets.length} presupuestos.`
        break
      case 'preventa':
        o.targets.forEach((id) => msg(`${client(id).name} · ${client(id).phone}`, 'Preventa de temporada', `¡Hola ${greet(client(id))}! Reservá tu equipo para la próxima temporada con 10% off. Tenemos tus talles guardados.`))
        result = `Se invitó a ${o.targets.length} clientes a la preventa.`
        break
      case 'upsell-casco':
        o.targets.forEach((rid) => {
          const r = state.reservations.find((x) => x.id === rid)!
          const c = client(r.clientId)
          msg(`${c.name} · ${c.phone}`, `Casco para tu reserva #${r.number}`, `Hola ${greet(c)}, ¿sumamos casco a tu reserva #${r.number}? Son ${money(6000)} por día y lo dejamos listo con el resto del equipo.`)
        })
        result = `Se ofreció casco a ${o.targets.length} reservas.`
        break
    }
    setDone({ ...done, [o.id]: result })
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Oportunidades de venta" subtitle="El sistema cruza ventas, stock, clientes y reservas para detectar dinero que se puede recuperar o generar. Cada oportunidad tiene una acción concreta." />
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <div className="text-sm text-ink-300">Monto estimado en juego en {businesses[biz].name}</div>
          <div className="tabular text-glow text-3xl font-bold text-white">{money(total)}</div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-300">
          Los envíos son simulados y quedan en Automatizaciones › Mensajes. <Simulated />
        </div>
      </Card>
      {/* las acciones resueltas pueden sacar la oportunidad de la lista: el resultado queda a la vista */}
      {Object.entries(done)
        .filter(([id]) => !list.some((o) => o.id === id))
        .map(([id, text]) => (
          <div key={id} className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-400/12 px-4 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-300/25">
            <CheckCircle2 size={15} /> {text}
          </div>
        ))}
      {list.length === 0 ? (
        <Card>
          <Empty>No se detectaron oportunidades en este momento.</Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((o) => {
            const Icon = icons[o.kind]
            return (
              <Card key={o.id} className="p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <IconBubble>
                    <Icon size={18} />
                  </IconBubble>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-white">{o.title}</span>
                      <Badge tone="brand">{money(o.value)} en juego</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-300">{o.detail}</p>
                    {done[o.id] && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-emerald-200">
                        <CheckCircle2 size={15} /> {done[o.id]}
                      </div>
                    )}
                  </div>
                  {o.action && !done[o.id] && (
                    <Button size="sm" onClick={() => run(o)}>
                      {o.action.label}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
