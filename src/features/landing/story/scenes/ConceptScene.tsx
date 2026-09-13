import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

export function ConceptScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.12, 0.2))
  const exit = smoothstep(normalize(progress, 0.25, 0.3))
  const opacity = clamp(enter * (1 - exit), 0, 1)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : -1.25 + 0.9 * enter, 0.18, 0.12]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 500 }}>
        <section
          aria-label="Le concept TAGGO"
          style={{
            maxWidth: 500,
            width: 500,
            padding: '20px 22px',
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(43,45,66,0.08)',
            borderRadius: 22,
            boxShadow: '0 18px 40px rgba(48,25,52,0.08)',
          }}
        >
          <p style={{ letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: 12, color: '#6D597A', margin: 0, fontWeight: 700 }}>
            Le concept
          </p>
          <h2 style={{ margin: '12px 0 10px', fontSize: 30, lineHeight: 1.08, color: '#2B2D42', fontWeight: 800 }}>
            Ton identité, directement sur ton T-shirt.
          </h2>
          <p style={{ margin: 0, color: '#301934', lineHeight: 1.6, fontSize: 16 }}>
            TAGGO transforme ton T-shirt en point d'accès vers ton identité digitale.
            Un simple scan du QR code permet d'accéder à la page que tu as choisie.
          </p>
          <ul style={{ margin: '18px 0 0', paddingLeft: 18, color: '#2B2D42', lineHeight: 1.7, fontSize: 15 }}>
            <li>Un QR unique</li>
            <li>Une page personnalisable</li>
            <li>Une identité toujours à jour</li>
          </ul>
        </section>
      </div>
    </Html>
  )
}
