import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

export function CustomizationScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.8, 0.88))
  const exit = smoothstep(normalize(progress, 0.9, 0.98))
  const opacity = clamp(enter * (1 - exit), 0, 1)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : 0.55, 0.12, 0.12]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 1000 }}>
        <div className="taggo-story__customization">
          <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(43,45,66,0.08)', borderRadius: 22, padding: '20px 22px', boxShadow: '0 18px 40px rgba(48,25,52,0.08)', transform: `translateX(${(1 - enter) * 1.4}rem)` }}>
            <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6D597A', fontWeight: 700 }}>Personnalisation</div>
            <h3 style={{ margin: '12px 0 10px', fontSize: 30, lineHeight: 1.08, color: '#2B2D42', fontWeight: 800 }}>Ton TAGGO, à ton image.</h3>
            <p style={{ margin: 0, color: '#301934', lineHeight: 1.6, fontSize: 16 }}>
              Chaque TAGGO est personnalisable : liens sociaux, contact, texte, destination et confidentialité.
            </p>

            <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
              {['Liens sociaux', 'Contact', 'Bio & texte', 'Destination', 'Confidentialité', 'Statistiques'].map((item) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', borderRadius: 12, background: '#F5E1DA' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#B56576', display: 'inline-block' }} />
                  <span style={{ color: '#301934', fontSize: 14 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(43,45,66,0.08)', borderRadius: 24, padding: 18, boxShadow: '0 18px 40px rgba(48,25,52,0.08)' }}>
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#6F2DA8,#4CC9F0)', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 700 }}>A</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#2B2D42' }}>Alex</div>
                  <div style={{ fontSize: 12, color: '#6D597A' }}>@alex</div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F5E1DA' }}><strong style={{ color: '#2B2D42' }}>Bio</strong> · Créatif. Paris. ☕</div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F5E1DA' }}><strong style={{ color: '#2B2D42' }}>Instagram</strong> · @alex.creative</div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F5E1DA' }}><strong style={{ color: '#2B2D42' }}>WhatsApp</strong> · +33 6 12 34 56 78</div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#F5E1DA' }}><strong style={{ color: '#2B2D42' }}>Site</strong> · alex-portfolio.fr</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Html>
  )
}
