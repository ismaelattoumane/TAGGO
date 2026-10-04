import { createContext } from 'react'
import type { CartLine } from '../features/shop/cart'

export type CartContextValue = {
  lines: CartLine[]
  itemCount: number
  /** `null` while an official price is not published. */
  subtotalCents: number | null
  isEmpty: boolean
  addItem: (productId: string, variantId: string, quantity?: number) => void
  setQuantity: (lineId: string, quantity: number) => void
  removeItem: (lineId: string) => void
  clear: () => void
}

export const CartContext = createContext<CartContextValue | undefined>(undefined)