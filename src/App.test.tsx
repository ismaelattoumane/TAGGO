import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders the app shell without crashing', async () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => {
      expect(screen.getByText(/taggo/i)).toBeInTheDocument()
    })
  })
})

