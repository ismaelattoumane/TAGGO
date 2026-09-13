import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

export function QrScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.46, 0.52))
  const focus = smoothstep(normalize(progress, 0.56, 0.7))
  const exit = smoothstep(normalize(progress, 0.62, 0.72))
  const opacity = clamp(enter * (1 - exit), 0, 1)
  const qrSize = 142
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : -0.82, 0.16, 0.3]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, transform: `translateX(${(1 - focus) * 0.4}rem)` }}>
          <div
            style={{
              width: qrSize,
              height: qrSize,
              background: 'rgba(255,255,255,0.9)',
              borderRadius: 22,
              boxShadow: '0 24px 60px rgba(48,25,52,0.12)',
              border: '1px solid rgba(43,45,66,0.08)',
              display: 'grid',
              placeItems: 'center',
              padding: 18,
              transform: `scale(${0.9 + focus * 0.22})`,
            }}
            aria-label="QR code démonstration"
          >
            <img
              src={`${import.meta.env.BASE_URL}qr-code.png`}
              alt="QR code TAGGO de démonstration"
              width={qrSize}
              height={qrSize}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div
            style={{
              width: 190,
              background: '#fff',
              borderRadius: 18,
              border: '1px solid rgba(43,45,66,0.08)',
              boxShadow: '0 18px 36px rgba(48,25,52,0.08)',
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6D597A', marginBottom: 8, fontWeight: 700 }}>
              Scan
            </div>
            <div style={{ fontSize: 22, color: '#2B2D42', fontWeight: 700, lineHeight: 1.2 }}>Profil TAGGO</div>
          </div>
        </div>
      </div>
    </Html>
  )
}
