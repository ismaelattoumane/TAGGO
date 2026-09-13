import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react'
import './Field.css'

type FieldProps = {
  id: string
  label: string
  error?: string
  hint?: string
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & FieldProps

/**
 * TAGGO TextField — label associé + états error/hint + invalid ARIA.
 * Reprend les styles .auth-form existants (préservés).
 */
export function TextField({ id, label, error, hint, ...rest }: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <label className="taggo-field" htmlFor={id}>
      <span className="taggo-field__label">{label}</span>
      <input
        id={id}
        className={`taggo-field__control${error ? ' taggo-field__control--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {error ? (
        <span id={`${id}-error`} role="alert" className="taggo-field__error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="taggo-field__hint">
          {hint}
        </span>
      ) : null}
    </label>
  )
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & FieldProps

export function SelectField({ id, label, error, hint, children, ...rest }: SelectFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <label className="taggo-field" htmlFor={id}>
      <span className="taggo-field__label">{label}</span>
      <select
        id={id}
        className={`taggo-field__control${error ? ' taggo-field__control--error' : ''}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <span id={`${id}-error`} role="alert" className="taggo-field__error">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="taggo-field__hint">
          {hint}
        </span>
      ) : null}
    </label>
  )
}
