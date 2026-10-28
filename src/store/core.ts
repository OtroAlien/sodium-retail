// Sesión, usuarios y permisos (M3), controles de la demo y sincronización (M4).
import type { BusinessId, RemoteSale } from '../types'
import type { Actions, Data, GetState, Page, SetState } from './state'
import type { Helpers } from './helpers'
import { now } from './helpers'
import { businesses } from '../data/seed'
import { uid } from '../lib/format'
import { can } from '../lib/permissions'
import { sellableLots, stockOf } from './selectors'

/** pantalla con la que arranca cada rol según el rubro */
function homePage(role: string, businessId: BusinessId | null): Page {
  if (!businessId) return 'panel'
  const kind = businesses[businessId].kind
  if (role === 'cajero') return kind === 'rental' ? 'mostrador' : 'venta'
  return 'inicio'
}

export function coreSlice(set: SetState, get: GetState, h: Helpers, initial: () => Data) {
  return {
    login: (userId, pin) => {
      const u = get().users.find((x) => x.id === userId)
      if (!u) return 'Usuario inexistente'
      if (u.blocked) return 'Usuario bloqueado. Consultá con el administrador.' // M3-R2
      if (u.pin !== pin) return 'PIN incorrecto'
      set({ currentUserId: u.id, businessId: u.businessId ?? get().businessId, page: homePage(u.role, u.businessId) })
      h.audit('inicio de sesión', `${u.name} ingresó al sistema`)
      return null
    },
    logout: () => set({ currentUserId: null, posDraft: null, reservationDraft: null }),
    setBusiness: (b) => {
      const u = h.me()
      if (u?.businessId && u.businessId !== b) return // M3-R3: cada usuario opera solo su negocio
      const page = get().page
      // si la pantalla actual no existe en el rubro elegido, vuelve al inicio
      const kind = businesses[b].kind
      const rentalOnly: Page[] = ['mostrador', 'reservas', 'disponibilidad', 'equipos']
      const hardwareOnly: Page[] = ['presupuestos']
      const notRental: Page[] = ['compras', 'alertas']
      const invalid = (kind !== 'rental' && rentalOnly.includes(page)) || (kind !== 'hardware' && hardwareOnly.includes(page)) || (kind === 'rental' && notRental.includes(page)) || page === 'panel'
      set({ businessId: b, page: invalid ? 'inicio' : page, posDraft: null })
    },
    setPage: (page) => set({ page }),
    goTo: (b, page) => {
      get().setBusiness(b)
      set({ page })
    },
    setRealOnline: (v) => {
      set({ realOnline: v })
      if (h.isOnline()) get().syncNow()
    },
    setSimOffline: (v) => {
      set({ simOffline: v })
      h.log(v ? 'Se cortó la conexión. La caja sigue operando y guarda todo en el equipo.' : 'Volvió la conexión.', 'info')
      if (!v) setTimeout(() => get().syncNow(), 400)
    },
    setArcaDown: (v) => {
      set({ arcaDown: v })
      if (!v) get().retryPendingInvoices()
    },
    setExpiryWarnDays: (n) => set({ expiryWarnDays: Math.max(1, Math.min(60, n)) }),
    resetDemo: () =>
      set({ ...initial(), currentUserId: null, page: 'inicio', simOffline: false, arcaDown: false, lastSyncAt: null, posDraft: null, reservationDraft: null, focusClientId: null, toasts: [] }),

    changePin: (oldPin, newPin) => {
      const u = h.me()
      if (!u) return 'Sin sesión'
      if (u.pin !== oldPin) return 'El PIN actual no coincide'
      if (!/^\d{4}$/.test(newPin)) return 'El PIN nuevo debe tener 4 dígitos'
      set((s) => ({ users: s.users.map((x) => (x.id === u.id ? { ...x, pin: newPin } : x)) }))
      h.audit('usuarios', `${u.name} cambió su PIN`)
      h.enqueue('Cambio de PIN')
      h.notify('PIN actualizado.')
      return null
    },
    setOverride: (userId, perm, value) => {
      if (!can(h.me(), 'usuarios.gestionar')) return
      const u = get().users.find((x) => x.id === userId)!
      const overrides = { ...(u.overrides ?? {}) }
      if (value === null) delete overrides[perm]
      else overrides[perm] = value
      set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, overrides } : x)) }))
      h.audit('usuarios', `Permiso "${perm}" de ${u.name}: ${value === null ? 'según su rol' : value ? 'habilitado' : 'quitado'}`)
      h.enqueue(`Permisos de ${u.name}`)
      h.notify(`Permisos de ${u.name} actualizados.`)
    },
    toggleBlock: (userId) => {
      if (!can(h.me(), 'usuarios.gestionar') || userId === get().currentUserId) return
      const u = get().users.find((x) => x.id === userId)!
      set((s) => ({ users: s.users.map((x) => (x.id === userId ? { ...x, blocked: !x.blocked } : x)) }))
      h.audit('usuarios', `${u.blocked ? 'Desbloqueo' : 'Bloqueo'} de ${u.name}`, u.blocked ? 'Bloqueado' : 'Activo', u.blocked ? 'Activo' : 'Bloqueado')
      h.enqueue(`Usuario ${u.name}`)
      h.notify(`${u.name} ${u.blocked ? 'desbloqueado' : 'bloqueado'}.`)
    },
    addUser: (u) => {
      if (!can(h.me(), 'usuarios.gestionar')) return
      set((s) => ({ users: [...s.users, { ...u, id: uid('u-'), blocked: false }] }))
      h.audit('usuarios', `Alta de ${u.name} (${u.role})`)
      h.enqueue(`Alta de usuario ${u.name}`)
      h.notify(`Usuario ${u.name} creado.`)
    },

    setPosDraft: (posDraft) => set({ posDraft }),
    setReservationDraft: (reservationDraft) => set({ reservationDraft }),
    setFocusClient: (focusClientId) => set({ focusClientId }),
    notify: (text, tone = 'ok') => h.notify(text, tone),
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    sendMessage: (m) => {
      h.message(m)
      h.enqueue(`Mensaje a ${m.to}`)
      h.notify(`${m.channel} enviado a ${m.to.split(' · ')[0]} (simulado)`)
    },

    syncNow: async () => {
      if (!h.isOnline() || get().syncing) return
      if (!get().queue.length && !get().remoteSales.length) {
        get().retryPendingInvoices()
        return
      }
      set({ syncing: true })
      await new Promise((r) => setTimeout(r, 1400))
      if (!h.isOnline()) {
        set({ syncing: false })
        return
      }
      const ops = get().queue.length

      // M4-R3: las ventas de otras cajas se suman como movimientos, no pisan cantidades
      for (const rs of get().remoteSales) {
        const p = get().products.find((x) => x.id === rs.productId)!
        const before = stockOf(get().lots, p.id)
        let left = rs.qty
        for (const lot of sellableLots(get().lots, p.id)) {
          if (left <= 0) break
          const take = Math.min(lot.qty, left)
          h.changeLot(lot.id, -take)
          set((s) => ({
            movements: [{ id: uid('m-'), businessId: rs.businessId, productId: p.id, lotId: lot.id, delta: -take, type: 'otra-caja', reason: rs.register, at: rs.at, userId: 'sistema' }, ...s.movements],
          }))
          left -= take
        }
        if (left > 0) {
          const any = get().lots.find((l) => l.productId === p.id)
          if (any) h.changeLot(any.id, -left)
        }
        const after = stockOf(get().lots, p.id)
        h.log(`${p.name}: ${rs.register} vendió ${rs.qty} sin conexión. Stock conciliado sumando movimientos: ${before} → ${after}.${after < 0 ? ' Quedó negativo: requiere recuento.' : ''}`, 'conflicto')
      }
      set({ queue: [], remoteSales: [], syncing: false, lastSyncAt: now() })
      if (ops) h.log(`${ops > 1 ? `Se sincronizaron ${ops} operaciones` : 'Se sincronizó 1 operación'} con el servidor, sin duplicados.`, 'ok')
      get().retryPendingInvoices()
    },
    simulateRemoteSale: (productId, qty) => {
      const rs: RemoteSale = { id: uid('r-'), businessId: get().businessId, register: 'Caja 2', productId, qty, at: now() }
      set((s) => ({ remoteSales: [...s.remoteSales, rs] }))
      if (h.isOnline()) setTimeout(() => get().syncNow(), 300)
    },
  } satisfies Partial<Actions>
}
