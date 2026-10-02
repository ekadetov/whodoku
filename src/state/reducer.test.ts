import { describe, expect, it } from 'vitest'
import { newGame, reduce } from './reducer'

const start = () => newGame('2026-10-02', 1000)

describe('reduce', () => {
  it('selects and deselects a suspect', () => {
    const selected = reduce(start(), { type: 'select', suspect: 2 })
    expect(selected.selected).toBe(2)
    expect(reduce(selected, { type: 'select', suspect: null }).selected).toBeNull()
  })

  it('places the selected suspect and clears the selection and any mark', () => {
    let state = reduce(start(), { type: 'toggleMark', pos: { r: 1, c: 1 } })
    state = reduce(state, { type: 'select', suspect: 0 })
    state = reduce(state, { type: 'place', pos: { r: 1, c: 1 } })
    expect(state.progress.placements[0]).toEqual({ r: 1, c: 1 })
    expect(state.progress.marks).toEqual([])
    expect(state.selected).toBeNull()
  })

  it('moves an already placed suspect', () => {
    let state = reduce(start(), { type: 'select', suspect: 0 })
    state = reduce(state, { type: 'place', pos: { r: 0, c: 0 } })
    state = reduce(reduce(state, { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 2, c: 2 } })
    expect(state.progress.placements).toEqual({ 0: { r: 2, c: 2 } })
  })

  it('swaps with the occupant when the selected suspect was already placed', () => {
    let state = start()
    for (const [suspect, pos] of [[0, { r: 0, c: 0 }], [1, { r: 1, c: 1 }]] as const) {
      state = reduce(reduce(state, { type: 'select', suspect }), { type: 'place', pos })
    }
    state = reduce(reduce(state, { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 1, c: 1 } })
    expect(state.progress.placements).toEqual({ 0: { r: 1, c: 1 }, 1: { r: 0, c: 0 } })
  })

  it('unplaces the occupant when the selected suspect was not on the board', () => {
    let state = reduce(reduce(start(), { type: 'select', suspect: 1 }), { type: 'place', pos: { r: 3, c: 3 } })
    state = reduce(reduce(state, { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 3, c: 3 } })
    expect(state.progress.placements).toEqual({ 0: { r: 3, c: 3 } })
  })

  it('ignores place without a selection', () => {
    const state = reduce(start(), { type: 'place', pos: { r: 0, c: 0 } })
    expect(state.progress.placements).toEqual({})
  })

  it('removes a suspect', () => {
    let state = reduce(reduce(start(), { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 0, c: 0 } })
    state = reduce(state, { type: 'remove', suspect: 0 })
    expect(state.progress.placements).toEqual({})
  })

  it('toggles marks and strikes', () => {
    let state = reduce(start(), { type: 'toggleMark', pos: { r: 2, c: 3 } })
    expect(state.progress.marks).toEqual(['2,3'])
    state = reduce(state, { type: 'toggleMark', pos: { r: 2, c: 3 } })
    expect(state.progress.marks).toEqual([])
    state = reduce(state, { type: 'toggleStrike', suspect: 4 })
    expect(state.progress.struck).toEqual([4])
    expect(reduce(state, { type: 'toggleStrike', suspect: 4 }).progress.struck).toEqual([])
  })

  it('resets the board but keeps the start time', () => {
    let state = reduce(reduce(start(), { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 0, c: 0 } })
    state = reduce(state, { type: 'reset' })
    expect(state.progress.placements).toEqual({})
    expect(state.progress.startedAt).toBe(1000)
  })

  it('freezes the board once solved', () => {
    let state = reduce(start(), { type: 'solved', at: 5000 })
    expect(state.progress.solvedAt).toBe(5000)
    state = reduce(reduce(state, { type: 'select', suspect: 0 }), { type: 'place', pos: { r: 0, c: 0 } })
    expect(state.progress.placements).toEqual({})
    expect(reduce(state, { type: 'toggleMark', pos: { r: 0, c: 0 } }).progress.marks).toEqual([])
  })
})

describe('newGame', () => {
  it('records the puzzle id it was started for', () => {
    expect(newGame('2026-10-02', 1000, 'abc').progress.puzzleId).toBe('abc')
  })
})

describe('tools and history', () => {
  const at = (r: number, c: number) => ({ r, c })
  const placed = (suspect: number, r: number, c: number, from = start()) =>
    reduce(reduce(from, { type: 'select', suspect }), { type: 'place', pos: at(r, c) })

  it('starts on the select tool with an empty history', () => {
    const state = start()
    expect(state.tool).toBe('select')
    expect(state.history).toEqual([])
  })

  it('switching to a stroke tool clears the selection, and picking a suspect switches back', () => {
    let state = reduce(start(), { type: 'select', suspect: 2 })
    state = reduce(state, { type: 'setTool', tool: 'x' })
    expect(state.tool).toBe('x')
    expect(state.selected).toBeNull()
    state = reduce(state, { type: 'select', suspect: 1 })
    expect(state.tool).toBe('select')
    expect(state.selected).toBe(1)
  })

  it('marks every painted cell except those holding a suspect', () => {
    const state = reduce(placed(0, 1, 1), { type: 'paint', cells: [at(1, 0), at(1, 1), at(1, 2), at(1, 0)], mode: 'mark' })
    expect(state.progress.marks).toEqual(['1,0', '1,2'])
  })

  it('unmarks painted cells and leaves other marks alone', () => {
    let state = reduce(start(), { type: 'paint', cells: [at(0, 0), at(0, 1), at(0, 2)], mode: 'mark' })
    state = reduce(state, { type: 'paint', cells: [at(0, 0), at(0, 2)], mode: 'unmark' })
    expect(state.progress.marks).toEqual(['0,1'])
  })

  it('erases marks and suspects on the painted cells', () => {
    let state = placed(0, 1, 1)
    state = placed(1, 2, 2, state)
    state = reduce(state, { type: 'paint', cells: [at(0, 3)], mode: 'mark' })
    state = reduce(state, { type: 'paint', cells: [at(0, 3), at(1, 1)], mode: 'erase' })
    expect(state.progress.marks).toEqual([])
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
    let state = placed(0, 0, 0)
    state = placed(0, 2, 2, state)
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
    for (let i = 0; i < 120; i++) state = reduce(state, { type: 'toggleMark', pos: at(0, i % 2) })
    expect(state.history).toHaveLength(100)
  })

  it('can undo a reset', () => {
    let state = placed(0, 0, 0)
    state = reduce(state, { type: 'reset' })
    expect(state.progress.placements).toEqual({})
    state = reduce(state, { type: 'undo' })
    expect(state.progress.placements).toEqual({ 0: at(0, 0) })
  })

  it('ignores painting, undo and tool changes once solved', () => {
    const solved = reduce(placed(0, 0, 0), { type: 'solved', at: 5000 })
    expect(reduce(solved, { type: 'paint', cells: [at(1, 1)], mode: 'mark' })).toEqual(solved)
    expect(reduce(solved, { type: 'undo' })).toEqual(solved)
    expect(reduce(solved, { type: 'setTool', tool: 'x' })).toEqual(solved)
  })
})
