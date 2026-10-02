import { beforeAll, describe, expect, it } from 'vitest'
import { evaluate, renderClue } from '../engine/clues'
import { tiny } from '../engine/fixtures'
import type { Plugin, SpriteDef } from '../engine/plugin'
import { registry } from '../engine/registry'
import { countSolutions } from '../engine/solver'
import { generate } from './classic/generator'
import { classicTheme } from './classic/theme'

const SPRITE: SpriteDef = { shapes: [{ kind: 'rect', x: 10, y: 10, w: 80, h: 80, fill: '#444' }] }

const NOIR_ROOMS = ['Alley', 'Bar', 'Docks', 'Office', 'Casino', 'Hotel', 'Rooftop', 'Subway']
const NOIR_SUSPECTS = ['Sam', 'Vera', 'Lou', 'Mae', 'Hank', 'Dot', 'Ray', 'Ida']

const noir: Plugin = {
  id: 'noir',
  version: '1.0.0',
  requires: ['classic'],
  register(api) {
    api.addTheme({
      id: 'noir',
      rooms: NOIR_ROOMS,
      suspects: NOIR_SUSPECTS,
      glossary: classicTheme.glossary,
      objects: {
        chair: { label: 'Barstool', noun: 'a barstool', standingOn: 'perched on a barstool', sprite: SPRITE, weight: 0.1 },
        shelf: { label: 'Safe', noun: 'a safe', standingOn: 'on a safe', sprite: SPRITE, weight: 0.05 },
      },
    })
    api.addClueType({
      id: 'notInRow',
      scope: 'unary',
      evaluate: (clue, _puzzle, placement) => placement[clue.suspect].r !== clue.row,
      parts: (clue, puzzle) => [
        { kind: 'person', text: puzzle.suspects[clue.suspect].name, suspect: clue.suspect },
        { kind: 'text', text: ` avoided row ${Number(clue.row) + 1}.` },
      ],
    })
  },
}

beforeAll(() => registry.register(noir))

describe('extending the engine without touching the kernel', () => {
  it('generates a solvable puzzle from a second theme', () => {
    const puzzle = generate(4242, 'easy', 'noir')
    expect(puzzle.themeId).toBe('noir')
    expect(puzzle.rooms.every((room) => NOIR_ROOMS.includes(room))).toBe(true)
    expect(puzzle.suspects.every((suspect) => NOIR_SUSPECTS.includes(suspect.name))).toBe(true)
    expect(countSolutions(puzzle, 2)).toBe(1)
  })

  it('words clues with the theme nouns', () => {
    const puzzle = { ...tiny, themeId: 'noir' }
    expect(renderClue({ type: 'onObject', suspect: 1, kind: 'chair' }, puzzle)).toBe('Bob was perched on a barstool.')
  })

  it('lets a plugin add a clue type the solver understands', () => {
    const clue = { type: 'notInRow', suspect: 0, row: 3 }
    expect(evaluate(clue, tiny, [{ r: 0, c: 1 }, { r: 1, c: 0 }, { r: 2, c: 2 }, { r: 3, c: 3 }])).toBe(true)
    expect(countSolutions({ ...tiny, clues: [...tiny.clues, clue] }, 2)).toBe(1)
    expect(countSolutions({ ...tiny, clues: [...tiny.clues, { ...clue, suspect: 3, row: 3 }] }, 2)).toBe(0)
    expect(renderClue(clue, tiny)).toBe('Ann avoided row 4.')
  })
})
