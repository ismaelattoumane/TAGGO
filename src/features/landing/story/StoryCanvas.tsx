import { useEffect, useRef, useState } from 'react'
import { StoryScene } from './StoryScene'
import { StoryDebugPanel } from './StoryDebugPanel'
import { useStoryProgress } from './useStoryProgress'
import './StoryCanvas.css'

export function StoryCanvas() {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const progressRef = useStoryProgress(stageRef)
  const [progress, setProgress] = useState(0)
  const [forcedProgress, setForcedProgress] = useState<number | null>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setProgress(progressRef.current)
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progressRef])

  const effectiveProgress = forcedProgress ?? progress

  return (
    <section ref={stageRef} className="taggo-story" aria-label="Storytelling TAGGO">
      <div className="taggo-story__sticky">
        <StoryScene progress={effectiveProgress} />
      </div>
      <StoryDebugPanel
        progress={effectiveProgress}
        forcedProgress={forcedProgress}
        onForceProgress={setForcedProgress}
        onReset={() => setForcedProgress(null)}
      />
    </section>
  )
}
