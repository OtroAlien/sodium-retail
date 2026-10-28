import { Apple, Baby, Beef, Candy, Cookie, CupSoda, Egg, Milk, Package, Popcorn, Sandwich, ShoppingBasket, SprayCan, Sparkles, Wheat, Wrench } from 'lucide-react'

// Ícono y color por categoría: ayudan a ubicar un producto de un vistazo en la caja
const map: Record<string, { icon: typeof Package; tone: string }> = {
  Bebidas: { icon: CupSoda, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Golosinas: { icon: Candy, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Snacks: { icon: Popcorn, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Almacén: { icon: Wheat, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Lácteos: { icon: Milk, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Panificados: { icon: Sandwich, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Frescos: { icon: Egg, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Fiambrería: { icon: Beef, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Verdulería: { icon: Apple, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Limpieza: { icon: SprayCan, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Perfumería: { icon: Sparkles, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Varios: { icon: Wrench, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Bebés: { icon: Baby, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
  Galletitas: { icon: Cookie, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' },
}

export const categoryStyle = (c: string) => map[c] ?? { icon: ShoppingBasket, tone: 'bg-white/[0.07] text-brand-100 ring-1 ring-inset ring-white/10' }
