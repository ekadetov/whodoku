// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tiny } from '../engine/fixtures'
import type { Pos } from '../engine/types'
import { SuspectPanel } from './SuspectPanel'

afterEach(cleanup)

// The board is 400px wide at the origin, so cell (r, c) spans [100c, 100c + 100) x [100r, 100r + 100).
interface SetupOptions {
  placements?: Record<number, Pos>
  selected?: number | null
  struck?: number[]
  failing?: number[]
  linked?: number[]
}

function setup(options: SetupOptions = {}) {
  const board = document.createElement('div')
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
  const onSelect = vi.fn()
  const onToggleStrike = vi.fn()
  const onDrop = vi.fn()
  const onHover = vi.fn()
  render(
    <SuspectPanel
      puzzle={tiny}
      placements={options.placements ?? {}}
      selected={options.selected ?? null}
      struck={options.struck ?? []}
      failing={new Set(options.failing ?? [])}
      linked={new Set(options.linked ?? [])}
      boardRef={{ current: board }}
      onSelect={onSelect}
      onToggleStrike={onToggleStrike}
      onDrop={onDrop}
      onHover={onHover}
    />,
  )
  return { onSelect, onToggleStrike, onDrop, onHover }
}

const drag = (card: HTMLElement, to: { x: number; y: number }) => {
  fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
  fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
  fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
}

describe('SuspectPanel cards', () => {
  it('shows a portrait, the name and the clue for every suspect', () => {
    setup()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByTestId('suspect-1')).toHaveTextContent('Bob')
    expect(screen.getByTestId('suspect-1').querySelector('.portrait svg')).not.toBeNull()
    expect(screen.getByTestId('clue-1')).toHaveTextContent('Bob was sitting on a chair.')
    expect(screen.getByTestId('suspect-0')).toHaveTextContent('(victim)')
    expect(screen.getByTestId('clue-0')).toHaveTextContent('Ann was alone with the killer.')
  })

  it('selects a suspect on click and deselects on a second click', () => {
    const { onSelect } = setup()
    fireEvent.click(screen.getByTestId('suspect-2'))
    expect(onSelect).toHaveBeenLastCalledWith(2)
    cleanup()
    const again = setup({ selected: 2 })
    fireEvent.click(screen.getByTestId('suspect-2'))
    expect(again.onSelect).toHaveBeenLastCalledWith(null)
  })

  it('reflects selected, placed, struck and failing states', () => {
    setup({ selected: 1, placements: { 2: { r: 0, c: 0 } }, struck: [3], failing: [1] })
    expect(screen.getByTestId('suspect-1')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('suspect-2').closest('li')).toHaveClass('placed')
    expect(screen.getByTestId('clue-3')).toHaveClass('struck')
    expect(screen.getByTestId('clue-1')).toHaveClass('failing')
  })

  it('toggles the strike on a clue card', () => {
    const { onToggleStrike } = setup()
    fireEvent.click(screen.getByTestId('clue-2'))
    expect(onToggleStrike).toHaveBeenCalledWith(2)
  })
})

describe('SuspectPanel dragging', () => {
  it('drops a dragged suspect on the cell under the pointer without selecting it', () => {
    const { onDrop, onSelect } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 150, y: 250 })
    fireEvent.click(card)
    expect(onDrop).toHaveBeenCalledWith(1, { r: 2, c: 1 })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('shows a ghost portrait while dragging and removes it on release', () => {
    setup()
    const card = screen.getByTestId('suspect-1')
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 250, pointerId: 1 })
    expect(document.querySelector('.ghost')).not.toBeNull()
    fireEvent.pointerUp(window, { clientX: 150, clientY: 250, pointerId: 1 })
    expect(document.querySelector('.ghost')).toBeNull()
  })

  it('does nothing when released outside the board or on a blocked cell', () => {
    const { onDrop } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 700, y: 700 })
    drag(card, { x: 150, y: 150 })
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('treats a tiny movement as a click', () => {
    const { onDrop, onSelect } = setup()
    const card = screen.getByTestId('suspect-1')
    drag(card, { x: 8, y: 8 })
    fireEvent.click(card)
    expect(onDrop).not.toHaveBeenCalled()
    expect(onSelect).toHaveBeenCalledWith(1)
  })
})

describe('SuspectPanel hints', () => {
  it('bolds what a clue names but not the suspect it belongs to', () => {
    setup()
    const bold = (id: string) => [...screen.getByTestId(id).querySelectorAll('b')].map((b) => b.textContent)
    expect(bold('clue-1')).toEqual(['chair'])
    expect(bold('clue-0')).toEqual(['alone with the killer'])
  })

  it('explains relation words with the theme glossary', () => {
    setup()
    const term = screen.getByTestId('clue-0').querySelector('b.term')!
    expect(term).toHaveAttribute('data-tip', expect.stringContaining('only two people in the room'))
  })

  it('reports hover over any part of a card, and leaving it', () => {
    const { onHover } = setup()
    const card = screen.getByTestId('suspect-2').closest('li')!
    fireEvent.pointerEnter(screen.getByTestId('suspect-2').querySelector('.portrait')!, { pointerType: 'mouse' })
    expect(onHover).toHaveBeenLastCalledWith(2)
    fireEvent.pointerLeave(card, { pointerType: 'mouse' })
    expect(onHover).toHaveBeenLastCalledWith(null)
    fireEvent.pointerEnter(screen.getByTestId('clue-3'), { pointerType: 'mouse' })
    expect(onHover).toHaveBeenLastCalledWith(3)
  })

  it('reports keyboard focus inside a card', () => {
    const { onHover } = setup()
    fireEvent.focus(screen.getByTestId('clue-1'))
    expect(onHover).toHaveBeenLastCalledWith(1)
    fireEvent.blur(screen.getByTestId('clue-1'))
    expect(onHover).toHaveBeenLastCalledWith(null)
  })

  it('ignores touch pointers, which have no hover', () => {
    const { onHover } = setup()
    fireEvent.pointerEnter(screen.getByTestId('suspect-2'), { pointerType: 'touch' })
    expect(onHover).not.toHaveBeenCalled()
  })

  it('marks the selected card and cards named by the active clue', () => {
    setup({ selected: 2, linked: [3] })
    expect(screen.getByTestId('suspect-2').closest('li')).toHaveClass('selected')
    expect(screen.getByTestId('suspect-3').closest('li')).toHaveClass('linked')
    expect(screen.getByTestId('suspect-1').closest('li')).not.toHaveClass('selected')
  })
})
