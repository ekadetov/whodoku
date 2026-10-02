// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pairs, tiny } from '../engine/fixtures'
import { loadState, STORAGE_KEY } from '../state/storage'
import { Game } from './Game'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    raw: () => data.get(STORAGE_KEY),
  }
}

type Storage = ReturnType<typeof fakeStorage>

async function place(user: ReturnType<typeof userEvent.setup>, suspect: number, r: number, c: number) {
  await user.click(screen.getByTestId(`suspect-${suspect}`))
  await user.click(screen.getByTestId(`cell-${r}-${c}`))
}

async function placeSolution(user: ReturnType<typeof userEvent.setup>) {
  for (const [i, pos] of pairs.entries()) await place(user, i, pos.r, pos.c)
}

const renderGame = (storage: Storage) =>
  render(<Game puzzle={tiny} dateKey="2026-10-02" storage={storage} now={() => 1_000_000} />)

describe('Game', () => {
  it('places a selected suspect on a cell', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })

  it('does not allow blocking cells', () => {
    renderGame(fakeStorage())
    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
  })

  it('highlights suspects sharing a row', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    await place(user, 1, 0, 3)
    expect(screen.getByTestId('cell-0-1')).toHaveClass('conflict')
    expect(screen.getByTestId('cell-0-3')).toHaveClass('conflict')
  })

  it('marks an empty cell with an x when nobody is selected', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('cell-2-3'))
    expect(screen.getByTestId('cell-2-3')).toHaveAttribute('data-marked', 'true')
  })

  it('asks for a complete board before checking', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('status')).toHaveTextContent('Place every suspect')
  })

  it('flags suspects whose clues fail', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    await place(user, 1, 1, 2)
    await place(user, 2, 2, 3)
    await place(user, 3, 3, 0)
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('status')).toHaveTextContent('contradict their clues')
    expect(screen.getByTestId('clue-1')).toHaveClass('failing')
  })

  it('solves the puzzle through accusation, rejecting the wrong suspect first', async () => {
    const user = userEvent.setup()
    const storage = fakeStorage()
    renderGame(storage)
    await placeSolution(user)
    expect(screen.queryByTestId('accuse-1')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Submit/ }))

    await user.click(screen.getByTestId('accuse-2'))
    expect(screen.getByRole('status')).toHaveTextContent('Cy is innocent')

    await user.click(screen.getByTestId('accuse-1'))
    expect(screen.getByText('Case closed!')).toBeInTheDocument()
    expect(screen.getByText(/Bob did it/)).toBeInTheDocument()

    const saved = loadState(storage)
    expect(saved.streak).toEqual({ current: 1, best: 1, lastSolved: '2026-10-02' })
    expect(saved.history['2026-10-02'].solved).toBe(true)
  })

  it('restores progress from storage', async () => {
    const user = userEvent.setup()
    const storage = fakeStorage()
    const first = renderGame(storage)
    await place(user, 0, 0, 1)
    first.unmount()
    renderGame(storage)
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })

  it('discards saved progress that belongs to a different puzzle id', async () => {
    const user = userEvent.setup()
    const storage = fakeStorage()
    const first = render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="a" storage={storage} now={() => 1_000_000} />)
    await place(user, 0, 0, 1)
    first.unmount()
    render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="b" storage={storage} now={() => 1_000_000} />)
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
  })

  it('keeps submit disabled until every suspect is placed', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
    await placeSolution(user)
    expect(screen.getByRole('button', { name: /Submit/ })).toBeEnabled()
  })

  it('undoes the last placement', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    await place(user, 0, 0, 1)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
  })

  it('shows the rules on demand', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'How to play' }))
    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument()
  })
})

