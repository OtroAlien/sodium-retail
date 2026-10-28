import type { Client } from '../types'

/** saludo de mensajes: nombre de pila para personas, nombre completo para empresas */
export const greet = (c: Pick<Client, 'name' | 'tags' | 'cuit'>) => (c.cuit || c.tags.includes('empresa') || c.tags.includes('institucional') ? c.name : c.name.split(' ')[0])
