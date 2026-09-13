import { useEffect, useRef, type MutableRefObject, type RefObject } from 'react'
import { clamp } from './storyTimeline'

export function useStoryProgress(stageRef: RefObject<HTMLElement | null>): MutableRefObject<number> {
  const progress = useRef(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      const stage = stageRef.current
      const viewportHeight = window.innerHeight || 1
      if (!stage) return
      const stageStart = stage.offsetTop
      const scrollDistance = stage.offsetHeight - viewportHeight
      progress.current = scrollDistance > 0
        ? clamp((window.scrollY - stageStart) / scrollDistance)
        : 0
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [stageRef])

  return progress
}
