import { describe, expect, it } from 'vitest'
import type { Pos } from '../engine/types'
import { newGame, reduce } from './reducer'
import type { GameState } from './reducer'

const start = () => newGame('2026-10-02', 1000)
const at = (r: number, c: number): Pos => ({ r, c })

const select = (state: GameState, suspect: number) => reduce(state, { type: 'select', suspect })
const place = (state: GameState, suspect: number, pos: Pos, cross: Pos[] = []) =>
  reduce(select(state, suspect), { type: 'place', pos, cross })
const note = (state: GameState, suspect: number, pos: Pos) => reduce(state, { type: 'toggleNote', pos, suspect })

describe('selection and strikes', () => {
  it('selects and deselects a suspect', () => {
    const selected = select(start(), 2)
    expect(selected.selected).toBe(2)
    expect(reduce(selected, { type: 'select', suspect: null }).selected).toBeNull()
  })

  it('toggles struck clues', () => {
    const state = reduce(start(), { type: 'toggleStrike', suspect: 4 })
    expect(state.progress.struck).toEqual([4])
    expect(reduce(state, { type: 'toggleStrike', suspect: 4 }).progress.struck).toEqual([])
  })
})

describe('notes', () => {
  it('adds a suspect to a square and removes it on a second toggle', () => {
    let state = note(start(), 1, at(2, 3))
    expect(state.progress.notes).toEqual({ '2,3': [1] })
    state = note(state, 1, at(2, 3))
    expect(state.progress.notes).toEqual({})
  })

  it('lets several suspects share a square and one suspect use many', () => {
    let state = note(start(), 1, at(2, 3))
    state = note(state, 4, at(2, 3))
    state = note(state, 1, at(0, 0))
    expect(state.progress.notes).toEqual({ '2,3': [1, 4], '0,0': [1] })
  })

  it('ignores crossed-out and occupied squares', () => {
    let state = reduce(start(), { type: 'paint', cells: [at(1, 1)], mode: 'mark' })
    state = place(state, 0, at(2, 2))
    expect(note(state, 3, at(1, 1))).toEqual(state)
    expect(note(state, 3, at(2, 2))).toEqual(state)
  })

  it('is one undo step each', () => {
    let state = note(start(), 1, at(2, 3))
    state = note(state, 4, at(2, 3))
    state = reduce(state, { type: 'undo' })
    expect(state.progress.notes).toEqual({ '2,3': [1] })
  })

  it('does not record history when nothing changed', () => {
    const state = reduce(start(), { type: 'paint', cells: [at(1, 1)], mode: 'mark' })
    const before = state.history.length
    expect(note(state, 0, at(1, 1)).history).toHaveLength(before)
  })
})

describe('placing', () => {
  it('places the selected suspect and clears the selection', () => {
    const state = place(start(), 0, at(1, 1))
    expect(state.progress.placements[0]).toEqual(at(1, 1))
    expect(state.selected).toBeNull()
  })

  it('ignores place without a selection', () => {
    const state = reduce(start(), { type: 'place', pos: at(0, 0), cross: [] })
    expect(state.progress.placements).toEqual({})
  })

  it('crosses out the squares it is given, once, without touching occupied squares', () => {
    let state = place(start(), 1, at(3, 3))
    state = place(state, 0, at(0, 0), [at(0, 1), at(0, 3), at(3, 3)])
    expect(state.progress.marks).toEqual(['0,1', '0,3'])
  })

  it('removes the suspect\'s own notes everywhere and all notes in its square and the crossed squares', () => {
    let state = start()
    state = note(state, 0, at(5, 5))
    state = note(state, 2, at(1, 1))
    state = note(state, 0, at(1, 1))
    state = note(state, 3, at(0, 4))
    state = note(state, 3, at(4, 4))
    state = place(state, 0, at(1, 1), [at(0, 4)])
    expect(state.progress.notes).toEqual({ '4,4': [3] })
  })

  it('is a single undo step covering the placement, the crosses and the removed notes', () => {
    let state = note(start(), 2, at(0, 4))
    state = place(state, 0, at(1, 1), [at(0, 4)])
    state = reduce(state, { type: 'undo' })
    expect(state.progress.placements).toEqual({})
    expect(state.progress.marks).toEqual([])
    expect(state.progress.notes).toEqual({ '0,4': [2] })
  })

  it('refuses a crossed-out or occupied square', () => {
    let state = reduce(start(), { type: 'paint', cells: [at(2, 2)], mode: 'mark' })
    state = place(state, 0, at(0, 0))
    expect(place(state, 1, at(2, 2)).progress.placements).toEqual({ 0: at(0, 0) })
    expect(place(state, 1, at(0, 0)).progress.placements).toEqual({ 0: at(0, 0) })
  })

  it('moves an already placed suspect and leaves the old crosses in place', () => {
    let state = place(start(), 0, at(0, 0), [at(0, 1)])
    state = place(state, 0, at(2, 2))
    expect(state.progress.placements).toEqual({ 0: at(2, 2) })
    expect(state.progress.marks).toEqual(['0,1'])
  })
})

describe('newGame', () => {
  it('records the puzzle id it was started for', () => {
    expect(newGame('2026-10-02', 1000, 'abc').progress.puzzleId).toBe('abc')
  })

  it('starts empty on the select tool', () => {
    const state = start()
    expect(state.tool).toBe('select')
    expect(state.history).toEqual([])
    expect(state.progress.notes).toEqual({})
  })
})

