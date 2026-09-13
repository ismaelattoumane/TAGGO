import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { ShirtModel } from '../../three/ShirtModel'
import { HeroScene } from './scenes/HeroScene'
import { ConceptScene } from './scenes/ConceptScene'
import { HowItWorksScene } from './scenes/HowItWorksScene'
import { QrScene } from './scenes/QrScene'
import { ProfileScene } from './scenes/ProfileScene'
import { CustomizationScene } from './scenes/CustomizationScene'
import { DashboardScene } from './scenes/DashboardScene'

export function StoryScene({ progress }: { progress: number }) {
  return (
    <div className="taggo-story__canvas">
      <Canvas
        camera={{ position: [0, 0.12, 2.35], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[2, 2.5, 4]} intensity={1.1} />
        <directionalLight position={[-2, 1, 2]} intensity={0.5} />

        <Suspense fallback={null}>
          <ShirtModel scrollProgress={{ current: progress }} />
        </Suspense>

        <HeroScene progress={progress} />
        <ConceptScene progress={progress} />
        <HowItWorksScene progress={progress} />
        <QrScene progress={progress} />
        <ProfileScene progress={progress} />
        <CustomizationScene progress={progress} />
        <DashboardScene progress={progress} />
      </Canvas>
    </div>
  )
}
