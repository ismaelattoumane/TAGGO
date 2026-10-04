import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  addToCart,
  clearCart,
  countCartItems,
  getCartSubtotalCents,
  removeLine,
  resolveCartLines,
  setLineQuantity,
  type CartState,
} from '../features/shop/cart'
import { clearStoredCartState, readCartState, writeCartState } from '../features/shop/cartStorage'
import { CartContext } from './cartContextValue'

/**
 * TAGGO shop cart provider.
 *
 * The state is a set of references only; lines, prices and availability are
 * derived from the catalog, which stays the single source of truth.
 * The cart survives a page refresh through `localStorage` and never reserves a
 * TAGGO: it is not an order.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(() => readCartState())

  useEffect(() => {
    writeCartState(state)
  }, [state])

  const addItem = useCallback((productId: string, variantId: string, quantity = 1) => {
    setState((current) => addToCart(current, productId, variantId, quantity))
  }, [])

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    setState((current) => setLineQuantity(current, lineId, quantity))
  }, [])

  const removeItem = useCallback((lineId: string) => {
    setState((current) => removeLine(current, lineId))
  }, [])

  const clear = useCallback(() => {
    setState(clearCart())
    clearStoredCartState()
  }, [])

  const value = useMemo(() => {
    const lines = resolveCartLines(state)
    return {
      lines,
      itemCount: countCartItems(state),
      subtotalCents: getCartSubtotalCents(lines),
      isEmpty: lines.length === 0,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }
  }, [state, addItem, setQuantity, removeItem, clear])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (!context) {
    throw new Error('useCart must be used within CartProvider')
  }

  return context
}