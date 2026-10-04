import { EMPTY_CART, sanitizeCartState, type CartState } from './cart'

/**
 * Cart persistence — localStorage only.
 *
 * The payload contains product ids, variant ids and quantities. No personal
 * data, no payment data and no price is ever written here: everything else is
 * resolved from the catalog on read.
 */

const CART_STORAGE_KEY = 'taggo:shop-cart:v1'

export function readCartState(): CartState {
  if (typeof window === 'undefined') return EMPTY_CART

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return EMPTY_CART
    return sanitizeCartState(JSON.parse(raw))
  } catch {
    return EMPTY_CART
  }
}

export function writeCartState(state: CartState): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable (private mode, quota): the cart stays in memory.
  }
}

export function clearStoredCartState(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(CART_STORAGE_KEY)
  } catch {
    // Nothing to do: storage is optional.
  }
}

export const CART_STORAGE_KEY_NAME = CART_STORAGE_KEY