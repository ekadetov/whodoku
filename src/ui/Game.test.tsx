// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { lonely, pairs, tiny } from '../engine/fixtures'
import { loadState, STORAGE_KEY } from '../state/storage'
import { Game } from './Game'

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

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

const newUser = () => userEvent.setup()

function holdOn(r: number, c: number) {
  const cell = screen.getByTestId(`cell-${r}-${c}`)
  fireEvent.pointerDown(cell, { button: 0, pointerType: 'mouse' })
  act(() => void vi.advanceTimersByTime(700))
  fireEvent.pointerUp(cell)
}

async function place(user: ReturnType<typeof userEvent.setup>, suspect: number, r: number, c: number) {
  await user.click(screen.getByTestId(`suspect-${suspect}`))
  holdOn(r, c)
}

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

async function placeSolution(user: ReturnType<typeof userEvent.setup>) {
  for (const [i, pos] of pairs.entries()) await place(user, i, pos.r, pos.c)
}

// Ann is right; Bob, Cy and Di are not.
async function placeWrong(user: ReturnType<typeof userEvent.setup>) {
  for (const [i, pos] of lonely.entries()) await place(user, i, pos.r, pos.c)
}

const renderGame = (storage: Storage) =>
  render(<Game puzzle={tiny} dateKey="2026-10-02" storage={storage} now={() => 1_000_000} />)

describe('Game', () => {
  it('places a selected suspect on a cell', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })

  it('does not allow blocking cells', () => {
    renderGame(fakeStorage())
    expect(screen.getByTestId('cell-1-1')).toHaveAttribute('aria-disabled', 'true')
  })

  it('highlights suspects that end up sharing a row after a cross was erased', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    const grid = mockBoard()
    await place(user, 0, 0, 1)
    await user.click(screen.getByTestId('tool-eraser'))
    stroke(grid, [0, 3], [0, 3])
    await place(user, 1, 0, 3)
    expect(screen.getByTestId('cell-0-1')).toHaveClass('conflict')
    expect(screen.getByTestId('cell-0-3')).toHaveClass('conflict')
  })

  it('does nothing when an empty square is clicked and nobody is selected', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('cell-2-3'))
    expect(screen.getByTestId('cell-2-3')).not.toHaveAttribute('data-marked')
    expect(screen.getByTestId('cell-2-3')).not.toHaveAttribute('data-occupant')
  })

  it('asks for a complete board before checking', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('status')).toHaveTextContent('Place every suspect')
  })

  it('flags suspects whose clues fail', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    await place(user, 1, 1, 2)
    await place(user, 2, 2, 3)
    await place(user, 3, 3, 0)
    await user.click(screen.getByRole('button', { name: 'Hint' }))
    expect(screen.getByRole('status')).toHaveTextContent('contradict their clues')
    expect(screen.getByTestId('clue-1')).toHaveClass('failing')
  })

  it('restores progress from storage', async () => {
    const user = newUser()
    const storage = fakeStorage()
    const first = renderGame(storage)
    await place(user, 0, 0, 1)
    first.unmount()
    renderGame(storage)
    expect(screen.getByTestId('cell-0-1')).toHaveAttribute('data-occupant', '0')
  })

  it('discards saved progress that belongs to a different puzzle id', async () => {
    const user = newUser()
    const storage = fakeStorage()
    const first = render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="a" storage={storage} now={() => 1_000_000} />)
    await place(user, 0, 0, 1)
    first.unmount()
    render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="b" storage={storage} now={() => 1_000_000} />)
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
  })

  it('keeps submit disabled until every suspect is placed', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
    await placeSolution(user)
    expect(screen.getByRole('button', { name: /Submit/ })).toBeEnabled()
  })

  it('undoes the last placement', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    await place(user, 0, 0, 1)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
  })

  it('shows the rules on demand', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    expect(screen.queryByRole('region', { name: 'How to play' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'How to play' }))
    expect(screen.getByRole('region', { name: 'How to play' })).toBeInTheDocument()
  })
})

