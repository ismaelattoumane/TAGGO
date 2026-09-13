import { Html } from '@react-three/drei'
import { clamp, normalize, smoothstep } from '../storyMath'

const steps = [
  {
    number: '01',
    title: 'Choisis ton TAGGO',
    description: 'Sélectionne ton T-shirt TAGGO. Chaque pièce possède un QR code unique.',
    icon: '✦',
  },
  {
    number: '02',
    title: 'Personnalise ton expérience',
    description: 'Ajoute tes réseaux sociaux, tes coordonnées, ta bio et les liens que tu souhaites partager.',
    icon: '◈',
  },
  {
    number: '03',
    title: 'Porte-le',
    description: 'Ton identité digitale t’accompagne partout : au quotidien, en soirée, en voyage ou en événement.',
    icon: '♛',
  },
  {
    number: '04',
    title: 'Fais scanner',
    description: 'Un scan suffit pour accéder à ton profil. Aucune application nécessaire.',
    icon: '◉',
  },
]

export function HowItWorksScene({ progress }: { progress: number }) {
  const enter = smoothstep(normalize(progress, 0.25, 0.33))
  const exit = smoothstep(normalize(progress, 0.38, 0.5))
  const opacity = clamp(enter * (1 - exit), 0, 1)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <Html
      position={[isMobile ? 0 : 0, 0.12, 0.2]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: 1100 }}>
        <div style={{ width: 'min(1100px, calc(100vw - 48px))' }}>
          <div style={{ marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6D597A', fontWeight: 700 }}>Comment ça marche</div>
            <h2 style={{ margin: '8px 0 0', color: '#2B2D42', fontSize: 32, lineHeight: 1.1 }}>Simple. Rapide. TAGGO.</h2>
          </div>
          <div className="taggo-story__cards">
          {steps.map((step, index) => (
            <article
              key={step.number}
              style={{
                background: 'rgba(255,255,255,0.72)',
                border: '1px solid rgba(43,45,66,0.08)',
                borderRadius: 20,
                padding: '18px 18px 16px',
                boxShadow: '0 16px 36px rgba(48,25,52,0.08)',
                transform: `translateX(${index % 2 === 0 ? -8 : 8}px)`,
                minHeight: 150,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6D597A', fontWeight: 700 }}>
                  {step.number}
                </span>
                <span aria-hidden="true" style={{ fontSize: 18, color: '#6F2DA8' }}>{step.icon}</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: 20, color: '#2B2D42', lineHeight: 1.2, fontWeight: 700 }}>{step.title}</h3>
              <p style={{ margin: 0, color: '#301934', lineHeight: 1.55, fontSize: 15 }}>{step.description}</p>
            </article>
          ))}
        </div>
      </div>
      </div>
    </Html>
  )
}
