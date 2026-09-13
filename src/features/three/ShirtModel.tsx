import { Gltf } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Group, Material, Mesh } from 'three'
import { GLB_MODEL_URL, prefersReducedMotion } from './device'
import { getShirtState } from '../landing/story/storyTimeline'

/**
 * 3D T-shirt model (GLB).
 *
 * Integrity contract (Étape 4B-0): the GLB is loaded as-is — geometry,
 * UVs, texture, logo, QR, seams untouched. Background is never rendered
 * by the model; the canvas is transparent.
 *
 * 4B-1 : très lente rotation automatique + léger flottement.
 * 4B-2 : le scroll contrôle la rotation Y (plage bornée). L'auto-rotation
 * devient un drift sinusoïdal borné (pas d'accumulation, pas de conflit).
 * 4C-1 : rotation étendue pour révéler le dos/QR, zoom caméra, et fade final
 * pour la transition vers le profil HTML.
 * 4C-2 : architecture globale — le Canvas accompagne toute la landing.
 * Le T-shirt est beaucoup plus grand (55-70% de la hauteur viewport).
 * Timeline ajustée pour le scroll global de la landing entière.
 * Le tout est désactivé sous `prefers-reduced-motion: reduce`.
 */

export type ShirtModelProps = {
  src?: string
  /**
   * Scroll progress through the landing (0..1), driven by a passive
   * scroll listener. Read every frame — never triggers a re-render.
   */
  scrollProgress?: RefObject<number> | null
}

export function ShirtModel({
  src = GLB_MODEL_URL,
  scrollProgress = null,
}: ShirtModelProps) {
  const groupRef = useRef<Group>(null)
  const reduced = prefersReducedMotion()
  const size = useThree((state) => state.size)
  const isMobile = size.width < 768
  const initialState = getShirtState(0, isMobile)

  useFrame(({ clock, camera }) => {
    const group = groupRef.current
    if (!group) return
    const state = getShirtState(scrollProgress?.current ?? 0, isMobile)
    const idleFloat = reduced ? 0 : Math.sin(clock.getElapsedTime() * 0.8) * 0.012
    group.position.set(state.x, state.y + idleFloat, state.z)
    group.rotation.set(state.rotationX, state.rotationY, state.rotationZ)
    group.scale.setScalar(state.scale)
    group.visible = state.opacity > 0
    group.traverse((object) => {
      const mesh = object as Mesh
      if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => {
        const surface = material as Material
        surface.transparent = state.opacity < 1
        surface.opacity = state.opacity
      })
    })
    camera.position.z = state.cameraZ
  })

  return (
    <group
      ref={groupRef}
      position={[initialState.x, initialState.y, initialState.z]}
      rotation={[initialState.rotationX, initialState.rotationY, initialState.rotationZ]}
      scale={initialState.scale}
    >
      <Gltf src={src} useDraco={false} useMeshOpt={false} />
    </group>
  )
}
