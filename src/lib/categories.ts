import { Apple, Baby, Beef, Candy, Cookie, CupSoda, Egg, Milk, Package, Popcorn, Sandwich, ShoppingBasket, SprayCan, Sparkles, Wheat, Wrench } from 'lucide-react'

// Ícono y color por categoría: ayudan a ubicar un producto de un vistazo en la caja
const map: Record<string, { icon: typeof Package; tone: string }> = {
  Bebidas: { icon: CupSoda, tone: 'bg-sky-50 text-sky-600' },
  Golosinas: { icon: Candy, tone: 'bg-pink-50 text-pink-600' },
  Snacks: { icon: Popcorn, tone: 'bg-orange-50 text-orange-600' },
  Almacén: { icon: Wheat, tone: 'bg-amber-50 text-amber-700' },
  Lácteos: { icon: Milk, tone: 'bg-indigo-50 text-indigo-600' },
  Panificados: { icon: Sandwich, tone: 'bg-yellow-50 text-yellow-700' },
  Frescos: { icon: Egg, tone: 'bg-orange-50 text-orange-600' },
  Fiambrería: { icon: Beef, tone: 'bg-rose-50 text-rose-600' },
  Verdulería: { icon: Apple, tone: 'bg-emerald-50 text-emerald-600' },
  Limpieza: { icon: SprayCan, tone: 'bg-cyan-50 text-cyan-700' },
  Perfumería: { icon: Sparkles, tone: 'bg-fuchsia-50 text-fuchsia-600' },
  Varios: { icon: Wrench, tone: 'bg-slate-100 text-slate-600' },
  Bebés: { icon: Baby, tone: 'bg-violet-50 text-violet-600' },
  Galletitas: { icon: Cookie, tone: 'bg-amber-50 text-amber-700' },
}

export const categoryStyle = (c: string) => map[c] ?? { icon: ShoppingBasket, tone: 'bg-brand-50 text-brand-600' }
