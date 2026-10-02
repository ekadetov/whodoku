// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { pairs, tiny } from '../engine/fixtures'
import { loadState, STORAGE_KEY } from '../state/storage'
import { Game } from './Game'

afterEach(cleanup)

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
    expect(screen.getByTestId('cell-0-1')).toHaveTextContent('A')
  })

  it('does not allow blocking cells', () => {
    renderGame(fakeStorage())
    expect(screen.getByTestId('cell-1-1')).toBeDisabled()
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
    expect(screen.getByTestId('cell-2-3')).toHaveTextContent('x')
  })

  it('asks for a complete board before checking', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status')).toHaveTextContent('Place every suspect')
  })

  it('flags suspects whose clues fail', async () => {
    const user = userEvent.setup()
    renderGame(fakeStorage())
    await place(user, 0, 0, 1)
    await place(user, 1, 1, 2)
    await place(user, 2, 2, 3)
    await place(user, 3, 3, 0)
    await user.click(screen.getByRole('button', { name: 'Check' }))
    expect(screen.getByRole('status')).toHaveTextContent('contradict their clues')
    expect(screen.getByTestId('clue-1')).toHaveClass('failing')
  })

  it('solves the puzzle through accusation, rejecting the wrong suspect first', async () => {
    const user = userEvent.setup()
    const storage = fakeStorage()
    renderGame(storage)
    await placeSolution(user)

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
    expect(screen.getByTestId('cell-0-1')).toHaveTextContent('A')
  })
})
