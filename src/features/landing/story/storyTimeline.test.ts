import { describe, expect, it } from 'vitest'
import { getSceneState, getShirtState, STORY_TIMELINE } from './storyTimeline'

describe('landing story timeline', () => {
  it('keeps the hero scene active before the concept transition', () => {
    const hero = getSceneState(0.1, STORY_TIMELINE.hero, 'left')
    expect(hero.opacity).toBeGreaterThan(0)
    expect(hero.x).toBeGreaterThan(-1.6)
  })

  it('keeps the shirt and camera aligned with the QR reveal', () => {
    const shirt = getShirtState(0.6, false)
    expect(shirt.rotationY).toBeGreaterThan(1)
    expect(shirt.cameraZ).toBeLessThan(2.35)
    expect(shirt.opacity).toBeGreaterThan(0)
  })
})
