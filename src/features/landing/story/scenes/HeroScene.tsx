import { Html } from '@react-three/drei'
import { Hero } from '../../Hero'
import { clamp, normalize, smoothstep } from '../storyMath'

export function HeroScene({ progress }: { progress: number }) {
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false
  const enter = smoothstep(normalize(progress, 0, 0.15))
  const exit = smoothstep(normalize(progress, 0.12, 0.18))
  const opacity = clamp(1 - exit, 0, 1) * enter
  const x = isMobile ? 0 : -1.45
  const y = isMobile ? 0.72 : 0.2
  const z = 0.15

  return (
    <Html
      position={[x, y, z]}
      center
      style={{ opacity, pointerEvents: opacity > 0.05 ? 'auto' : 'none' }}
    >
      <div className="taggo-story__scene" style={{ width: isMobile ? 280 : 560 }}>
        <Hero />
      </div>
    </Html>
  )
}
