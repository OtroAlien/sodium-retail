import { useState } from 'react'
import { Clock, Mail, MessageCircle, Play } from 'lucide-react'
import { useMe, useStore } from '../store'
import { AUTOMATIONS } from '../lib/automations'
import { dateTime } from '../lib/format'
import { businesses } from '../data/seed'
import { Badge, Button, Card, Empty, PageHeader, Toggle, cx } from '../components/ui'
import { SectionTitle, Simulated } from '../components/common'

export default function Automatizaciones() {
  const me = useMe()!
  const state = useStore()
  const biz = state.businessId
  const kind = businesses[biz].kind
  const [results, setResults] = useState<Record<string, string>>({})
  const [openMsg, setOpenMsg] = useState<string | null>(null)
  const rules = AUTOMATIONS.filter((a) => a.kinds.includes(kind) && (!a.global || me.businessId === null))
  const outbox = state.outbox.filter((m) => m.businessId === biz || (m.businessId === null && me.businessId === null))
  const runs = state.automationRuns.filter((r) => r.businessId === biz || r.businessId === null)

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Automatizaciones"
        subtitle="Tareas que el sistema hace solo: avisos a clientes, pedidos a proveedores, promociones y resúmenes. Probalas con “Ejecutar ahora” y mirá el resultado abajo."
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-300">
        En la demo se ejecutan a mano y los mensajes no salen del sistema. <Simulated>WhatsApp y email simulados</Simulated>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {rules.map((r) => {
          const on = state.automations[r.id] ?? false
          const last = runs.find((x) => x.ruleId === r.id)
          return (
            <Card key={r.id} className={cx('p-5 transition', !on && 'opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-white">
                    {r.title}
                    {r.global && <Badge tone="brand">todos los negocios</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-300">{r.description}</p>
                </div>
                <Toggle on={on} onChange={(v) => state.setAutomation(r.id, v)} label={`${r.title}: ${on ? 'activa' : 'pausada'}`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-300">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {r.schedule}
                </span>
                <span>·</span>
                <span>{r.output}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-ink-400">{last ? `Última ejecución: ${dateTime(last.at)}` : 'Sin ejecuciones en la demo'}</span>
                <Button size="sm" variant="secondary" onClick={() => setResults({ ...results, [r.id]: state.runAutomation(r.id) })}>
                  <Play size={13} /> Ejecutar ahora
                </Button>
              </div>
              {results[r.id] && <div className="mt-2 rounded-xl bg-emerald-400/12 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-300/25">{results[r.id]}</div>}
            </Card>
          )
        })}
      </div>

      <SectionTitle right={<Badge>{outbox.length}</Badge>}>Mensajes enviados</SectionTitle>
      <Card>
        {outbox.length === 0 ? (
          <Empty>Todavía no se envió nada. Ejecutá una automatización o una acción de Oportunidades.</Empty>
        ) : (
          outbox.slice(0, 60).map((m) => (
            <button key={m.id} onClick={() => setOpenMsg(openMsg === m.id ? null : m.id)} className="block w-full border-t border-white/10 px-5 py-3 text-left first:border-0 hover:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm">
                  {m.channel === 'WhatsApp' ? <MessageCircle size={15} className="text-emerald-300" /> : <Mail size={15} className="text-brand-200" />}
                  <span className="font-semibold text-white">{m.subject}</span>
                  <span className="text-ink-300">→ {m.to}</span>
                </span>
                <span className="text-xs text-ink-400">{dateTime(m.at)}</span>
              </div>
              <p className={cx('mt-1 whitespace-pre-line text-sm text-ink-200', openMsg !== m.id && 'line-clamp-1')}>{m.body}</p>
            </button>
          ))
        )}
      </Card>
    </div>
  )
}
