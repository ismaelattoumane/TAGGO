import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

type ButtonVariant = 'primary' | 'ghost' | 'link' | 'danger-ghost'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
  children: ReactNode
}

/**
 * TAGGO Button — normalizes the existing .primary-button / .ghost-button /
 * .link-button styles (Figma direction preserved) with full state support:
 * default, hover, focus-visible, active, disabled, loading.
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const className = [
    'taggo-button',
    `taggo-button--${variant}`,
    loading ? 'taggo-button--loading' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={className} disabled={disabled ?? loading} {...rest}>
      {children}
    </button>
  )
}
