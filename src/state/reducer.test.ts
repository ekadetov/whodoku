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
