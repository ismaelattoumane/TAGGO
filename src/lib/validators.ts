export function sanitizeText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value)
}

export function isValidDestinationUrl(value: string): boolean {
  if (!value) return false

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

export function buildPublicId(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)

  return Array.from(bytes)
    .map((byte) => byte.toString(36).toUpperCase())
    .join('')
    .slice(0, 12)
}
