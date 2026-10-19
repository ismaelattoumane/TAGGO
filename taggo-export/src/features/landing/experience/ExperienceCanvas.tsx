import { useEffect, useRef, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Vector3, type Group, type PerspectiveCamera } from 'three'
import { GLB_MODEL_URL, heroDpr } from '../../three/device'
import {
  QR_HALF_WIDTH,
  QR_LOCAL,
  getIdle,
  getMobileRotationY,
  getPose,
  getScan,
  getShift,
  isWideLayout,
} from './experienceTimeline'
import { applyScan } from './overlayDom'
import type { ScrollController } from './useScrollProgress'

useGLTF.preload(GLB_MODEL_URL)

const qrCenter = new Vector3()
const qrEdge = new Vector3()

type RigProps = {
  ctrl: ScrollController
  scanRef: RefObject<HTMLElement | null>
  reduced: boolean
  onReady?: () => void
}

/**
 * Pilote le T-shirt et la caméra depuis la timeline unique.
 * Rendu à la demande (frameloop="demand") : on ne redessine que si la progression change.
 */
function Rig({ ctrl, scanRef, reduced, onReady }: RigProps) {
  const group = useRef<Group>(null)
  const { scene } = useGLTF(GLB_MODEL_URL)
  const invalidate = useThree((state) => state.invalidate)
  const width = useThree((state) => state.size.width)
  const height = useThree((state) => state.size.height)

  useEffect(() => {
    onReady?.()
  }, [onReady])

  useEffect(() => ctrl.subscribe(() => invalidate()), [ctrl, invalidate])

  useEffect(() => {
    invalidate()
  }, [width, height, invalidate])

  useFrame(({ camera, clock }) => {
    const shirt = group.current
    if (!shirt) return
    const cam = camera as PerspectiveCamera
    const p = reduced ? 0 : ctrl.progress.current
    const wide = isWideLayout(width, height)
    const pose = getPose(p, width / Math.max(1, height))

    cam.position.set(pose.cam[0], pose.cam[1], pose.cam[2])
    cam.lookAt(pose.target[0], pose.target[1], pose.target[2])
    const shift = getShift(p, wide)
    cam.setViewOffset(width, height, -shift.x * width, -shift.y * height, width, height)
    cam.updateMatrixWorld(true)

    const idle = getIdle(p, reduced)
    const t = clock.elapsedTime * 1000
    shirt.rotation.y = (wide ? pose.rotY : getMobileRotationY(p)) + idle * Math.sin(t / 2600) * 0.4
    shirt.position.y = idle * Math.sin(t / 1100) * 0.025
    shirt.updateMatrixWorld(true)

    const scanEl = scanRef.current
    if (scanEl) {
      const state = getScan(p)
      if (reduced || state.opacity <= 0.01) {
        applyScan(scanEl, state, null)
      } else {
        qrCenter.set(QR_LOCAL[0], QR_LOCAL[1], QR_LOCAL[2])
        qrEdge.set(QR_LOCAL[0] + QR_HALF_WIDTH, QR_LOCAL[1], QR_LOCAL[2])
        shirt.localToWorld(qrCenter).project(cam)
        shirt.localToWorld(qrEdge).project(cam)
        applyScan(scanEl, state, {
          cx: ((qrCenter.x + 1) / 2) * width,
          cy: ((1 - qrCenter.y) / 2) * height,
          size: Math.abs(qrEdge.x - qrCenter.x) * width * 1.08,
        })
      }
    }
  })

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  )
}

type ExperienceCanvasProps = RigProps

export function ExperienceCanvas({ ctrl, scanRef, reduced, onReady }: ExperienceCanvasProps) {
  const narrow = typeof window !== 'undefined' && window.innerWidth < 700
  const dpr = Math.min(heroDpr(typeof window !== 'undefined' ? window.devicePixelRatio : undefined, reduced), narrow ? 1.5 : 2)
  return (
    <Canvas
      className="tg-xp__gl"
      style={{ position: 'absolute', inset: 0 }}
      frameloop="demand"
      flat
      dpr={dpr}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 35, near: 0.02, far: 50, position: [0.5, 0.35, 3.6] }}
      role="img"
      aria-label="T-shirt TAGGO en 3D : logo devant, QR code au dos"
    >
      <hemisphereLight color="#ffffff" groundColor="#4a4f7a" intensity={0.95} />
      <directionalLight color="#ffffff" intensity={0.9} position={[2, 3, 3]} />
      <directionalLight color="#f4c95d" intensity={0.35} position={[-3, 1, -3]} />
      <Rig ctrl={ctrl} scanRef={scanRef} reduced={reduced} onReady={onReady} />
    </Canvas>
  )
}
