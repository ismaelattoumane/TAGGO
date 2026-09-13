import { getScenePhase, getShirtState, STORY_TIMELINE, type ShirtState } from './storyTimeline'
import './StoryDebugPanel.css'

type DebugScene = {
  label: string
  key: keyof typeof STORY_TIMELINE
}

const DEBUG_SCENES: DebugScene[] = [
  { label: 'HERO', key: 'hero' },
  { label: 'CONCEPT', key: 'concept' },
  { label: 'HOW', key: 'howItWorks' },
  { label: 'QR', key: 'qr' },
  { label: 'PROFILE', key: 'profile' },
  { label: 'CUSTOM', key: 'customization' },
  { label: 'DASHBOARD', key: 'dashboard' },
]

const DEBUG_STOPS = Array.from({ length: 11 }, (_, index) => index / 10)

type StoryDebugPanelProps = {
  progress: number
  forcedProgress: number | null
  onForceProgress: (value: number) => void
  onReset: () => void
}

function format(value: number): string {
  return value.toFixed(2)
}

function getCurrentScene(progress: number): string {
  const active = DEBUG_SCENES.find(({ key }) => {
    const phase = getScenePhase(progress, STORY_TIMELINE[key])
    return phase !== 'before' && phase !== 'after'
  })
  return active?.label ?? '—'
}

function ShirtDebugValues({ progress }: { progress: number }) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const shirt: ShirtState = getShirtState(progress, isMobile)

  return (
    <div className="taggo-story-debug__shirt">
      <div>Shirt:</div>
      <div>rotationY: {format(shirt.rotationY)}</div>
      <div>x: {format(shirt.x)}</div>
      <div>scale: {format(shirt.scale)}</div>
      <div>cameraZ: {format(shirt.cameraZ)}</div>
    </div>
  )
}

export function StoryDebugPanel({
  progress,
  forcedProgress,
  onForceProgress,
  onReset,
}: StoryDebugPanelProps) {
  const debugEnabled = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('storyDebug') === '1'

  if (!debugEnabled) return null

  return (
    <aside className="taggo-story-debug" aria-label="TAGGO Story Debug">
      <div className="taggo-story-debug__title">TAGGO STORY DEBUG</div>
      <div className="taggo-story-debug__progress">
        Progress: <strong>{format(progress)}</strong>
        {forcedProgress !== null ? <span className="taggo-story-debug__forced">FORCED</span> : null}
      </div>

      <div className="taggo-story-debug__current">Scene: {getCurrentScene(progress)}</div>
      <ShirtDebugValues progress={progress} />

      <div className="taggo-story-debug__scenes" aria-label="Story scenes">
        {DEBUG_SCENES.map(({ label, key }) => {
          const phase = getScenePhase(progress, STORY_TIMELINE[key])
          const isActive = phase !== 'before' && phase !== 'after'
          return (
            <div key={key} className={isActive ? 'taggo-story-debug__scene taggo-story-debug__scene--active' : 'taggo-story-debug__scene'}>
              <span>{label}</span>
              <span aria-label={isActive ? 'active' : 'inactive'}>{isActive ? '[ACTIVE]' : '[ ]'}</span>
            </div>
          )
        })}
      </div>

      <div className="taggo-story-debug__controls" aria-label="Force story progress">
        {DEBUG_STOPS.map((stop) => (
          <button
            key={stop}
            type="button"
            className={forcedProgress === stop ? 'taggo-story-debug__stop taggo-story-debug__stop--selected' : 'taggo-story-debug__stop'}
            onClick={() => onForceProgress(stop)}
          >
            {stop * 100}%
          </button>
        ))}
      </div>

      <button type="button" className="taggo-story-debug__reset" onClick={onReset}>
        RESET
      </button>
    </aside>
  )
}
