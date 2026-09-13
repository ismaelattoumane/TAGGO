import { Navigate, useParams } from 'react-router-dom'

/**
 * Legacy compatibility redirect: /qr/:publicId -> /t/:tag
 * Keeps already-printed QR codes working after canonicalization.
 */
export function TagRedirectPage() {
  const { publicId } = useParams()
  if (!publicId) return <Navigate to="/404" replace />
  return <Navigate to={`/t/${publicId}`} replace />
}
