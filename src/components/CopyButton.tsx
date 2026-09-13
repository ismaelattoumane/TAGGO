import { useState } from 'react'

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      className="ghost-button"
      onClick={() => void handleCopy()}
      style={{ fontSize: '0.875rem' }}
      aria-live="polite"
    >
      {copied ? '✓ Copié!' : label}
    </button>
  )
}