describe('Game tools', () => {
  // The board is 400px wide at the origin, so cell (r, c) centers at (100c + 50, 100r + 50).
  const mockBoard = () => {
    const grid = screen.getByRole('grid')
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 400, height: 400 } as DOMRect)
    return grid
  }
  const stroke = (grid: HTMLElement, from: [number, number], to: [number, number]) => {
    const at = ([r, c]: [number, number]) => ({ clientX: c * 100 + 50, clientY: r * 100 + 50, pointerId: 1 })
    fireEvent.pointerDown(grid, { ...at(from), button: 0 })
    fireEvent.pointerMove(grid, at(to))
    fireEvent.pointerUp(grid, at(to))
  }

  it('crosses out a dragged row with the X tool and undoes it in one step', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    const grid = mockBoard()
    await user.click(screen.getByTestId('tool-x'))
    stroke(grid, [0, 0], [0, 3])
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).toHaveAttribute('data-marked', 'true')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).not.toHaveAttribute('data-marked')
  })

  it('removes a suspect and a cross with the eraser', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    const grid = mockBoard()
    await place(user, 0, 0, 1)
    await user.click(screen.getByTestId('tool-x'))
    stroke(grid, [0, 3], [0, 3])
    await user.click(screen.getByTestId('tool-eraser'))
    stroke(grid, [0, 1], [0, 3])
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
    expect(screen.getByTestId('cell-0-3')).not.toHaveAttribute('data-marked')
  })

  it('goes back to placing suspects when a card is picked', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('tool-x'))
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByTestId('suspect-0'))
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByTestId('cell-0-1'))
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })

  it('places a suspect dragged from its card onto the board', () => {
    renderGame(fakeStorage())
    mockBoard()
    const card = screen.getByTestId('suspect-2')
    fireEvent.pointerDown(card, { clientX: 5, clientY: 5, pointerId: 1, button: 0 })
    fireEvent.pointerMove(window, { clientX: 350, clientY: 250, pointerId: 1 })
    fireEvent.pointerUp(window, { clientX: 350, clientY: 250, pointerId: 1 })
    expect(screen.getByTestId('cell-2-3')).toHaveAttribute('data-occupant', '2')
  })

  it('clears the board when the eraser is held and the player confirms', async () => {
    vi.useFakeTimers()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderGame(fakeStorage())
    fireEvent.click(screen.getByTestId('suspect-0'))
    fireEvent.click(screen.getByTestId('cell-0-1'))
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
    fireEvent.pointerDown(screen.getByTestId('tool-eraser'))
    act(() => vi.advanceTimersByTime(900))
    expect(confirm).toHaveBeenCalled()
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
  })

  it('keeps the board when the player declines to clear it', () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderGame(fakeStorage())
    fireEvent.click(screen.getByTestId('suspect-0'))
    fireEvent.click(screen.getByTestId('cell-0-1'))
    fireEvent.pointerDown(screen.getByTestId('tool-eraser'))
    act(() => vi.advanceTimersByTime(900))
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })
})

describe('Game hints', () => {
  const hovering = (id: string) => fireEvent.pointerEnter(screen.getByTestId(id), { pointerType: 'mouse' })
  const leaving = (id: string) => fireEvent.pointerLeave(screen.getByTestId(id).closest('li')!, { pointerType: 'mouse' })
  const hinted = () => [...document.querySelectorAll('.cell.hint')].map((cell) => cell.getAttribute('data-testid'))

  it('lights what a hovered card names and clears it on leave', () => {
    renderGame(fakeStorage())
    hovering('suspect-1')
    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
    leaving('suspect-1')
    expect(hinted()).toEqual([])
  })

  it('also reacts to the clue card and to keyboard focus', () => {
    renderGame(fakeStorage())
    hovering('clue-3')
    expect(hinted()).toEqual(['cell-3-3'])
    leaving('clue-3')
    fireEvent.focus(screen.getByTestId('suspect-1'))
    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
    fireEvent.blur(screen.getByTestId('suspect-1'))
    expect(hinted()).toEqual([])
  })

  it('keeps the selected card lit after the pointer leaves, and lets hover override it', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('suspect-1'))
    expect(screen.getByTestId('suspect-1').closest('li')).toHaveClass('selected')
    leaving('suspect-1')
    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
    hovering('suspect-3')
    expect(hinted()).toEqual(['cell-3-3'])
    leaving('suspect-3')
    expect(hinted().sort()).toEqual(['cell-1-0', 'cell-2-1'])
  })

  it('repeats the selected clue when hovering a board cell', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('suspect-1'))
    fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('Bob was sitting on a chair.')
    expect(screen.getByTestId('cell-2-3').querySelector('.tip:not(.clue)')).toHaveTextContent('Garden')
  })

  it('lights another suspect\'s card, and their token, when a clue names them', async () => {
    const user = userEvent.setup()
    const puzzle = { ...tiny, clues: [...tiny.clues, { type: 'northOf', suspect: 0, other: 1, delta: 1 }] }
    render(<Game puzzle={puzzle} dateKey="2026-10-02" storage={fakeStorage()} now={() => 1_000_000} />)
    await place(user, 1, 1, 0)
    hovering('suspect-0')
    expect(screen.getByTestId('suspect-1').closest('li')).toHaveClass('linked')
    expect(screen.getByTestId('cell-1-0').querySelector('.token')).toHaveClass('linked')
    leaving('suspect-0')
    expect(screen.getByTestId('suspect-1').closest('li')).not.toHaveClass('linked')
  })
})