describe('Game tools', () => {
  it('crosses out a dragged row with the X tool and undoes it in one step', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    const grid = mockBoard()
    await user.click(screen.getByTestId('tool-x'))
    stroke(grid, [0, 0], [0, 3])
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).toHaveAttribute('data-marked', 'true')
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    for (const c of [0, 1, 2, 3]) expect(screen.getByTestId(`cell-0-${c}`)).not.toHaveAttribute('data-marked')
  })

  it('removes a suspect and a cross with the eraser', async () => {
    const user = newUser()
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

  it('goes back to leaving notes when a card is picked', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('tool-x'))
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByTestId('suspect-0'))
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'false')
    await user.click(screen.getByTestId('cell-0-1'))
    expect(screen.getByTestId('cell-0-1').querySelector('.note')).toHaveTextContent('A')
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

  it('clears everything at once when the eraser is held, without asking, and keeps the eraser selected', async () => {
    const user = newUser()
    const confirm = vi.spyOn(window, 'confirm')
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    await user.click(screen.getByTestId('suspect-1'))
    await user.click(screen.getByTestId('cell-2-3'))
    expect(screen.getByTestId('cell-2-3').querySelector('.note')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()

    fireEvent.pointerDown(screen.getByTestId('tool-eraser'))
    act(() => void vi.advanceTimersByTime(900))
    fireEvent.pointerUp(screen.getByTestId('tool-eraser'))
    fireEvent.click(screen.getByTestId('tool-eraser'))

    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByTestId('cell-0-1')).not.toHaveAttribute('data-occupant')
    expect(screen.getByTestId('cell-2-3').querySelector('.note')).toBeNull()
    expect(document.querySelector('[data-marked]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByTestId('tool-eraser')).toHaveAttribute('aria-pressed', 'true')
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
    const user = newUser()
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
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('suspect-1'))
    fireEvent.pointerEnter(screen.getByTestId('cell-2-3'), { pointerType: 'mouse' })
    expect(screen.getByTestId('cell-2-3').querySelector('.tip.clue')).toHaveTextContent('He was sitting on a chair.')
    expect(screen.getByTestId('cell-2-3').querySelector('.tip:not(.clue)')).toHaveTextContent('Garden')
  })

  it('lights another suspect\'s card, and their token, when a clue names them', async () => {
    const user = newUser()
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

describe('Game notes and placing', () => {
  const crossed = () => [...document.querySelectorAll('[data-marked]')].map((c) => c.getAttribute('data-testid')).sort()
  const notesAt = (r: number, c: number) => [...screen.getByTestId(`cell-${r}-${c}`).querySelectorAll('.note')].map((n) => n.textContent)

  it('leaves a note on a click and removes it on a second click', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('suspect-1'))
    await user.click(screen.getByTestId('cell-2-3'))
    expect(notesAt(2, 3)).toEqual(['B'])
    await user.click(screen.getByTestId('cell-2-3'))
    expect(notesAt(2, 3)).toEqual([])
  })

  it('lets several suspects leave notes in the same square', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    for (const suspect of [1, 3, 0]) {
      await user.click(screen.getByTestId(`suspect-${suspect}`))
      await user.click(screen.getByTestId('cell-2-3'))
    }
    expect(notesAt(2, 3)).toEqual(['B', 'D', 'A'])
  })

  it('does nothing for a hold when no card is selected', () => {
    renderGame(fakeStorage())
    holdOn(2, 3)
    expect(screen.getByTestId('cell-2-3')).not.toHaveAttribute('data-occupant')
    expect(crossed()).toEqual([])
  })

  it('places on a hold, crossing out the open squares of its row and column and clearing their notes', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await user.click(screen.getByTestId('suspect-0'))
    await user.click(screen.getByTestId('cell-2-2'))
    await place(user, 2, 2, 3)
    expect(screen.getByTestId('cell-2-3')).toHaveAttribute('data-occupant', '2')
    expect(crossed()).toEqual(['cell-0-3', 'cell-1-3', 'cell-2-1', 'cell-2-2', 'cell-3-3'])
    expect(notesAt(2, 2)).toEqual([])
    expect(screen.getByTestId('suspect-2').closest('li')).toHaveClass('placed')
  })

  it('takes neither a note nor a hold on a crossed-out square', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 2, 2, 3)
    await user.click(screen.getByTestId('suspect-0'))
    await user.click(screen.getByTestId('cell-2-2'))
    holdOn(2, 2)
    expect(notesAt(2, 2)).toEqual([])
    expect(screen.getByTestId('cell-2-2')).not.toHaveAttribute('data-occupant')
  })

  it('undoes a placement together with its crosses', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 2, 2, 3)
    await user.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByTestId('cell-2-3')).not.toHaveAttribute('data-occupant')
    expect(crossed()).toEqual([])
  })

  it('lets a placed suspect be selected again and moved, leaving the old crosses', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 2, 2, 3)
    const before = crossed()
    await place(user, 2, 3, 2)
    expect(screen.getByTestId('cell-3-2')).toHaveAttribute('data-occupant', '2')
    expect(screen.getByTestId('cell-2-3')).not.toHaveAttribute('data-occupant')
    for (const key of before) expect(crossed()).toContain(key)
  })

  it('does not light the board when a placed card is hovered', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await place(user, 1, 0, 1)
    fireEvent.pointerEnter(screen.getByTestId('suspect-1'), { pointerType: 'mouse' })
    expect(document.querySelectorAll('.cell.hint')).toHaveLength(0)
  })
})

