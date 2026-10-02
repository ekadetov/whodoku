import { describe, expect, it } from 'vitest'
import { freshState, loadState, saveState, STORAGE_KEY } from './storage'
import type { SavedState } from './storage'

function fakeStorage(initial?: string) {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(STORAGE_KEY, initial)
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

describe('storage', () => {
  it('round-trips a saved state', () => {
    const storage = fakeStorage()
    const state: SavedState = {
      ...freshState(),
      history: { '2026-10-02': { solved: true, seconds: 95 } },
      streak: { current: 1, best: 1, lastSolved: '2026-10-02' },
    }
    saveState(storage, state)
    expect(loadState(storage)).toEqual(state)
  })

  it('starts fresh when nothing is stored', () => {
    expect(loadState(fakeStorage())).toEqual(freshState())
  })

  it('starts fresh on corrupt JSON', () => {
    expect(loadState(fakeStorage('{not json'))).toEqual(freshState())
  })

  it('starts fresh on an unknown version', () => {
    expect(loadState(fakeStorage(JSON.stringify({ v: 99 })))).toEqual(freshState())
  })

  it('tolerates missing storage', () => {
    expect(loadState(null)).toEqual(freshState())
    expect(() => saveState(null, freshState())).not.toThrow()
  })

  it('tolerates a storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadState(broken)).toEqual(freshState())
    expect(() => saveState(broken, freshState())).not.toThrow()
  })
})
