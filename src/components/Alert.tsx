import type { ReactNode } from 'react'
import './Alert.css'

type AlertType = 'success' | 'error' | 'info' | 'warning'

const alertTones: Record<AlertType, string> = {
  success: 'taggo-alert--success',
  error: 'taggo-alert--error',
  info: 'taggo-alert--info',
  warning: 'taggo-alert--warning',
}

/**
 * TAGGO Alert — mêmes couleurs Figma, rôles ARIA corrects, zéro style inline.
 */
export function Alert({ type, children }: { type: AlertType; children: ReactNode }) {
  const role = type === 'error' || type === 'warning' ? 'alert' : 'status'
  return (
    <div role={role} className={`taggo-alert ${alertTones[type]}`}>
      {children}
    </div>
  )
}