describe('tools and history', () => {
  it('switching to a stroke tool clears the selection, and picking a suspect switches back', () => {
    let state = select(start(), 2)
    state = reduce(state, { type: 'setTool', tool: 'x' })
    expect(state.tool).toBe('x')
    expect(state.selected).toBeNull()
    state = select(state, 1)
    expect(state.tool).toBe('select')
    expect(state.selected).toBe(1)
  })

  it('marks every painted cell except those holding a suspect, and drops their notes', () => {
    let state = place(start(), 0, at(1, 1))
    state = note(state, 2, at(1, 0))
    state = reduce(state, { type: 'paint', cells: [at(1, 0), at(1, 1), at(1, 2), at(1, 0)], mode: 'mark' })
    expect(state.progress.marks).toEqual(['1,0', '1,2'])
    expect(state.progress.notes).toEqual({})
  })

  it('unmarks painted cells and leaves other marks alone', () => {
    let state = reduce(start(), { type: 'paint', cells: [at(0, 0), at(0, 1), at(0, 2)], mode: 'mark' })
    state = reduce(state, { type: 'paint', cells: [at(0, 0), at(0, 2)], mode: 'unmark' })
    expect(state.progress.marks).toEqual(['0,1'])
  })

  it('erases marks, notes and suspects on the painted cells', () => {
    let state = place(start(), 0, at(1, 1))
    state = place(state, 1, at(2, 2))
    state = reduce(state, { type: 'paint', cells: [at(0, 3)], mode: 'mark' })
    state = note(state, 4, at(3, 3))
    state = reduce(state, { type: 'paint', cells: [at(0, 3), at(1, 1), at(3, 3)], mode: 'erase' })
    expect(state.progress.marks).toEqual([])
    expect(state.progress.notes).toEqual({})
    expect(state.progress.placements).toEqual({ 1: at(2, 2) })
  })

  it('treats a whole stroke as one undo step', () => {
    let state = reduce(start(), { type: 'paint', cells: [at(0, 0), at(0, 1), at(0, 2)], mode: 'mark' })
    expect(state.history).toHaveLength(1)
    state = reduce(state, { type: 'undo' })
    expect(state.progress.marks).toEqual([])
    expect(state.history).toEqual([])
  })

  it('undoes a placement back to the previous one', () => {
    let state = place(start(), 0, at(0, 0))
    state = place(state, 0, at(2, 2))
    state = reduce(state, { type: 'undo' })
    expect(state.progress.placements).toEqual({ 0: at(0, 0) })
    expect(state.selected).toBeNull()
  })

  it('does not record history for a stroke that changes nothing', () => {
    const state = reduce(start(), { type: 'paint', cells: [at(0, 0)], mode: 'unmark' })
    expect(state.history).toEqual([])
    expect(reduce(state, { type: 'undo' })).toEqual(state)
  })

  it('keeps only the most recent 100 steps', () => {
    let state = start()
    for (let i = 0; i < 120; i++) state = note(state, 0, at(0, i % 2))
    expect(state.history).toHaveLength(100)
  })
})

describe('clearing', () => {
  it('wipes crosses, notes and suspects and empties the undo history, keeping the tool and start time', () => {
    let state = place(start(), 0, at(0, 0), [at(0, 1)])
    state = note(state, 2, at(3, 3))
    state = reduce(state, { type: 'setTool', tool: 'eraser' })
    state = reduce(state, { type: 'reset' })
    expect(state.progress.placements).toEqual({})
    expect(state.progress.marks).toEqual([])
    expect(state.progress.notes).toEqual({})
    expect(state.history).toEqual([])
    expect(state.tool).toBe('eraser')
    expect(state.progress.startedAt).toBe(1000)
  })
})

describe('finishing', () => {
  it('freezes the board once solved', () => {
    let state = reduce(start(), { type: 'solved', at: 5000 })
    expect(state.progress.solvedAt).toBe(5000)
    state = place(state, 0, at(0, 0))
    expect(state.progress.placements).toEqual({})
    expect(reduce(state, { type: 'toggleNote', pos: at(0, 0), suspect: 1 }).progress.notes).toEqual({})
    expect(reduce(state, { type: 'paint', cells: [at(1, 1)], mode: 'mark' })).toEqual(state)
    expect(reduce(state, { type: 'undo' })).toEqual(state)
    expect(reduce(state, { type: 'setTool', tool: 'x' })).toEqual(state)
  })

  it('freezes the board once failed, the same way', () => {
    let state = reduce(start(), { type: 'failed', at: 7000 })
    expect(state.progress.failedAt).toBe(7000)
    state = place(state, 0, at(0, 0))
    expect(state.progress.placements).toEqual({})
    expect(select(state, 1).selected).toBeNull()
  })

  it('restarts a finished game with an empty board, a new start time and the same ids', () => {
    let state = newGame('2026-10-02', 1000, 'abc')
    state = place(state, 0, at(0, 0))
    state = reduce(state, { type: 'failed', at: 7000 })
    state = reduce(state, { type: 'restart', now: 9000 })
    expect(state.progress).toMatchObject({ dateKey: '2026-10-02', puzzleId: 'abc', placements: {}, startedAt: 9000, solvedAt: null })
    expect(state.progress.failedAt ?? null).toBeNull()
    expect(state.history).toEqual([])
  })
})
