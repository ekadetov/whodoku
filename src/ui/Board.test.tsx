// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { tiny } from '../engine/fixtures'
import type { PaintMode, ToolDef } from '../engine/plugin'
import type { Pos } from '../engine/types'
import { Board } from './Board'
import type { Highlight } from './highlight'

afterEach(cleanup)

const X: ToolDef = { id: 'x', label: 'Mark', paint: ({ marked }) => (marked ? 'unmark' : 'mark') }
const ERASER: ToolDef = { id: 'eraser', label: 'Eraser', paint: () => 'erase' }
const SELECT: ToolDef = { id: 'select', label: 'Select' }

// A 4 x 4 board drawn 400px wide at the origin: every cell is 100px, so cell (r, c) centers at (100c + 50, 100r + 50).
const center = (r: number, c: number) => ({ clientX: c * 100 + 50, clientY: r * 100 + 50 })

interface SetupOptions {
  tool?: ToolDef
  marks?: string[]
  placements?: Record<number, Pos>
  highlight?: Highlight
  selectedClue?: string | null
}

function setup(options: SetupOptions = {}) {
  const onStroke = vi.fn<(cells: Pos[], mode: PaintMode) => void>()
  const onCellClick = vi.fn<(pos: Pos) => void>()
  render(
    <Board
      puzzle={tiny}
      placements={options.placements ?? {}}
      marks={new Set(options.marks ?? [])}
      selected={null}
      conflicts={new Set()}
      tool={options.tool ?? X}
      highlight={options.highlight}
      selectedClue={options.selectedClue}
      onCellClick={onCellClick}
      onStroke={onStroke}
    />,
  )
  const grid = screen.getByRole('grid')
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
  const down = (r: number, c: number) => fireEvent.pointerDown(grid, { ...center(r, c), pointerId: 1, button: 0 })
  const move = (r: number, c: number) => fireEvent.pointerMove(grid, { ...center(r, c), pointerId: 1 })
  const up = (r: number, c: number) => fireEvent.pointerUp(grid, { ...center(r, c), pointerId: 1 })
  return { grid, onStroke, onCellClick, down, move, up }
}

describe('Board strokes', () => {
  it('marks every cell of a dragged row in one stroke', () => {
    const { onStroke, down, move, up } = setup()
    down(0, 0)
    move(0, 1)
    move(0, 2)
    move(0, 3)
    up(0, 3)
    expect(onStroke).toHaveBeenCalledTimes(1)
    expect(onStroke).toHaveBeenCalledWith(
      [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
        { r: 0, c: 3 },
      ],
      'mark',
    )
  })

  it('fills the cells a fast drag jumps over', () => {
    const { onStroke, down, move, up } = setup()
    down(0, 0)
    move(0, 3)
    up(0, 3)
    expect(onStroke.mock.calls[0][0]).toHaveLength(4)
  })

  it('removes marks when the stroke starts on a marked cell', () => {
    const { onStroke, down, move, up } = setup({ marks: ['0,1'] })
    down(0, 1)
    move(0, 2)
    up(0, 2)
    expect(onStroke).toHaveBeenCalledWith(
      [
        { r: 0, c: 1 },
        { r: 0, c: 2 },
      ],
      'unmark',
    )
  })

  it('skips blocked cells', () => {
    const { onStroke, down, move, up } = setup()
    down(1, 0)
    move(1, 3)
    up(1, 3)
    const cells = onStroke.mock.calls[0][0]
    expect(cells).toEqual([
      { r: 1, c: 0 },
      { r: 1, c: 2 },
      { r: 1, c: 3 },
    ])
  })

  it('erases with the eraser tool', () => {
    const { onStroke, down, up } = setup({ tool: ERASER })
    down(2, 3)
    up(2, 3)
    expect(onStroke).toHaveBeenCalledWith([{ r: 2, c: 3 }], 'erase')
  })

  it('discards a cancelled stroke', () => {
    const { grid, onStroke, down, move } = setup()
    down(0, 0)
    move(0, 2)
    fireEvent.pointerCancel(grid, { pointerId: 1 })
    expect(onStroke).not.toHaveBeenCalled()
  })

  it('previews the stroke before it is committed', () => {
    const { down, move } = setup()
    down(0, 0)
    move(0, 1)
    expect(screen.getByTestId('cell-0-1')).toHaveClass('stroke-mark')
    expect(screen.getByTestId('cell-0-2')).not.toHaveClass('stroke-mark')
  })

  it('does nothing on pointer drags with the select tool', () => {
    const { onStroke, down, move, up } = setup({ tool: SELECT })
    down(0, 0)
    move(0, 3)
    up(0, 3)
    expect(onStroke).not.toHaveBeenCalled()
  })
})