describe('Game finishing', () => {
  const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: /Submit/ }))
  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('stamps a right arrangement, rings every token green, then names the killer and saves the streak', async () => {
    const user = newUser()
    const storage = fakeStorage()
    renderGame(storage)
    await placeSolution(user)
    await submit(user)

    expect(screen.getByText('CASE SOLVED')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('.token.right')).toHaveLength(4)

    advance(1500)
    const dialog = screen.getByRole('dialog', { name: 'Result' })
    expect(dialog).toHaveTextContent("You've found the murderer! Bob (B) killed Ann (A)!")
    expect(dialog).toHaveTextContent('Streak: 1')
    expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull()

    const saved = loadState(storage)
    expect(saved.streak).toEqual({ current: 1, best: 1, lastSolved: '2026-10-02' })
    expect(saved.history['2026-10-02'].solved).toBe(true)
  })

  it('rings the wrong tokens red and says how many were right', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await placeWrong(user)
    await submit(user)

    expect(screen.queryByText('CASE SOLVED')).toBeNull()
    expect(document.querySelectorAll('.token.right')).toHaveLength(1)
    expect(document.querySelectorAll('.token.wrong')).toHaveLength(3)
    expect(screen.getByRole('dialog')).toHaveTextContent(
      "You did not find everyone's position! 1 of 4 correct. The murderer escaped!",
    )
  })

  it('freezes the board after a miss', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await placeWrong(user)
    await submit(user)
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByTestId('suspect-0'))
    holdOn(3, 3)
    expect(screen.getByTestId('cell-3-3')).not.toHaveAttribute('data-occupant')
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
  })

  it('offers Play again after a miss and clears the board', async () => {
    const user = newUser()
    renderGame(fakeStorage())
    await placeWrong(user)
    await submit(user)
    await user.click(screen.getByRole('button', { name: 'Play again' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('[data-occupant]')).toHaveLength(0)
    expect(document.querySelectorAll('.token')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
  })

  it('shows the result again after a reload and keeps the board frozen', async () => {
    const user = newUser()
    const storage = fakeStorage()
    const first = renderGame(storage)
    await placeWrong(user)
    await submit(user)
    first.unmount()
    renderGame(storage)
    expect(screen.getByRole('dialog')).toHaveTextContent('1 of 4 correct')
    expect(document.querySelectorAll('.token.wrong')).toHaveLength(3)
  })
})

