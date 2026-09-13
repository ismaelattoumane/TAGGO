/**
 * Canonical TAGGO public tag code.
 *
 * Single canonical format used everywhere for public TAGGO codes:
 *   TGG-XXXXXXX
 * where X is one of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
 * (ambiguous characters I, O, 0, 1 excluded to stay readable on textile).
 *
 * The public route is `/t/:tag`.
 * The legacy route `/qr/:publicId` is kept as a compatibility redirect.
 */

const TAG_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TAG_SUFFIX_LENGTH = 7
export const TAG_PREFIX = 'TGG-'

function randomSuffix(length: number): string {
  // crypto.getRandomValues when available (browser), Math.random fallback (tests/SSR-safe).
  const globalCrypto = globalThis.crypto as Crypto | undefined
  if (globalCrypto?.getRandomValues) {
    const bytes = new Uint8Array(length)
    globalCrypto.getRandomValues(bytes)
    let out = ''
    for (let i = 0; i < length; i++) {
      out += TAG_ALPHABET[bytes[i] % TAG_ALPHABET.length]
    }
    return out
  }
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TAG_ALPHABET[Math.floor(Math.random() * TAG_ALPHABET.length)]
  }
  return out
}

export function buildTagCode(): string {
  return `${TAG_PREFIX}${randomSuffix(TAG_SUFFIX_LENGTH)}`
}

const TAG_CODE_RE = /^TGG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/

export function isValidTagCode(value: string): boolean {
  return TAG_CODE_RE.test(value.trim().toUpperCase())
}

export function normalizeTagCode(value: string): string {
  return value.trim().toUpperCase()
}
