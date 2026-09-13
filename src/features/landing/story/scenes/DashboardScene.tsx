import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

export function DashboardScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.91, 0.98))
  const opacity = clamp(enter, 0, 1)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : -0.3, 0.04, 0.2]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 600 }}>
        <div style={{ width: 460, background: 'rgba(255,255,255,0.82)', borderRadius: 28, padding: 20, boxShadow: '0 28px 60px rgba(48,25,52,0.12)', border: '1px solid rgba(43,45,66,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontWeight: 800, letterSpacing: '0.14em', color: '#2B2D42' }}>TAGGO</div>
            <span style={{ padding: '6px 10px', borderRadius: 999, background: '#D6A7B2', color: '#2B2D42', fontSize: 12, fontWeight: 700 }}>Premium</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginBottom: 18 }}>
            <div style={{ background: '#F5E1DA', borderRadius: 14, padding: '12px 10px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2B2D42' }}>127</div>
              <div style={{ color: '#6D597A', fontSize: 12 }}>Scans</div>
            </div>
            <div style={{ background: '#F5E1DA', borderRadius: 14, padding: '12px 10px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2B2D42' }}>89</div>
              <div style={{ color: '#6D597A', fontSize: 12 }}>Clicks</div>
            </div>
            <div style={{ background: '#F5E1DA', borderRadius: 14, padding: '12px 10px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#2B2D42' }}>Actif</div>
              <div style={{ color: '#6D597A', fontSize: 12 }}>Statut</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5E1DA', borderRadius: 12, padding: '12px 14px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#2B2D42' }}>TGG-8K9L2R7</div>
                <div style={{ color: '#6D597A', fontSize: 12 }}>taggo.fr/alex</div>
              </div>
              <span style={{ background: '#4CC9F0', color: '#0B1320', fontSize: 12, borderRadius: 999, padding: '4px 8px', fontWeight: 700 }}>Actif</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5E1DA', borderRadius: 12, padding: '12px 14px' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#2B2D42' }}>TGG-3M5N8P2</div>
                <div style={{ color: '#6D597A', fontSize: 12 }}>taggo.fr/event</div>
              </div>
              <span style={{ background: '#D6A7B2', color: '#2B2D42', fontSize: 12, borderRadius: 999, padding: '4px 8px', fontWeight: 700 }}>Brouillon</span>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.16em', color: '#6D597A', marginBottom: 10, fontWeight: 700 }}>Scans récents</div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ height: 10, borderRadius: 999, background: 'linear-gradient(90deg,#6F2DA8,#4CC9F0)', width: '88%' }} />
              <div style={{ height: 10, borderRadius: 999, background: 'linear-gradient(90deg,#B56576,#D6A7B2)', width: '72%' }} />
              <div style={{ height: 10, borderRadius: 999, background: 'linear-gradient(90deg,#F4C95D,#D6A7B2)', width: '58%' }} />
            </div>
          </div>
        </div>
      </div>
    </Html>
  )
}
