import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button/Button'
import { TextField, SelectField } from './Field/Field'
import { Card } from './Card/Card'
import { Badge } from './Badge/Badge'
import { Container, Section, Divider } from './Layout/Layout'
import { Loading, EmptyState } from './State/State'
import { Eyebrow } from './Typography/Typography'

describe('Design System TAGGO', () => {
  it('renders Button variants with states', () => {
    const { rerender } = render(<Button variant="primary">Créer</Button>)
    expect(screen.getByRole('button', { name: 'Créer' })).toHaveClass('taggo-button--primary')
    rerender(
      <Button variant="danger-ghost" loading>
        Supprimer
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Supprimer' })).toBeDisabled()
  })

  it('associates Field labels and exposes errors to screen readers', () => {
    render(
      <>
        <TextField id="ds-name" label="Nom" placeholder="Alex" />
        <SelectField id="ds-status" label="Statut" error="Requis">
          <option value="">Choisir</option>
        </SelectField>
      </>,
    )
    expect(screen.getByLabelText('Nom')).toHaveAttribute('id', 'ds-name')
    expect(screen.getByLabelText(/Statut/)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Requis')
  })

  it('renders Card, Badge, Layout, State and Typography primitives', () => {
    render(
      <Container size="sm">
        <Section spacing="md">
          <Eyebrow>Landing-ready</Eyebrow>
          <Card as="article">
            <Badge tone="active">active</Badge>
            <Loading label="Chargement DS" />
            <EmptyState title="Aucun QR" description="Créez le premier" />
            <Divider />
          </Card>
        </Section>
      </Container>,
    )
    expect(screen.getByText('Landing-ready')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getAllByRole('status').length).toBeGreaterThanOrEqual(1)
  })
})
