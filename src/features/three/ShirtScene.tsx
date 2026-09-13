import { Canvas } from '@react-three/fiber'
import type { CSSProperties, RefObject } from 'react'
import { Suspense } from 'react'
import {
  heroDpr,
  isWebGlSupported,
  prefersReducedMotion,
} from './device'
import { ShirtModel } from './ShirtModel'
import type { ShirtModelProps } from './ShirtModel'
import './ShirtScene.css'

export type ShirtSceneProps = {
  className?: string
  style?: CSSProperties
  /** Camera on the Z axis — calibrated against the ~1.5-unit GLB height. */
  cameraDistance?: number
  fallbackLabel?: string
  /** Opacity of the canvas wrapper (0..1) — used for storytelling fade-out. */
  opacity?: number
  /** Model presentation props forwarded to ShirtModel. */
  model?: Pick<ShirtModelProps, 'src'>
  /**
   * Scroll progress ref (0..1). Read every frame by ShirtModel — never
   * triggers a re-render. Driven by a passive listener.
   */
  scrollProgress?: RefObject<number> | null
}

/**
 * TAGGO shirt hero canvas — transparent background.
 *
 * Integrity contract (Étape 4B-0):
 * - the GLB is never modified (geometry / UVs / texture preserved);
 * - the canvas requests an ALPHA buffer and a transparent CSS background,
 *   so no green (or any color) backdrop can leak into the render;
 * - falls back to a readable message when WebGL is unavailable;
 * - caps the pixel ratio (reduced further under prefers-reduced-motion);
 * - loading state is a discrete skeleton (not a technical error).
 */
export function ShirtScene({
  className,
  style,
  cameraDistance = 2.35,
  fallbackLabel = 'Modèle 3D indisponible sur cet appareil.',
  opacity,
  model,
  scrollProgress,
}: ShirtSceneProps) {
  const reduced = prefersReducedMotion()
  const dpr = heroDpr(
    typeof window !== 'undefined' ? window.devicePixelRatio : undefined,
    reduced,
  )
  const webgl = isWebGlSupported()

  const opacityStyle: CSSProperties =
    opacity !== undefined ? { opacity, transition: 'opacity 0.1s linear' } : {}

  if (!webgl) {
    return (
      <div className={className} style={{ ...style, ...opacityStyle }} aria-hidden="true">
        <div className="taggo-shirt-skeleton" role="presentation">
          <span className="taggo-shirt-skeleton__glow" />
        </div>
        <p role="status" className="taggo-shirt-fallback">
          {fallbackLabel}
        </p>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ ...style, ...opacityStyle }}
      role="img"
      aria-label="T-shirt TAGGO connecté en 3D"
    >
      <Canvas
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
        dpr={dpr}
        camera={{
          position: [0, 0.05, cameraDistance],
          fov: typeof window !== 'undefined' && window.innerWidth < 768 ? 38 : 35,
          near: 0.1,
          far: 100,
        }}
        orthographic={false}
        shadows={false}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[2.5, 3, 4]} intensity={1.15} />
        <directionalLight position={[-2.5, 1, 2]} intensity={0.45} />
        <directionalLight position={[0, -2, 1]} intensity={0.2} />
        <Suspense fallback={<ShirtSceneSkeleton />}>
          <ShirtModel {...model} scrollProgress={scrollProgress} />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** Discrete in-canvas loading state (three-space billboard, no technical text). */
function ShirtSceneSkeleton() {
  return (
    <mesh position={[0, 0, 0]}>
      <sphereGeometry args={[0.18, 16, 16]} />
      <meshBasicMaterial color="#d6a7b2" transparent opacity={0.5} />
    </mesh>
  )
}
