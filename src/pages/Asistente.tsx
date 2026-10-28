import { useEffect, useRef, useState } from 'react'
import { Lock, SendHorizontal, Sparkles } from 'lucide-react'
import { useMe, useStore } from '../store'
import { SUGGESTIONS, answer, type Answer } from '../lib/assistant'
import { businesses } from '../data/seed'
import { Card, PageHeader, cx } from '../components/ui'
import { Simulated } from '../components/common'

interface Msg {
  from: 'user' | 'bot'
  text: string
  a?: Answer
}

export default function Asistente() {
  const me = useMe()!
  const biz = useStore((s) => s.businessId)
  const kind = businesses[biz].kind
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: 'bot', text: `Hola ${me.name.split(' ')[0]}. Preguntame sobre ventas, stock, clientes${kind === 'rental' ? ', reservas y equipos' : ''} de ${businesses[biz].name}. Solo leo datos: no modifico nada.` },
  ])
  const [q, setQ] = useState('')
  const [thinking, setThinking] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const suggestions = [...SUGGESTIONS[kind], ...(me.businessId === null ? SUGGESTIONS.admin : [])]

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, thinking])

  const ask = (text: string) => {
    if (!text.trim() || thinking) return
    setMsgs((m) => [...m, { from: 'user', text }])
    setQ('')
    setThinking(true)
    setTimeout(() => {
      const a = answer(text, useStore.getState(), me)
      setMsgs((m) => [...m, { from: 'bot', text: a.text, a }])
      setThinking(false)
    }, 650)
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader title="Asistente IA" tag="A4" subtitle="Consultas en lenguaje natural sobre el negocio. Acceso de solo lectura y con los mismos permisos de tu usuario." />
      <div className="mb-3 flex items-center gap-2 text-sm text-ink-300">
        Interpretación simulada con reglas locales; las respuestas usan los datos reales de la demo. <Simulated>Modelo de IA simulado</Simulated>
      </div>
      <Card className="flex min-h-[460px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.map((m, i) => (
            <div key={i} className={cx('flex', m.from === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[85%] rounded-2xl px-4 py-3 text-sm', m.from === 'user' ? 'bg-white text-ink-900' : 'bg-white/[0.06] text-ink-100 ring-1 ring-white/10')}>
                {m.from === 'bot' && (
                  <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-brand-200">
                    {m.a?.denied ? <Lock size={12} /> : <Sparkles size={12} />} Asistente
                  </div>
                )}
                <div>{m.text}</div>
                {m.a?.table && (
                  <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-white/10">
                    <table className="w-full text-xs">
                      <thead className="bg-white/[0.05] text-left text-ink-300">
                        <tr>
                          {m.a.table.headers.map((h) => (
                            <th key={h} className="px-3 py-2 font-semibold">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.a.table.rows.map((r, j) => (
                          <tr key={j} className="border-t border-white/10">
                            {r.map((c, k) => (
                              <td key={k} className={cx('px-3 py-1.5', k > 0 && 'tabular')}>
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {m.a?.how && <div className="mt-2 text-xs text-ink-400">Cómo lo calculé: {m.a.how}</div>}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex">
              <div className="flex gap-1 rounded-2xl bg-white/[0.06] px-4 py-3 ring-1 ring-white/10">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand-200" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={end} />
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)} className="min-h-11 rounded-full bg-white/[0.06] px-4 py-2 text-left text-sm font-medium text-ink-100 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white">
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              ask(q)
            }}
            className="flex gap-2"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Tu pregunta para el asistente"
              enterKeyHint="send"
              placeholder="Escribí tu pregunta…"
              className="glass h-12 min-w-0 flex-1 rounded-full border-0 px-5 text-base text-white outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-brand-200 sm:text-sm"
            />
            <button type="submit" disabled={!q.trim() || thinking} className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-900 shadow-glow transition disabled:opacity-40" aria-label="Enviar">
              <SendHorizontal size={18} aria-hidden />
            </button>
          </form>
        </div>
      </Card>
    </div>
  )
}
