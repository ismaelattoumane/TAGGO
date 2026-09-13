import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

export function ProfileScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.68, 0.78))
  const exit = smoothstep(normalize(progress, 0.8, 0.9))
  const opacity = clamp(enter * (1 - exit), 0, 1)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : -0.95, 0.16, 0.2]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 420 }}>
        <div
          style={{
            width: 310,
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 24,
            padding: '20px 18px 18px',
            boxShadow: '0 20px 50px rgba(48,25,52,0.12)',
            border: '1px solid rgba(43,45,66,0.08)',
            transform: `translateX(${(1 - enter) * 1.2}rem)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#6F2DA8,#4CC9F0)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>A</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#2B2D42' }}>@alex</div>
              <div style={{ color: '#6D597A', fontSize: 13 }}>Ton identité. Ton monde.</div>
            </div>
          </div>

          <div style={{ width: '100%', height: 2, background: 'linear-gradient(90deg,#6F2DA8,#4CC9F0)', borderRadius: 999, opacity: 0.7, marginBottom: 18 }} />

          <div style={{ display: 'grid', gap: 10 }}>
            <button type="button" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(43,45,66,0.08)', background: '#F5E1DA', color: '#2B2D42', textAlign: 'left', fontWeight: 600 }}>Instagram</button>
            <button type="button" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(43,45,66,0.08)', background: '#F5E1DA', color: '#2B2D42', textAlign: 'left', fontWeight: 600 }}>Snapchat</button>
            <button type="button" style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(43,45,66,0.08)', background: '#F5E1DA', color: '#2B2D42', textAlign: 'left', fontWeight: 600 }}>WhatsApp</button>
          </div>
        </div>
      </div>
    </Html>
  )
}
