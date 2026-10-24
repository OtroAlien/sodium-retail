const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

export const money = (n: number) => ars.format(Math.round(n * 100) / 100)

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const date = (iso: string) =>
  new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

export const time = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export const uid = (prefix = '') => prefix + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export const todayISO = () => toISODate(new Date())

export const toISODate = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const addDays = (days: number, from = new Date()) => {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

/** días hasta la fecha (negativo = ya venció) */
export const daysUntil = (isoDate: string) => {
  const a = new Date(todayISO() + 'T00:00:00').getTime()
  const b = new Date(isoDate + 'T00:00:00').getTime()
  return Math.round((b - a) / 86400000)
}

export const pad = (n: number, len: number) => String(n).padStart(len, '0')

export const formatCuit = (c: string) => {
  const d = c.replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : c
}
