export function buildPublicTaggoUrl(publicId: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  return `${origin}/t/${encodeURIComponent(publicId)}`
}