describe('Board clicks', () => {
  it('forwards a mouse click to onCellClick with the select tool', () => {
    const { onCellClick } = setup({ tool: SELECT })
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 1 })
    expect(onCellClick).toHaveBeenCalledWith({ r: 0, c: 1 })
  })

  it('applies a stroke tool to a single cell on a keyboard click', () => {
    const { onStroke, onCellClick } = setup()
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 0 })
    expect(onStroke).toHaveBeenCalledWith([{ r: 0, c: 1 }], 'mark')
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('ignores clicks on blocked cells', () => {
    const { onCellClick } = setup({ tool: SELECT })
    fireEvent.click(screen.getByTestId('cell-1-1'), { detail: 1 })
    expect(onCellClick).not.toHaveBeenCalled()
  })

  it('ignores the mouse click that follows a pointer stroke', () => {
    const { onStroke } = setup()
    fireEvent.click(screen.getByTestId('cell-0-1'), { detail: 1 })
    expect(onStroke).not.toHaveBeenCalled()
  })
})

describe('Board contents', () => {
  it('shows a portrait token and names the occupant', () => {
    setup({ placements: { 1: { r: 0, c: 1 } } })
    const cell = screen.getByTestId('cell-0-1')
    expect(cell).toHaveAttribute('data-occupant', '1')
    expect(cell).toHaveAccessibleName(/Bob/)
    expect(cell.querySelector('.token svg')).not.toBeNull()
  })

  it('shows a cross on marked empty cells only', () => {
    setup({ marks: ['0,2', '0,1'], placements: { 1: { r: 0, c: 1 } } })
    expect(screen.getByTestId('cell-0-2')).toHaveAttribute('data-marked', 'true')
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-marked')
  })

  it('draws a sprite on cells with objects and marks blocking ones as unavailable', () => {
    setup()
    expect(screen.getByTestId('cell-1-1').querySelector('svg.sprite')).not.toBeNull()
    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('cell-1-0')).not.toHaveAttribute('aria-disabled')
  })
})

describe('Board hints', () => {
  const hint = (cells: string[], rooms: number[] = [], suspects: number[] = []): Highlight => ({
    cells: new Set(cells),
    rooms: new Set(rooms),
    suspects: new Set(suspects),
  })

  it('fills the highlighted cells and nothing else', () => {
    setup({ tool: SELECT, highlight: hint(['1,0', '2,1']) })
    expect(screen.getByTestId('cell-1-0')).toHaveClass('hint')
    expect(screen.getByTestId('cell-2-1')).toHaveClass('hint')
    expect(screen.getByTestId('cell-0-0')).not.toHaveClass('hint')
  })

  it('rings a highlighted suspect token', () => {
    setup({ tool: SELECT, placements: { 1: { r: 0, c: 1 }, 2: { r: 2, c: 2 } }, highlight: hint([], [], [1]) })
    expect(screen.getByTestId('cell-0-1').querySelector('.token')).toHaveClass('linked')
    expect(screen.getByTestId('cell-2-2').querySelector('.token')).not.toHaveClass('linked')
  })

  it('frames a hovered cell and names its object', () => {
    setup({ tool: SELECT })
    fireEvent.pointerEnter(screen.getByTestId('cell-1-0'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-1-0')).toHaveClass('hovered')
    expect(screen.getByTestId('cell-1-0').querySelector('.tip')).toHaveTextContent('Chair')
    fireEvent.pointerLeave(screen.getByTestId('cell-1-0'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-1-0')).not.toHaveClass('hovered')
    expect(document.querySelector('.tip')).toBeNull()
  })

  it('names the room when the hovered cell holds no object', () => {
    setup({ tool: SELECT })
    fireEvent.pointerEnter(screen.getByTestId('cell-0-0'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-0-0').querySelector('.tip')).toHaveTextContent('Hall')
  })

  it('still frames a blocked cell so it can be styled as unavailable', () => {
    setup({ tool: SELECT })
    fireEvent.pointerEnter(screen.getByTestId('cell-1-1'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-1-1')).toHaveClass('hovered')
    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('cell-1-1').querySelector('.tip')).toHaveTextContent('Shelf')
  })

  it('repeats the selected suspect\'s clue in the tooltip', () => {
    setup({ tool: SELECT, selectedClue: 'Bob was sitting on a chair.' })
    fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('Bob was sitting on a chair.')
  })

  it('ignores touch pointers, which have no hover', () => {
    setup({ tool: SELECT })
    fireEvent.pointerEnter(screen.getByTestId('cell-1-0'), { pointerType: 'touch' })
    expect(screen.getByTestId('cell-1-0')).not.toHaveClass('hovered')
  })

  it('outlines the room of the hovered cell along its outer edges only', () => {
    setup({ tool: SELECT })
    fireEvent.pointerEnter(screen.getByTestId('cell-0-0'), { pointerType: 'mouse' })
    const corner = screen.getByTestId('cell-0-0')
    expect(corner).toHaveClass('outlined')
    const shadow = corner.style.getPropertyValue('--edge-shadow')
    expect(shadow).toContain('inset 0 4px 0 0')
    expect(shadow).toContain('inset 4px 0 0 0')
    expect(shadow).not.toContain('inset -4px')
    expect(shadow).not.toContain('inset 0 -4px')
    expect(screen.getByTestId('cell-3-3')).not.toHaveClass('outlined')
  })

  it('outlines the rooms a clue names, without hovering', () => {
    setup({ tool: SELECT, highlight: hint([], [3]) })
    expect(screen.getByTestId('cell-3-3')).toHaveClass('outlined')
    expect(screen.getByTestId('cell-0-0')).not.toHaveClass('outlined')
  })
})
