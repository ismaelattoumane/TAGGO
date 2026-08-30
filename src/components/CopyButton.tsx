import { useState } from 'react'

export function CopyButton({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      console.error('Failed to copy')
    }
  }

  return (
    <button
      type="button"
      className="ghost-button"
      onClick={handleCopy}
      style={{ fontSize: '0.875rem' }}
    >
      {copied ? '✓ Copié!' : label}
    </button>
  )
}
