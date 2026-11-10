import { useEffect, useState } from 'react'
import { generateQrPng } from '../features/qr/qrCode'

/** Miniature du vrai QR code d'un TAGGO (généré localement, aucun appel réseau). */
export function QrThumb({ publicId, size = 64 }: { publicId: string; size?: number }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    generateQrPng(publicId)
      .then((url) => { if (!cancelled) setSrc(url) })
      .catch(() => { if (!cancelled) setSrc('') })
    return () => { cancelled = true }
  }, [publicId])

  return (
    <span className="qr-thumb" style={{ width: size, height: size }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : null}
    </span>
  )
}
