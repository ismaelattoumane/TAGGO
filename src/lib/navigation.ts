const STACK_KEY = 'taggo:internal-history'

export function isInternalAppPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false

  const normalized = pathname.split('?')[0].split('#')[0]
  const routes = [
    /^\/$/,
    /^\/login$/,
    /^\/register$/,
    /^\/dashboard$/,
    /^\/dashboard\/settings$/,
    /^\/dashboard\/qr\/new$/,
    /^\/dashboard\/qr\/[^/]+$/,
    /^\/t\/[^/]+$/,
    /^\/qr\/[^/]+$/,
    /^\/404$/,
  ]

  return routes.some((pattern) => pattern.test(normalized))
}

function readInternalHistory(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.sessionStorage.getItem(STACK_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

function writeInternalHistory(stack: string[]): void {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-12)))
}

export function recordCurrentAppPath(pathname: string | null | undefined): void {
  if (typeof window === 'undefined' || !pathname) return

  const normalizedPath = pathname.split('?')[0].split('#')[0] || '/'
  if (!isInternalAppPath(normalizedPath)) return

  const stack = readInternalHistory()
  const last = stack.at(-1)
  if (last !== normalizedPath) {
    stack.push(normalizedPath)
    writeInternalHistory(stack)
  }
}

export function getSafeBackPath(defaultPath = '/dashboard'): string {
  if (typeof window === 'undefined') return defaultPath

  const currentPath = window.location.pathname || '/'
  const stack = readInternalHistory()
  const currentIndex = stack.lastIndexOf(currentPath)

  if (currentIndex > 0) {
    return stack[currentIndex - 1]
  }

  const referrer = document.referrer
  if (referrer) {
    try {
      const referrerUrl = new URL(referrer)
      const isSameOrigin = referrerUrl.origin === window.location.origin
      const isInternal = isSameOrigin && isInternalAppPath(referrerUrl.pathname)
      if (isInternal && referrerUrl.pathname !== currentPath) {
        return referrerUrl.pathname
      }
    } catch {
      // Ignore malformed referrers and fall back to the safe app route.
    }
  }

  return defaultPath
}

export function getSafeForwardPath(defaultPath = '/dashboard'): string {
  if (typeof window === 'undefined') return defaultPath

  const currentPath = window.location.pathname || '/'
  const stack = readInternalHistory()
  const currentIndex = stack.lastIndexOf(currentPath)

  if (currentIndex >= 0 && currentIndex < stack.length - 1) {
    return stack[currentIndex + 1]
  }

  return defaultPath
}

export function canGoForwardInApp(): boolean {
  if (typeof window === 'undefined') return false

  const currentPath = window.location.pathname || '/'
  const stack = readInternalHistory()
  const currentIndex = stack.lastIndexOf(currentPath)
  return currentIndex >= 0 && currentIndex < stack.length - 1
}

export function goBackSafely(navigate: (path: string, options?: { replace?: boolean }) => void, defaultPath = '/dashboard') {
  navigate(getSafeBackPath(defaultPath), { replace: true })
}

export function goForwardSafely(navigate: (path: string, options?: { replace?: boolean }) => void, defaultPath = '/dashboard') {
  const nextPath = getSafeForwardPath(defaultPath)
  if (nextPath === defaultPath && !canGoForwardInApp()) {
    return
  }
  navigate(nextPath, { replace: true })
}
