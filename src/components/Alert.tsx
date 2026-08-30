import type { ReactNode } from 'react'

type AlertType = 'success' | 'error' | 'info' | 'warning'

const alertColors = {
  success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
  error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
  info: { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' },
  warning: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' },
}

export function Alert({ type, children }: { type: AlertType; children: ReactNode }) {
  const colors = alertColors[type]

  return (
    <div
      style={{
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        padding: '1rem',
        borderRadius: '4px',
        color: colors.text,
        marginBottom: '1rem',
      }}
    >
      {children}
    </div>
  )
}
