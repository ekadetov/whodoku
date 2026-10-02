// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResultDialog } from './ResultDialog'

afterEach(cleanup)

describe('ResultDialog', () => {
  it('shows the message and the detail in a labelled dialog', () => {
    render(<ResultDialog message="You found them!" detail="Solved in 12 s." onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Result' })
    expect(dialog).toHaveTextContent('You found them!')
    expect(dialog).toHaveTextContent('Solved in 12 s.')
  })

  it('closes from the button, the close icon and the Escape key', () => {
    const onClose = vi.fn()
    render(<ResultDialog message="Done" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('offers Play again only when asked to', () => {
    const { rerender } = render(<ResultDialog message="Missed" onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()
    const onPlayAgain = vi.fn()
    rerender(<ResultDialog message="Missed" onClose={() => {}} onPlayAgain={onPlayAgain} />)
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalled()
  })
})
