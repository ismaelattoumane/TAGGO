export function getOriginForAuth(baseOrigin?: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return (baseOrigin ?? 'https://taggo-omega.vercel.app').replace(/\/+$/, '')
}

export function buildAuthRedirectUrl(pathname: string, baseOrigin?: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${getOriginForAuth(baseOrigin)}${normalizedPath}`
}
