# Plugin Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the engine into a small kernel plus a plugin registry, and move every current game concept (object kinds, clue types, the victim/killer rule, the default theme, tools, the daily puzzle source) into a built-in `classic` plugin, with no change in how the game plays.

**Architecture:** `src/engine/` stays the kernel: grid and cell types, the one-per-row-and-column rule, the solver, the RNG and a new registry (`plugin.ts`, `registry.ts`). `src/plugins/classic/` holds all genre content and is registered like any third-party plugin. The kernel, state and UI layers never import from `src/plugins/` (a test enforces it); only `main.tsx`, `App.tsx` and tests do.

**Tech Stack:** TypeScript 6, React 19, Vitest 5, Playwright, Vite 8. Spec: `docs/design/2026-10-02-plugin-architecture-spec.md`.

**Conventions for every task:**
- Run commands from the repo root. Baseline before starting: `npx vitest run` passes (115 tests).
- Commit messages are imperative and short, like the existing history. No Co-Authored-By trailers.
- Code comments only where the reason is non-obvious. ASCII only.
- Behavior-preserving, with two intended exceptions: generated puzzles change once (the clue candidate order is now per clue type, and the daily seed includes the plugin fingerprint), and saved progress from before this change is discarded once (Task 5).

**Known follow-up (not in this plan):** tool behavior and sprites move into the registry in the UI plan (`2026-10-02-ui-redesign-plan.md`). Multi-cell props are only validated here, not generated or rendered.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/engine/plugin.ts` (new) | Types for plugins and every extension point |
| `src/engine/registry.ts` (new) | `createRegistry`, the `registry` singleton, theme validation, fingerprint |
| `src/engine/types.ts` | Generic `Clue`, string `ObjectKind`, `isOccupiable` via the registry |
| `src/engine/clues.ts` | Kernel facade: `evaluate`, `renderClue`, `isLegalPlacement`, `rulesHold`, `answerOf`, `isSolved` |
| `src/engine/candidates.ts` | `objectKindsIn`, registry-driven `candidateClues` |
| `src/engine/solver.ts` | Same search, but clue scope, pruning and rules come from the registry |
| `src/plugins/index.ts` (new) | `registerBuiltins()` |
| `src/plugins/classic/index.ts` (new) | The `classic` plugin |
| `src/plugins/classic/objects.ts`, `theme.ts`, `clues.ts`, `victim.ts`, `tools.ts` (new) | Classic content |
| `src/plugins/classic/generator.ts`, `layout.ts`, `daily.ts` (moved from engine) | Theme-driven generation and the daily source |
| `src/engine/boundary.test.ts`, `src/plugins/extensibility.test.ts` (new) | Architecture guards |

---

### Task 0: Branch

- [ ] **Step 1: Create the branch and confirm the baseline**

```bash
git switch -c plugin-kernel
npx vitest run 2>&1 | tail -6
```

Expected: `Tests  115 passed (115)`.

---

### Task 1: Plugin contract and registry

**Files:**
- Create: `src/engine/plugin.ts`, `src/engine/registry.ts`
- Test: `src/engine/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/engine/registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Plugin, ThemeDef } from './plugin'
import { createRegistry } from './registry'

const theme = (overrides: Partial<ThemeDef> = {}): ThemeDef => ({
  id: 't',
  rooms: ['A', 'B'],
  suspects: ['X', 'Y'],
  objects: {
    seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
    wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0.1 },
  },
  ...overrides,
})

const base = (overrides: Partial<Plugin> = {}): Plugin => ({
  id: 'demo',
  version: '1.0.0',
  register(api) {
    api.addObjectKind({ id: 'seat', blocking: false })
    api.addObjectKind({ id: 'wall', blocking: true })
    api.addTheme(theme())
    api.addTool({ id: 'pen', label: 'Pen' })
  },
  ...overrides,
})

describe('registry', () => {
  it('exposes what a plugin registers', () => {
    const registry = createRegistry()
    registry.register(base())
    expect(registry.objectKind('wall').blocking).toBe(true)
    expect(registry.theme().id).toBe('t')
    expect(registry.theme('t').rooms).toEqual(['A', 'B'])
    expect(registry.tools().map((t) => t.id)).toEqual(['pen'])
    expect(registry.has('demo')).toBe(true)
  })

  it('throws a clear error for unknown ids', () => {
    const registry = createRegistry()
    expect(() => registry.objectKind('nope')).toThrow('Unknown object kind "nope"')
    expect(() => registry.theme()).toThrow('No theme registered')
  })

  it('rejects a duplicate plugin id', () => {
    const registry = createRegistry()
    registry.register(base())
    expect(() => registry.register(base())).toThrow('Duplicate plugin "demo"')
  })

  it('rejects a duplicate definition id across plugins', () => {
    const registry = createRegistry()
    registry.register(base())
    const other = base({
      id: 'other',
      register: (api) => api.addObjectKind({ id: 'seat', blocking: false }),
    })
    expect(() => registry.register(other)).toThrow('Duplicate object kind "seat" from plugin "other"')
  })

  it('rejects a missing dependency and accepts a satisfied one', () => {
    const registry = createRegistry()
    const needy = base({ id: 'needy', requires: ['demo'], register: () => {} })
    expect(() => registry.register(needy)).toThrow('requires "demo"')
    registry.register(base())
    registry.register(needy)
    expect(registry.has('needy')).toBe(true)
  })

  it('rejects bad plugin ids and versions', () => {
    const registry = createRegistry()
    expect(() => registry.register(base({ id: 'Bad Id' }))).toThrow('Invalid plugin id')
    expect(() => registry.register(base({ version: 'one' }))).toThrow('invalid version')
  })

  it('rejects an invalid clue scope and footprint', () => {
    const registry = createRegistry()
    const badScope = base({
      register: (api) =>
        api.addClueType({
          id: 'c',
          scope: 'weird' as never,
          evaluate: () => true,
          render: () => '',
        }),
    })
    expect(() => registry.register(badScope)).toThrow('invalid scope')
    const badFootprint = base({
      register: (api) => api.addObjectKind({ id: 'big', blocking: true, footprint: [{ r: 0, c: 0 }] }),
    })
    expect(() => registry.register(badFootprint)).toThrow('invalid footprint')
  })

  it('leaves the registry untouched when a plugin fails midway', () => {
    const registry = createRegistry()
    const broken = base({
      id: 'broken',
      register(api) {
        api.addObjectKind({ id: 'seat', blocking: false })
        api.addObjectKind({ id: 'seat', blocking: false })
      },
    })
    expect(() => registry.register(broken)).toThrow('Duplicate object kind')
    expect(registry.has('broken')).toBe(false)
    expect(() => registry.objectKind('seat')).toThrow('Unknown object kind')
  })

  it('fingerprints the registered plugins in a stable order', () => {
    const registry = createRegistry()
    registry.register(base({ id: 'zeta', register: () => {} }))
    registry.register(base({ id: 'alpha', version: '2.1.0', register: () => {} }))
    expect(registry.fingerprint()).toBe('alpha@2.1.0,zeta@1.0.0')
  })
})

describe('theme validation', () => {
  const withTheme = (overrides: Partial<ThemeDef>): Plugin =>
    base({
      register(api) {
        api.addObjectKind({ id: 'seat', blocking: false })
        api.addObjectKind({ id: 'wall', blocking: true })
        api.addTheme(theme(overrides))
      },
    })

  it('rejects duplicate or empty rooms and suspects', () => {
    expect(() => createRegistry().register(withTheme({ rooms: ['A', 'A'] }))).toThrow('rooms must be non-empty and unique')
    expect(() => createRegistry().register(withTheme({ suspects: [] }))).toThrow('suspects must be non-empty and unique')
  })

  it('rejects an object that is not a registered kind', () => {
    const objects = { ghost: { noun: 'a ghost', standingOn: 'on a ghost', glyph: 'g', weight: 0.1 } }
    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('"ghost" is not a registered object kind')
  })

  it('rejects an object without a noun or glyph', () => {
    const objects = {
      seat: { noun: '', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
      wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0.1 },
    }
    expect(() => createRegistry().register(withTheme({ objects }))).toThrow('needs a noun, standingOn and glyph')
  })

  it('needs both a blocking and an occupiable object that can spawn', () => {
    const onlySeat = { seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 } }
    expect(() => createRegistry().register(withTheme({ objects: onlySeat }))).toThrow('at least one blocking object')
    const wallNeverSpawns = {
      seat: { noun: 'a seat', standingOn: 'on a seat', glyph: 's', weight: 0.1 },
      wall: { noun: 'a wall', standingOn: 'on a wall', glyph: 'w', weight: 0 },
    }
    expect(() => createRegistry().register(withTheme({ objects: wallNeverSpawns }))).toThrow('at least one blocking object')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL, `Failed to resolve import "./registry"`.

- [ ] **Step 3: Write the contract**

Create `src/engine/plugin.ts`:

```ts
import type { Clue, Placement, Pos, Puzzle } from './types'

export type ClueScope = 'unary' | 'binary' | 'global'

export type PartialPlacement = (Pos | undefined)[]

export interface ObjectKindDef {
  id: string
  blocking: boolean
  footprint?: readonly Pos[]
}

export interface ThemeObject {
  noun: string
  standingOn: string
  glyph: string
  weight: number
}

export interface ThemeDef {
  id: string
  rooms: readonly string[]
  suspects: readonly string[]
  objects: Readonly<Record<string, ThemeObject>>
}

export interface ClueTypeDef {
  id: string
  scope: ClueScope
  evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean
  render(clue: Clue, puzzle: Puzzle, theme: ThemeDef): string
  candidates?(puzzle: Puzzle, placement: Placement, suspect: number): Clue[]
  prune?(clue: Clue, puzzle: Puzzle, assigned: PartialPlacement): boolean
  feasible?(clue: Clue, puzzle: Puzzle, assigned: PartialPlacement, reachableByRoom: number[]): boolean
}

export interface RuleDef {
  id: string
  check(puzzle: Puzzle, placement: Placement): boolean
  answer?(puzzle: Puzzle, placement: Placement): number | null
}

export interface ToolDef {
  id: string
  label: string
}

export interface PuzzleSourceDef {
  id: string
  get(dateKey: string): Puzzle
}

export interface PluginApi {
  addObjectKind(def: ObjectKindDef): void
  addClueType(def: ClueTypeDef): void
  addRule(def: RuleDef): void
  addTheme(def: ThemeDef): void
  addTool(def: ToolDef): void
  addPuzzleSource(def: PuzzleSourceDef): void
}

export interface Plugin {
  id: string
  version: string
  requires?: readonly string[]
  register(api: PluginApi): void
}
```

- [ ] **Step 4: Write the registry**

Registration is atomic: a plugin registers into a staged copy of the tables and the copy replaces the live tables only if the whole plugin (including theme validation) succeeds. The `registry` singleton is what the rest of the app uses; `createRegistry()` exists so tests can build isolated registries.

Create `src/engine/registry.ts`:

```ts
import type {
  ClueTypeDef,
  ObjectKindDef,
  Plugin,
  PluginApi,
  PuzzleSourceDef,
  RuleDef,
  ThemeDef,
  ToolDef,
} from './plugin'

const PLUGIN_ID = /^[a-z][a-z0-9-]*$/
const SEMVER = /^\d+\.\d+\.\d+$/
const SCOPES = ['unary', 'binary', 'global']

export interface Registry {
  register(plugin: Plugin): void
  has(pluginId: string): boolean
  fingerprint(): string
  objectKind(id: string): ObjectKindDef
  clueType(id: string): ClueTypeDef
  clueTypes(): ClueTypeDef[]
  rules(): RuleDef[]
  theme(id?: string): ThemeDef
  tools(): ToolDef[]
  puzzleSource(id: string): PuzzleSourceDef
}

interface Tables {
  objectKinds: Map<string, ObjectKindDef>
  clueTypes: Map<string, ClueTypeDef>
  rules: Map<string, RuleDef>
  themes: Map<string, ThemeDef>
  tools: Map<string, ToolDef>
  sources: Map<string, PuzzleSourceDef>
}

const emptyTables = (): Tables => ({
  objectKinds: new Map(),
  clueTypes: new Map(),
  rules: new Map(),
  themes: new Map(),
  tools: new Map(),
  sources: new Map(),
})

function lookup<T>(table: Map<string, T>, what: string, id: string): T {
  const found = table.get(id)
  if (!found) throw new Error(`Unknown ${what} "${id}"`)
  return found
}

export function validateTheme(theme: ThemeDef, kinds: ReadonlyMap<string, ObjectKindDef>): void {
  const fail = (reason: string): never => {
    throw new Error(`Invalid theme "${theme.id}": ${reason}`)
  }
  if (theme.rooms.length === 0 || new Set(theme.rooms).size !== theme.rooms.length) {
    fail('rooms must be non-empty and unique')
  }
  if (theme.suspects.length === 0 || new Set(theme.suspects).size !== theme.suspects.length) {
    fail('suspects must be non-empty and unique')
  }
  const entries = Object.entries(theme.objects)
  for (const [id, object] of entries) {
    if (!kinds.has(id)) fail(`object "${id}" is not a registered object kind`)
    if (!object.noun || !object.standingOn || !object.glyph) fail(`object "${id}" needs a noun, standingOn and glyph`)
  }
  const spawning = entries.filter(([, object]) => object.weight > 0).map(([id]) => kinds.get(id)!)
  if (!spawning.some((kind) => kind.blocking)) fail('needs at least one blocking object')
  if (!spawning.some((kind) => !kind.blocking)) fail('needs at least one occupiable object')
}

export function createRegistry(): Registry {
  const plugins: Plugin[] = []
  let tables = emptyTables()

  const stage = (plugin: Plugin): Tables => {
    const staged: Tables = {
      objectKinds: new Map(tables.objectKinds),
      clueTypes: new Map(tables.clueTypes),
      rules: new Map(tables.rules),
      themes: new Map(tables.themes),
      tools: new Map(tables.tools),
      sources: new Map(tables.sources),
    }
    const add = <T extends { id: string }>(table: Map<string, T>, what: string, def: T) => {
      if (!def.id) throw new Error(`Plugin "${plugin.id}" registered a ${what} without an id`)
      if (table.has(def.id)) throw new Error(`Duplicate ${what} "${def.id}" from plugin "${plugin.id}"`)
      table.set(def.id, def)
    }
    const api: PluginApi = {
      addObjectKind: (def) => {
        const offsets = def.footprint ?? []
        if (offsets.some((p) => !Number.isInteger(p.r) || !Number.isInteger(p.c) || (p.r === 0 && p.c === 0))) {
          throw new Error(`Object kind "${def.id}" has an invalid footprint`)
        }
        add(staged.objectKinds, 'object kind', def)
      },
      addClueType: (def) => {
        if (!SCOPES.includes(def.scope)) throw new Error(`Clue type "${def.id}" has an invalid scope`)
        add(staged.clueTypes, 'clue type', def)
      },
      addRule: (def) => add(staged.rules, 'rule', def),
      addTheme: (def) => add(staged.themes, 'theme', def),
      addTool: (def) => add(staged.tools, 'tool', def),
      addPuzzleSource: (def) => add(staged.sources, 'puzzle source', def),
    }
    plugin.register(api)
    for (const theme of staged.themes.values()) validateTheme(theme, staged.objectKinds)
    return staged
  }

  return {
    register(plugin) {
      if (!PLUGIN_ID.test(plugin.id)) throw new Error(`Invalid plugin id "${plugin.id}"`)
      if (!SEMVER.test(plugin.version)) throw new Error(`Plugin "${plugin.id}" has an invalid version "${plugin.version}"`)
      if (plugins.some((p) => p.id === plugin.id)) throw new Error(`Duplicate plugin "${plugin.id}"`)
      for (const required of plugin.requires ?? []) {
        if (!plugins.some((p) => p.id === required)) {
          throw new Error(`Plugin "${plugin.id}" requires "${required}", which is not registered`)
        }
      }
      tables = stage(plugin)
      plugins.push(plugin)
    },
    has: (pluginId) => plugins.some((p) => p.id === pluginId),
    fingerprint: () =>
      plugins
        .map((p) => `${p.id}@${p.version}`)
        .sort()
        .join(','),
    objectKind: (id) => lookup(tables.objectKinds, 'object kind', id),
    clueType: (id) => lookup(tables.clueTypes, 'clue type', id),
    clueTypes: () => [...tables.clueTypes.values()],
    rules: () => [...tables.rules.values()],
    theme: (id) => {
      if (id !== undefined) return lookup(tables.themes, 'theme', id)
      const first = tables.themes.values().next()
      if (first.done) throw new Error('No theme registered')
      return first.value
    },
    tools: () => [...tables.tools.values()],
    puzzleSource: (id) => lookup(tables.sources, 'puzzle source', id),
  }
}

export const registry: Registry = createRegistry()
```

- [ ] **Step 5: Run the test and the typecheck**

Run: `npx vitest run src/engine/registry.test.ts && npx tsc -b`
Expected: all registry tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/plugin.ts src/engine/registry.ts src/engine/registry.test.ts
git commit -m "Add plugin contract and registry"
```

---

### Task 2: Object kinds and the default theme as a plugin

After this task `isOccupiable` reads the `blocking` flag from the registry, and the board draws glyphs from the puzzle's theme. Clue types stay where they are until Task 3.

**Files:**
- Create: `src/plugins/classic/objects.ts`, `src/plugins/classic/theme.ts`, `src/plugins/classic/index.ts`, `src/plugins/index.ts`
- Modify: `src/engine/types.ts`, `src/test-setup.ts`, `src/ui/glyphs.ts`, `src/ui/Board.tsx`, `src/ui/Legend.tsx`
- Test: `src/plugins/classic/classic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/plugins/classic/classic.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createRegistry } from '../../engine/registry'
import { classicPlugin } from '.'

describe('classic plugin', () => {
  const registry = createRegistry()
  registry.register(classicPlugin)

  it('keeps chairs, rugs and water walkable and everything else blocking', () => {
    const walkable = ['chair', 'rug', 'water']
    const blocking = ['table', 'shelf', 'plant', 'rock', 'tree', 'tv']
    for (const id of walkable) expect(registry.objectKind(id).blocking).toBe(false)
    for (const id of blocking) expect(registry.objectKind(id).blocking).toBe(true)
  })

  it('gives its theme a noun for every object it spawns', () => {
    const theme = registry.theme('classic')
    expect(Object.keys(theme.objects).sort()).toEqual(
      ['chair', 'plant', 'rock', 'rug', 'shelf', 'table', 'tree', 'tv', 'water'].sort(),
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/plugins/classic/classic.test.ts`
Expected: FAIL, cannot resolve `'.'` (no `src/plugins/classic/index.ts` yet).

- [ ] **Step 3: Write the classic object kinds**

Create `src/plugins/classic/objects.ts`:

```ts
import type { ObjectKindDef } from '../../engine/plugin'

export const OBJECT_KINDS: readonly ObjectKindDef[] = [
  { id: 'chair', blocking: false },
  { id: 'rug', blocking: false },
  { id: 'water', blocking: false },
  { id: 'table', blocking: true },
  { id: 'shelf', blocking: true },
  { id: 'plant', blocking: true },
  { id: 'rock', blocking: true },
  { id: 'tree', blocking: true },
  { id: 'tv', blocking: true },
]
```

- [ ] **Step 4: Write the classic theme**

The key order of `objects` matters: the layout generator walks it in order when it rolls for an object, and this order reproduces the previous weights table exactly. Glyphs are written as escapes to keep the file ASCII.

Create `src/plugins/classic/theme.ts`:

```ts
import type { ThemeDef } from '../../engine/plugin'

export const classicTheme: ThemeDef = {
  id: 'classic',
  rooms: [
    'Library',
    'Kitchen',
    'Cellar',
    'Attic',
    'Garden',
    'Study',
    'Gallery',
    'Conservatory',
    'Parlor',
    'Workshop',
    'Pantry',
    'Balcony',
    'Laundry',
    'Cloakroom',
    'Observatory',
    'Chapel',
  ],
  suspects: [
    'Ada',
    'Bram',
    'Cora',
    'Dev',
    'Elsa',
    'Finn',
    'Gus',
    'Hana',
    'Ivo',
    'June',
    'Kai',
    'Lena',
    'Milo',
    'Nora',
    'Otto',
    'Pia',
  ],
  objects: {
    chair: { noun: 'a chair', standingOn: 'sitting on a chair', glyph: '\u{1FA91}', weight: 0.1 },
    rug: { noun: 'a rug', standingOn: 'on a rug', glyph: '\u{25A6}', weight: 0.06 },
    water: { noun: 'the water', standingOn: 'in the water', glyph: '\u{1F4A7}', weight: 0.04 },
    table: { noun: 'a table', standingOn: 'on a table', glyph: '\u{1F7EB}', weight: 0.05 },
    shelf: { noun: 'a shelf', standingOn: 'on a shelf', glyph: '\u{1F4DA}', weight: 0.03 },
    plant: { noun: 'a plant', standingOn: 'on a plant', glyph: '\u{1FAB4}', weight: 0.03 },
    rock: { noun: 'a rock', standingOn: 'on a rock', glyph: '\u{1FAA8}', weight: 0.02 },
    tree: { noun: 'a tree', standingOn: 'on a tree', glyph: '\u{1F333}', weight: 0.02 },
    tv: { noun: 'a TV', standingOn: 'on a TV', glyph: '\u{1F4FA}', weight: 0.01 },
  },
}
```

- [ ] **Step 5: Write the plugin and the builtin registration**

Create `src/plugins/classic/index.ts`:

```ts
import type { Plugin } from '../../engine/plugin'
import { OBJECT_KINDS } from './objects'
import { classicTheme } from './theme'

export const classicPlugin: Plugin = {
  id: 'classic',
  version: '1.0.0',
  register(api) {
    for (const kind of OBJECT_KINDS) api.addObjectKind(kind)
    api.addTheme(classicTheme)
  },
}
```

`registerBuiltins` is idempotent so test setup, hot reload and `main.tsx` can all call it. Create `src/plugins/index.ts`:

```ts
import { registry } from '../engine/registry'
import { classicPlugin } from './classic'

export function registerBuiltins(): void {
  if (!registry.has(classicPlugin.id)) registry.register(classicPlugin)
}
```

Replace the whole of `src/test-setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { registerBuiltins } from './plugins'

registerBuiltins()
```

- [ ] **Step 6: Make `isOccupiable` and the UI read from the registry**

In `src/engine/types.ts`, replace:

```ts
export type ObjectKind =
  | 'chair'
  | 'rug'
  | 'water'
  | 'table'
  | 'shelf'
  | 'plant'
  | 'rock'
  | 'tree'
  | 'tv'

export const OCCUPIABLE_KINDS: readonly ObjectKind[] = ['chair', 'rug', 'water']
export const BLOCKING_KINDS: readonly ObjectKind[] = ['table', 'shelf', 'plant', 'rock', 'tree', 'tv']
```

with:

```ts
import { registry } from './registry'

export type ObjectKind = string
```

In `src/engine/types.ts`, replace:

```ts
  victim: number
  clues: Clue[]
}
```

with:

```ts
  victim: number
  clues: Clue[]
  themeId?: string
}
```

In `src/engine/types.ts`, replace:

```ts
  return cell.object === null || OCCUPIABLE_KINDS.includes(cell.object)
```

with:

```ts
  return cell.object === null || !registry.objectKind(cell.object).blocking
```

Replace the whole of `src/ui/glyphs.ts`:

```ts
import { registry } from '../engine/registry'
import type { ObjectKind, Puzzle } from '../engine/types'

export const glyphFor = (puzzle: Puzzle, kind: ObjectKind): string => registry.theme(puzzle.themeId).objects[kind].glyph

const ROOM_HUES = [200, 30, 120, 280, 0, 60, 170, 320, 90, 240, 15, 150]

export const roomHue = (room: number): number => ROOM_HUES[room % ROOM_HUES.length]

export const suspectColor = (suspect: number): string => `hsl(${(suspect * 47) % 360} 65% 42%)`
```

In `src/ui/Board.tsx`, replace:

```ts
import { GLYPH, roomHue, suspectColor } from './glyphs'
```

with:

```ts
import { glyphFor, roomHue, suspectColor } from './glyphs'
```

In `src/ui/Board.tsx`, replace:

```ts
GLYPH[cell.object]
```

with:

```ts
glyphFor(puzzle, cell.object)
```

In `src/ui/Legend.tsx`, replace:

```ts
import { GLYPH, roomHue } from './glyphs'
```

with:

```ts
import { glyphFor, roomHue } from './glyphs'
```

In `src/ui/Legend.tsx`, replace:

```ts
GLYPH[kind]
```

with:

```ts
glyphFor(puzzle, kind)
```


- [ ] **Step 7: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass, including the two new classic tests.

- [ ] **Step 8: Commit**

```bash
git add src/engine src/plugins src/test-setup.ts src/ui
git commit -m "Move object kinds and the default theme into a classic plugin"
```

---

### Task 3: Clue types and the victim rule as plugin definitions

The existing clue tests are the safety net: they move to the plugin folder with only their imports changed, and must stay green while the implementation underneath is replaced. `killerOf` becomes the kernel-level `answerOf` (the first rule that offers an answer).

**Files:**
- Create: `src/plugins/classic/clues.ts`, `src/plugins/classic/victim.ts`
- Modify: `src/plugins/classic/index.ts`, `src/engine/types.ts`, `src/engine/clues.ts`, `src/engine/candidates.ts`, `src/engine/solver.ts`, `src/engine/generator.ts`, `src/ui/Game.tsx`
- Move: `src/engine/clues.test.ts` to `src/plugins/classic/clues.test.ts`
- Test: `src/plugins/classic/classic.test.ts`, `src/engine/generator.test.ts`

- [ ] **Step 1: Move the clue tests and point them at the facade**

```bash
git mv src/engine/clues.test.ts src/plugins/classic/clues.test.ts
```

In `src/plugins/classic/clues.test.ts`, replace:

```ts
import { evaluate, isLegalPlacement, isSolved, killerOf, renderClue } from './clues'
import { lonely, pairs, tiny, twoChairs } from './fixtures'
import type { Clue, Placement } from './types'
```

with:

```ts
import { answerOf, evaluate, isLegalPlacement, isSolved, renderClue } from '../../engine/clues'
import { lonely, pairs, tiny, twoChairs } from '../../engine/fixtures'
import type { Clue, Placement } from '../../engine/types'
```

In the same file rename `describe('killerOf'` to `describe('answerOf'` and both `killerOf(tiny, ...)` calls to `answerOf(tiny, ...)`.

In `src/engine/generator.test.ts`, replace:

```ts
import { isLegalPlacement, isSolved, killerOf } from './clues'
```

with:

```ts
import { answerOf, isLegalPlacement, isSolved } from './clues'
```

In the same file rename the `killerOf(puzzle, placement)` call to `answerOf(puzzle, placement)`.

- [ ] **Step 2: Add the failing registration test**

Append inside the `describe('classic plugin', ...)` block of `src/plugins/classic/classic.test.ts`:

```ts
  it('registers every clue type and the victim rule', () => {
    expect(registry.clueTypes()).toHaveLength(14)
    expect(registry.rules().map((r) => r.id)).toEqual(['victim-killer'])
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/plugins/classic`
Expected: FAIL. `answerOf` is not exported from `engine/clues`, and the new test sees 0 clue types.

- [ ] **Step 4: Write the classic clue types**

Each definition carries what used to live in three places (the `evaluate` switch, the `renderClue` switch and `candidateClues`), plus the solver hints that used to be hard-coded type lists. Methods are declared with parameter types narrower than `Clue`; TypeScript allows this for method-style interface members.

Create `src/plugins/classic/clues.ts`:

```ts
import { objectKindsIn } from '../../engine/candidates'
import type { ClueTypeDef, PartialPlacement, ThemeDef } from '../../engine/plugin'
import type { Clue, Placement, Pos, Puzzle } from '../../engine/types'

type RoomClue = Clue & { room: number }
type KindClue = Clue & { kind: string }
type ColumnClue = Clue & { col: number }
type RowClue = Clue & { row: number }
type OtherClue = Clue & { other: number }
type OffsetClue = OtherClue & { delta: number }

const NEIGHBOR_STEPS: readonly Pos[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
]

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

const roomOf = (puzzle: Puzzle, pos: Pos): number => puzzle.cells[pos.r][pos.c].room
const objectAt = (puzzle: Puzzle, pos: Pos): string | null => puzzle.cells[pos.r][pos.c].object
const nameOf = (puzzle: Puzzle, suspect: number): string => puzzle.suspects[suspect].name
const plural = (n: number, unit: string): string => `${NUMBER_WORDS[n] ?? n} ${unit}${n === 1 ? '' : 's'}`

function suspectsInRoom(puzzle: Puzzle, placement: Placement, room: number): number {
  return placement.filter((pos) => roomOf(puzzle, pos) === room).length
}

function isBesideObject(puzzle: Puzzle, pos: Pos, kind: string): boolean {
  const room = roomOf(puzzle, pos)
  return NEIGHBOR_STEPS.some(({ r, c }) => {
    const next = { r: pos.r + r, c: pos.c + c }
    const inBounds = next.r >= 0 && next.c >= 0 && next.r < puzzle.size && next.c < puzzle.size
    return inBounds && roomOf(puzzle, next) === room && objectAt(puzzle, next) === kind
  })
}

function placedWithSuspect(puzzle: Puzzle, assigned: PartialPlacement, suspect: number): number | null {
  const pos = assigned[suspect]
  if (!pos) return null
  const room = roomOf(puzzle, pos)
  return assigned.filter((p) => p !== undefined && roomOf(puzzle, p) === room).length
}

const perRoom =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    puzzle.rooms.map((_, room) => ({ type, suspect, room }))

const perKind =
  (type: string) =>
  (puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] =>
    objectKindsIn(puzzle).map((kind) => ({ type, suspect, kind }))

const bare =
  (type: string) =>
  (_puzzle: Puzzle, _placement: Placement, suspect: number): Clue[] => [{ type, suspect }]

const standingOn = (theme: ThemeDef, kind: string): string => theme.objects[kind].standingOn
const noun = (theme: ThemeDef, kind: string): string => theme.objects[kind].noun

const inRoom: ClueTypeDef = {
  id: 'inRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) === clue.room,
  render: (clue: RoomClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in the ${puzzle.rooms[clue.room]}.`,
  candidates: perRoom('inRoom'),
}

const notInRoom: ClueTypeDef = {
  id: 'notInRoom',
  scope: 'unary',
  evaluate: (clue: RoomClue, puzzle, placement) => roomOf(puzzle, placement[clue.suspect]) !== clue.room,
  render: (clue: RoomClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was not in the ${puzzle.rooms[clue.room]}.`,
  candidates: perRoom('notInRoom'),
}

const onObject: ClueTypeDef = {
  id: 'onObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) === clue.kind,
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was ${standingOn(theme, clue.kind)}.`,
  candidates: perKind('onObject'),
}

const notOnObject: ClueTypeDef = {
  id: 'notOnObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => objectAt(puzzle, placement[clue.suspect]) !== clue.kind,
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was not ${standingOn(theme, clue.kind)}.`,
  candidates: perKind('notOnObject'),
}

const besideObject: ClueTypeDef = {
  id: 'besideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was beside ${noun(theme, clue.kind)}.`,
  candidates: perKind('besideObject'),
}

const notBesideObject: ClueTypeDef = {
  id: 'notBesideObject',
  scope: 'unary',
  evaluate: (clue: KindClue, puzzle, placement) => !isBesideObject(puzzle, placement[clue.suspect], clue.kind),
  render: (clue: KindClue, puzzle, theme) => `${nameOf(puzzle, clue.suspect)} was not beside ${noun(theme, clue.kind)}.`,
  candidates: perKind('notBesideObject'),
}

const inColumn: ClueTypeDef = {
  id: 'inColumn',
  scope: 'unary',
  evaluate: (clue: ColumnClue, _puzzle, placement) => placement[clue.suspect].c === clue.col,
  render: (clue: ColumnClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in column ${clue.col + 1}.`,
  candidates: (_puzzle, placement, suspect) => [{ type: 'inColumn', suspect, col: placement[suspect].c }],
}

const inRow: ClueTypeDef = {
  id: 'inRow',
  scope: 'unary',
  evaluate: (clue: RowClue, _puzzle, placement) => placement[clue.suspect].r === clue.row,
  render: (clue: RowClue, puzzle) => `${nameOf(puzzle, clue.suspect)} was in row ${clue.row + 1}.`,
  candidates: (_puzzle, placement, suspect) => [{ type: 'inRow', suspect, row: placement[suspect].r }],
}

const northOf: ClueTypeDef = {
  id: 'northOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].r === placement[clue.other].r - clue.delta,
  render: (clue: OffsetClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was ${plural(clue.delta, 'row')} north of ${nameOf(puzzle, clue.other)}.`,
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.r > placement[suspect].r
        ? [{ type: 'northOf', suspect, other: index, delta: other.r - placement[suspect].r }]
        : [],
    ),
}

const westOf: ClueTypeDef = {
  id: 'westOf',
  scope: 'binary',
  evaluate: (clue: OffsetClue, _puzzle, placement) => placement[clue.suspect].c === placement[clue.other].c - clue.delta,
  render: (clue: OffsetClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was ${plural(clue.delta, 'column')} west of ${nameOf(puzzle, clue.other)}.`,
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((other, index) =>
      index !== suspect && other.c > placement[suspect].c
        ? [{ type: 'westOf', suspect, other: index, delta: other.c - placement[suspect].c }]
        : [],
    ),
}

const sameRoomAs: ClueTypeDef = {
  id: 'sameRoomAs',
  scope: 'binary',
  evaluate: (clue: OtherClue, puzzle, placement) =>
    roomOf(puzzle, placement[clue.suspect]) === roomOf(puzzle, placement[clue.other]),
  render: (clue: OtherClue, puzzle) =>
    `${nameOf(puzzle, clue.suspect)} was in the same room as ${nameOf(puzzle, clue.other)}.`,
  candidates: (_puzzle, placement, suspect) =>
    placement.flatMap((_, index) => (index === suspect ? [] : [{ type: 'sameRoomAs', suspect, other: index }])),
}

const aloneInRoom: ClueTypeDef = {
  id: 'aloneInRoom',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 1,
  render: (clue, puzzle) => `${nameOf(puzzle, clue.suspect)} was alone.`,
  candidates: bare('aloneInRoom'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 1,
}

const withOneOther: ClueTypeDef = {
  id: 'withOneOther',
  scope: 'global',
  evaluate: (clue, puzzle, placement) =>
    suspectsInRoom(puzzle, placement, roomOf(puzzle, placement[clue.suspect])) === 2,
  render: (clue, puzzle) =>
    clue.suspect === puzzle.victim
      ? `${nameOf(puzzle, clue.suspect)} was alone with the killer.`
      : `${nameOf(puzzle, clue.suspect)} was with exactly one other person.`,
  candidates: bare('withOneOther'),
  prune: (clue, puzzle, assigned) => (placedWithSuspect(puzzle, assigned, clue.suspect) ?? 0) <= 2,
  feasible(clue, puzzle, assigned, reachableByRoom) {
    const pos = assigned[clue.suspect]
    if (!pos) return true
    const room = roomOf(puzzle, pos)
    const present = assigned.filter((p) => p && roomOf(puzzle, p) === room).length
    return present >= 2 || reachableByRoom[room] >= 2 - present
  },
}

const onlyOnObject: ClueTypeDef = {
  id: 'onlyOnObject',
  scope: 'global',
  evaluate: (clue: KindClue, puzzle, placement) =>
    objectAt(puzzle, placement[clue.suspect]) === clue.kind &&
    placement.filter((p) => objectAt(puzzle, p) === clue.kind).length === 1,
  render: (clue: KindClue, puzzle, theme) =>
    `${nameOf(puzzle, clue.suspect)} was the only person ${standingOn(theme, clue.kind)}.`,
  candidates: perKind('onlyOnObject'),
  prune: (clue: KindClue, puzzle, assigned) => assigned.filter((p) => p && objectAt(puzzle, p) === clue.kind).length <= 1,
}

export const CLUE_TYPES: readonly ClueTypeDef[] = [
  inRoom,
  notInRoom,
  onObject,
  notOnObject,
  besideObject,
  notBesideObject,
  inColumn,
  inRow,
  northOf,
  westOf,
  sameRoomAs,
  aloneInRoom,
  withOneOther,
  onlyOnObject,
]
```

- [ ] **Step 5: Write the victim rule**

Create `src/plugins/classic/victim.ts`:

```ts
import type { RuleDef } from '../../engine/plugin'
import type { Placement, Puzzle } from '../../engine/types'

export function killerOf(puzzle: Puzzle, placement: Placement): number | null {
  const roomOf = (suspect: number) => puzzle.cells[placement[suspect].r][placement[suspect].c].room
  const room = roomOf(puzzle.victim)
  const others = placement.map((_, i) => i).filter((i) => i !== puzzle.victim && roomOf(i) === room)
  return others.length === 1 ? others[0] : null
}

export const victimRule: RuleDef = {
  id: 'victim-killer',
  check: (puzzle, placement) => killerOf(puzzle, placement) !== null,
  answer: killerOf,
}
```

- [ ] **Step 6: Register them**

Replace the whole of `src/plugins/classic/index.ts`:

```ts
import type { Plugin } from '../../engine/plugin'
import { CLUE_TYPES } from './clues'
import { OBJECT_KINDS } from './objects'
import { classicTheme } from './theme'
import { victimRule } from './victim'

export const classicPlugin: Plugin = {
  id: 'classic',
  version: '1.0.0',
  register(api) {
    for (const kind of OBJECT_KINDS) api.addObjectKind(kind)
    for (const def of CLUE_TYPES) api.addClueType(def)
    api.addRule(victimRule)
    api.addTheme(classicTheme)
  },
}
```

- [ ] **Step 7: Replace the kernel types and facade**

Replace the whole of `src/engine/types.ts` (`Tier` stays here until Task 4):

```ts
import { registry } from './registry'

export type ObjectKind = string

export interface Pos {
  r: number
  c: number
}

export interface Cell {
  room: number
  object: ObjectKind | null
}

export interface Suspect {
  name: string
}

export type Placement = Pos[]

export interface Clue {
  type: string
  suspect: number
  [field: string]: unknown
}

export interface Puzzle {
  size: number
  cells: Cell[][]
  rooms: string[]
  suspects: Suspect[]
  victim: number
  clues: Clue[]
  themeId?: string
}

export type Tier = 'easy' | 'medium' | 'hard'

export function isOccupiable(cell: Cell): boolean {
  return cell.object === null || !registry.objectKind(cell.object).blocking
}
```

Replace the whole of `src/engine/clues.ts`:

```ts
import { registry } from './registry'
import { isOccupiable } from './types'
import type { Clue, Placement, Puzzle } from './types'

export const isUnaryClue = (clue: Clue): boolean => registry.clueType(clue.type).scope === 'unary'

export function evaluate(clue: Clue, puzzle: Puzzle, placement: Placement): boolean {
  return registry.clueType(clue.type).evaluate(clue, puzzle, placement)
}

export function renderClue(clue: Clue, puzzle: Puzzle): string {
  return registry.clueType(clue.type).render(clue, puzzle, registry.theme(puzzle.themeId))
}

export function isLegalPlacement(puzzle: Puzzle, placement: Placement): boolean {
  if (placement.length !== puzzle.size) return false
  const rows = new Set<number>()
  const cols = new Set<number>()
  for (const { r, c } of placement) {
    const inBounds = r >= 0 && c >= 0 && r < puzzle.size && c < puzzle.size
    if (!inBounds || !isOccupiable(puzzle.cells[r][c])) return false
    rows.add(r)
    cols.add(c)
  }
  return rows.size === puzzle.size && cols.size === puzzle.size
}

export function rulesHold(puzzle: Puzzle, placement: Placement): boolean {
  return registry.rules().every((rule) => rule.check(puzzle, placement))
}

export function answerOf(puzzle: Puzzle, placement: Placement): number | null {
  for (const rule of registry.rules()) {
    const answer = rule.answer?.(puzzle, placement) ?? null
    if (answer !== null) return answer
  }
  return null
}

export function isSolved(puzzle: Puzzle, placement: Placement): boolean {
  return (
    isLegalPlacement(puzzle, placement) &&
    rulesHold(puzzle, placement) &&
    puzzle.clues.every((clue) => evaluate(clue, puzzle, placement))
  )
}
```

Replace the whole of `src/engine/candidates.ts`:

```ts
import { evaluate } from './clues'
import { registry } from './registry'
import type { Clue, ObjectKind, Placement, Puzzle } from './types'

export function objectKindsIn(puzzle: Puzzle): ObjectKind[] {
  const kinds = new Set<ObjectKind>()
  for (const row of puzzle.cells) for (const cell of row) if (cell.object) kinds.add(cell.object)
  return [...kinds]
}

/** Every clue about `suspect` that is true under `placement` and whose type is allowed. */
export function candidateClues(
  puzzle: Puzzle,
  placement: Placement,
  suspect: number,
  allowed: ReadonlySet<string>,
): Clue[] {
  return registry
    .clueTypes()
    .filter((def) => allowed.has(def.id))
    .flatMap((def) => def.candidates?.(puzzle, placement, suspect) ?? [])
    .filter((clue) => evaluate(clue, puzzle, placement))
}
```

- [ ] **Step 8: Make the solver ask the registry**

Replace the whole of `src/engine/solver.ts`. The search is unchanged; only the hard-coded clue type sets, `globalPrune`, `companyReachable` and the final killer check now come from clue scopes, `prune`, `feasible` and `rulesHold`.

```ts
import { evaluate, isUnaryClue, rulesHold } from './clues'
import type { PartialPlacement } from './plugin'
import { registry } from './registry'
import { shuffle } from './rng'
import type { Rng } from './rng'
import { isOccupiable } from './types'
import type { Clue, Placement, Pos, Puzzle } from './types'

type Assigned = PartialPlacement

const scopeOf = (clue: Clue) => registry.clueType(clue.type).scope

function otherOf(clue: Clue): number | undefined {
  return typeof clue.other === 'number' ? clue.other : undefined
}

function buildDomains(puzzle: Puzzle): Pos[][] {
  const domains: Pos[][] = puzzle.suspects.map(() => [])
  for (let r = 0; r < puzzle.size; r++) {
    for (let c = 0; c < puzzle.size; c++) {
      if (!isOccupiable(puzzle.cells[r][c])) continue
      puzzle.suspects.forEach((_, i) => {
        const probe: Placement = []
        probe[i] = { r, c }
        const unaryOk = puzzle.clues.every(
          (clue) => clue.suspect !== i || !isUnaryClue(clue) || evaluate(clue, puzzle, probe),
        )
        if (unaryOk) domains[i].push({ r, c })
      })
    }
  }
  return domains
}

function globalPrune(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  return registry.clueType(clue.type).prune?.(clue, puzzle, assigned) ?? true
}

function binaryHolds(puzzle: Puzzle, clue: Clue, assigned: Assigned): boolean {
  const other = otherOf(clue)
  if (other === undefined || !assigned[clue.suspect] || !assigned[other]) return true
  return evaluate(clue, puzzle, assigned as Placement)
}

function companyReachable(puzzle: Puzzle, assigned: Assigned, reachable: number[]): boolean {
  return puzzle.clues.every(
    (clue) => registry.clueType(clue.type).feasible?.(clue, puzzle, assigned, reachable) ?? true,
  )
}

export interface SearchOptions {
  rng?: Rng
  nodeBudget?: number
}

/** Returns true when the search finished, false when it hit the node budget. */
function search(puzzle: Puzzle, onSolution: (placement: Placement) => boolean, options: SearchOptions = {}): boolean {
  const { rng, nodeBudget = Infinity } = options
  let nodes = 0
  let exhausted = false
  const built = buildDomains(puzzle)
  const domains = rng ? built.map((d) => shuffle(rng, d)) : built
  if (domains.some((d) => d.length === 0)) return true

  const involving = puzzle.suspects.map((_, i) =>
    puzzle.clues.filter((clue) => scopeOf(clue) === 'binary' && (clue.suspect === i || otherOf(clue) === i)),
  )
  const globals = puzzle.clues.filter((clue) => scopeOf(clue) === 'global')
  const rowUsed = new Array<boolean>(puzzle.size).fill(false)
  const colUsed = new Array<boolean>(puzzle.size).fill(false)
  const assigned: Assigned = new Array(puzzle.size).fill(undefined)
  let stopped = false

  const available = (s: number, pos: Pos): boolean => {
    if (rowUsed[pos.r] || colUsed[pos.c]) return false
    if (involving[s].length === 0) return true
    assigned[s] = pos
    const holds = involving[s].every((clue) => binaryHolds(puzzle, clue, assigned))
    assigned[s] = undefined
    return holds
  }

  const visit = (placedCount: number): void => {
    if (stopped) return
    if (++nodes > nodeBudget) {
      stopped = true
      exhausted = true
      return
    }
    if (placedCount === puzzle.size) {
      const placement = assigned as Placement
      const ok = puzzle.clues.every((clue) => evaluate(clue, puzzle, placement)) && rulesHold(puzzle, placement)
      if (ok && onSolution(placement.map((p) => ({ ...p })))) stopped = true
      return
    }
    let next = -1
    let options: Pos[] = []
    const reachable = new Array<number>(puzzle.rooms.length).fill(0)
    for (let s = 0; s < puzzle.size; s++) {
      if (assigned[s]) continue
      const live = domains[s].filter((pos) => available(s, pos))
      if (live.length === 0) return
      for (const room of new Set(live.map((pos) => puzzle.cells[pos.r][pos.c].room))) reachable[room]++
      if (next === -1 || live.length < options.length) {
        next = s
        options = live
      }
    }
    if (!companyReachable(puzzle, assigned, reachable)) return
    for (const pos of options) {
      assigned[next] = pos
      if (globals.every((clue) => globalPrune(puzzle, clue, assigned))) {
        rowUsed[pos.r] = true
        colUsed[pos.c] = true
        visit(placedCount + 1)
        rowUsed[pos.r] = false
        colUsed[pos.c] = false
      }
      assigned[next] = undefined
      if (stopped) return
    }
  }
  visit(0)
  return !exhausted
}

/** Counts solutions up to `limit`. A search that exhausts its budget reports `limit` (unknown, treat as ambiguous). */
export function countSolutions(puzzle: Puzzle, limit: number, nodeBudget?: number): number {
  let count = 0
  const finished = search(
    puzzle,
    () => {
      count++
      return count >= limit
    },
    { nodeBudget },
  )
  return finished || count >= limit ? count : limit
}

export function solve(puzzle: Puzzle): Placement | null {
  let found: Placement | null = null
  search(puzzle, (placement) => {
    found = placement
    return true
  })
  return found
}

export function findSolutions(puzzle: Puzzle, limit: number, options?: SearchOptions): Placement[] {
  const found: Placement[] = []
  search(
    puzzle,
    (placement) => {
      found.push(placement)
      return found.length >= limit
    },
    options,
  )
  return found
}
```

- [ ] **Step 9: Loosen the generator's clue type annotations**

In `src/engine/generator.ts`, replace:

```ts
import type { Cell, Clue, ClueType, Placement, Pos, Puzzle, Tier } from './types'
```

with:

```ts
import type { Cell, Clue, Placement, Pos, Puzzle, Tier } from './types'
```

In the same file change `readonly ClueType[]` to `readonly string[]` in `TierConfig.allowed`, `DIRECT`, `INTERMEDIATE` and `ADVANCED` (four places).

- [ ] **Step 10: Use `answerOf` in the game**

In `src/ui/Game.tsx`, replace:

```ts
import { evaluate, isLegalPlacement, isSolved, killerOf } from '../engine/clues'
```

with:

```ts
import { answerOf, evaluate, isLegalPlacement, isSolved } from '../engine/clues'
```

In the same file change `killerOf(puzzle, complete)` to `answerOf(puzzle, complete)`.

- [ ] **Step 11: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass, including every moved clue test and the solver and generator suites (the generator speed test must still report a median under 250 ms).

- [ ] **Step 12: Commit**

```bash
git add src/engine src/plugins src/ui
git commit -m "Move clue types and the victim rule into the classic plugin"
```

---

### Task 4: Theme-driven generation, tools and the daily source

The generator, layout and daily modules are genre content, so they move into the plugin and read rooms, suspect names and object spawn weights from the theme. The daily seed now includes the plugin fingerprint (spec section 7).

**Files:**
- Move: `src/engine/{generator,layout,daily}.ts` and their tests to `src/plugins/classic/`
- Create: `src/plugins/classic/tools.ts`
- Modify: `src/plugins/classic/{generator,layout,daily,index}.ts`, `src/engine/types.ts`
- Test: `src/plugins/classic/layout.test.ts`, `src/plugins/classic/classic.test.ts`

- [ ] **Step 1: Move the files**

```bash
git mv src/engine/generator.ts src/engine/generator.test.ts src/engine/layout.ts src/engine/layout.test.ts src/engine/daily.ts src/engine/daily.test.ts src/plugins/classic/
```

- [ ] **Step 2: Fix the moved tests' imports**

In `src/plugins/classic/generator.test.ts`, replace:

```ts
import { answerOf, isLegalPlacement, isSolved } from './clues'
import { TIER_CONFIG, generate } from './generator'
import { countSolutions, solve } from './solver'
import type { Tier } from './types'
```

with:

```ts
import { answerOf, isLegalPlacement, isSolved } from '../../engine/clues'
import { countSolutions, solve } from '../../engine/solver'
import { TIER_CONFIG, generate } from './generator'
import type { Tier } from './generator'
```

In `src/plugins/classic/layout.test.ts`, replace:

```ts
import { mulberry32 } from './rng'
import type { Cell } from './types'
```

with:

```ts
import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { mulberry32 } from '../../engine/rng'
import type { Cell } from '../../engine/types'
```

`daily.test.ts` needs no change (it imports `./daily`).

- [ ] **Step 3: Add the failing tests**

Append inside the `describe('generateLayout', ...)` block of `src/plugins/classic/layout.test.ts`:

```ts
  it('draws rooms and objects from the given theme', () => {
    const theme: ThemeDef = {
      id: 'mini',
      rooms: ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'],
      suspects: ['S'],
      objects: {
        chair: { noun: 'a chair', standingOn: 'on a chair', glyph: 'c', weight: 0.5 },
        table: { noun: 'a table', standingOn: 'on a table', glyph: 't', weight: 0.4 },
      },
    }
    const layout = generateLayout(mulberry32(3), 6, 6, theme)
    expect(layout.rooms.every((room) => theme.rooms.includes(room))).toBe(true)
    const kinds = new Set(layout.cells.flat().map((cell) => cell.object))
    expect([...kinds].every((kind) => kind === null || kind === 'chair' || kind === 'table')).toBe(true)
    expect(kinds.has('chair') && kinds.has('table')).toBe(true)
  })

  it('refuses a theme with too few rooms', () => {
    const theme: ThemeDef = { ...registry.theme(), id: 'tiny', rooms: ['Only'] }
    expect(() => generateLayout(mulberry32(1), 6, 6, theme)).toThrow('fewer than 6 rooms')
  })
```

Append inside the `describe('classic plugin', ...)` block of `src/plugins/classic/classic.test.ts`:

```ts
  it('registers the tools and the daily puzzle source', () => {
    expect(registry.tools().map((t) => t.id)).toEqual(['select', 'x', 'eraser'])
    expect(registry.puzzleSource('daily').id).toBe('daily')
  })
```

- [ ] **Step 4: Run them to verify they fail**

Run: `npx vitest run src/plugins/classic`
Expected: FAIL. Imports of `./layout` etc. resolve, but `generateLayout` ignores the theme argument and the registry has no tools or daily source; the generator and daily modules still import from `./rng`, `./clues` and so on and fail to load.

- [ ] **Step 5: Make the layout theme-driven**

Replace the whole of `src/plugins/classic/layout.ts`:

```ts
import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { pick, randInt, shuffle } from '../../engine/rng'
import type { Rng } from '../../engine/rng'
import type { Cell, ObjectKind } from '../../engine/types'

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

export interface Layout {
  cells: Cell[][]
  rooms: string[]
}

function growRooms(rng: Rng, size: number, roomCount: number): number[][] {
  const grid = Array.from({ length: size }, () => new Array<number>(size).fill(-1))
  shuffle(rng, Array.from({ length: size * size }, (_, i) => i))
    .slice(0, roomCount)
    .forEach((index, room) => {
      grid[Math.floor(index / size)][index % size] = room
    })

  for (let remaining = size * size - roomCount; remaining > 0; remaining--) {
    const frontier: { r: number; c: number; rooms: number[] }[] = []
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== -1) continue
        const rooms = STEPS.map(([dr, dc]) => grid[r + dr]?.[c + dc] ?? -1).filter((room) => room !== -1)
        if (rooms.length > 0) frontier.push({ r, c, rooms })
      }
    }
    const next = frontier[randInt(rng, frontier.length)]
    grid[next.r][next.c] = pick(rng, next.rooms)
  }
  return grid
}

function randomObject(rng: Rng, theme: ThemeDef): ObjectKind | null {
  let roll = rng()
  for (const [kind, { weight }] of Object.entries(theme.objects)) {
    if (roll < weight) return kind
    roll -= weight
  }
  return null
}

export function generateLayout(rng: Rng, size: number, roomCount: number, theme: ThemeDef = registry.theme()): Layout {
  if (theme.rooms.length < roomCount) throw new Error(`Theme "${theme.id}" has fewer than ${roomCount} rooms`)
  const grid = growRooms(rng, size, roomCount)
  const cells = grid.map((row) => row.map((room): Cell => ({ room, object: randomObject(rng, theme) })))
  return { cells, rooms: shuffle(rng, theme.rooms).slice(0, roomCount) }
}
```

- [ ] **Step 6: Make the generator theme-driven**

Apply these edits to `src/plugins/classic/generator.ts`.

In `src/plugins/classic/generator.ts`, replace:

```ts
import { candidateClues } from './candidates'
import { evaluate, isUnaryClue } from './clues'
import { generateLayout } from './layout'
import { mulberry32, pick, shuffle } from './rng'
import type { Rng } from './rng'
import { countSolutions, findSolutions } from './solver'
import { isOccupiable } from './types'
import type { Cell, Clue, Placement, Pos, Puzzle, Tier } from './types'
```

with:

```ts
import { candidateClues } from '../../engine/candidates'
import { evaluate, isUnaryClue } from '../../engine/clues'
import type { ThemeDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { mulberry32, pick, shuffle } from '../../engine/rng'
import type { Rng } from '../../engine/rng'
import { countSolutions, findSolutions } from '../../engine/solver'
import { isOccupiable } from '../../engine/types'
import type { Cell, Clue, Placement, Pos, Puzzle } from '../../engine/types'
import { generateLayout } from './layout'

export type Tier = 'easy' | 'medium' | 'hard'
```

Delete the whole `const SUSPECT_NAMES = [ ... ]` array (the names now live in the theme).

In `src/plugins/classic/generator.ts`, replace:

```ts
function attemptPuzzle(rng: Rng, config: TierConfig): Puzzle | null {
  const { size, roomCount } = config
  const layout = generateLayout(rng, size, roomCount)
```

with:

```ts
function attemptPuzzle(rng: Rng, config: TierConfig, theme: ThemeDef): Puzzle | null {
  const { size, roomCount } = config
  if (theme.suspects.length < size) throw new Error(`Theme "${theme.id}" has fewer than ${size} suspects`)
  const layout = generateLayout(rng, size, roomCount, theme)
```

In `src/plugins/classic/generator.ts`, replace:

```ts
    suspects: shuffle(rng, SUSPECT_NAMES)
```

with:

```ts
    suspects: shuffle(rng, theme.suspects)
```

In `src/plugins/classic/generator.ts`, replace:

```ts
    clues: [],
  }
  return selectClues
```

with:

```ts
    clues: [],
    themeId: theme.id,
  }
  return selectClues
```

In `src/plugins/classic/generator.ts`, replace:

```ts
export function generate(seed: number, tier: Tier): Puzzle {
  const config = TIER_CONFIG[tier]
```

with:

```ts
export function generate(seed: number, tier: Tier, themeId?: string): Puzzle {
  const config = TIER_CONFIG[tier]
  const theme = registry.theme(themeId)
```

In `src/plugins/classic/generator.ts`, replace:

```ts
attemptPuzzle(rng, config)
```

with:

```ts
attemptPuzzle(rng, config, theme)
```


- [ ] **Step 7: Move `Tier` out of the kernel and rewrite the daily source**

In `src/engine/types.ts`, replace:

```ts
}

export type Tier = 'easy' | 'medium' | 'hard'

export function isOccupiable
```

with:

```ts
}

export function isOccupiable
```

Replace the whole of `src/plugins/classic/daily.ts`:

```ts
import type { PuzzleSourceDef } from '../../engine/plugin'
import { registry } from '../../engine/registry'
import { hashSeed } from '../../engine/rng'
import type { Puzzle } from '../../engine/types'
import { generate } from './generator'
import type { Tier } from './generator'

const TIER_BY_WEEKDAY: Record<number, Tier> = {
  0: 'hard',
  1: 'easy',
  2: 'easy',
  3: 'medium',
  4: 'medium',
  5: 'hard',
  6: 'hard',
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function tierForDate(key: string): Tier {
  return TIER_BY_WEEKDAY[new Date(`${key}T00:00:00Z`).getUTCDay()]
}

export function dailyPuzzle(key: string): Puzzle {
  return generate(hashSeed(`whodoku:${key}:${registry.fingerprint()}`), tierForDate(key))
}

export const dailySource: PuzzleSourceDef = { id: 'daily', get: dailyPuzzle }
```

- [ ] **Step 8: Add the tools and register everything**

Create `src/plugins/classic/tools.ts`:

```ts
import type { ToolDef } from '../../engine/plugin'

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'x', label: 'Mark' },
  { id: 'eraser', label: 'Eraser' },
]
```

Replace the whole of `src/plugins/classic/index.ts`:

```ts
import type { Plugin } from '../../engine/plugin'
import { CLUE_TYPES } from './clues'
import { dailySource } from './daily'
import { OBJECT_KINDS } from './objects'
import { classicTheme } from './theme'
import { TOOLS } from './tools'
import { victimRule } from './victim'

export const classicPlugin: Plugin = {
  id: 'classic',
  version: '1.0.0',
  register(api) {
    for (const kind of OBJECT_KINDS) api.addObjectKind(kind)
    for (const def of CLUE_TYPES) api.addClueType(def)
    api.addRule(victimRule)
    api.addTheme(classicTheme)
    for (const tool of TOOLS) api.addTool(tool)
    api.addPuzzleSource(dailySource)
  },
}
```

- [ ] **Step 9: Keep the app compiling**

The daily module moved, so point `App.tsx` at its new home. Task 5 rewires the rest of this file.

In `src/App.tsx`, replace:

```ts
import { dailyPuzzle, dateKey } from './engine/daily'
```

with:

```ts
import { dailyPuzzle, dateKey } from './plugins/classic/daily'
```


- [ ] **Step 10: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: no type errors; all tests pass. Do not run Playwright yet: the e2e spec still imports the old paths until Task 5.

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "Make generation theme-driven and move it into the classic plugin"
```

---

### Task 5: Wire the app to the registry and tag saved progress with a puzzle id

`main.tsx` registers the builtins, `App.tsx` asks the registry for the daily puzzle, and saved progress now records a `puzzleId` (`<dateKey>:<plugin fingerprint>`) so progress from a different puzzle is discarded instead of being replayed onto the wrong board.

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`, `src/state/storage.ts`, `src/state/reducer.ts`, `src/ui/Game.tsx`, `tests/e2e/solve.spec.ts`
- Test: `src/state/reducer.test.ts`, `src/ui/Game.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/state/reducer.test.ts`:

```ts
describe('newGame', () => {
  it('records the puzzle id it was started for', () => {
    expect(newGame('2026-10-02', 1000, 'abc').progress.puzzleId).toBe('abc')
  })
})
```

Append inside the `describe('Game', ...)` block of `src/ui/Game.test.tsx`:

```tsx
  it('discards saved progress that belongs to a different puzzle id', async () => {
    const user = userEvent.setup()
    const storage = fakeStorage()
    const first = render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="a" storage={storage} now={() => 1_000_000} />)
    await place(user, 0, 0, 1)
    first.unmount()
    render(<Game puzzle={tiny} dateKey="2026-10-02" puzzleId="b" storage={storage} now={() => 1_000_000} />)
    expect(screen.getByTestId('cell-0-1')).not.toHaveTextContent('A')
  })
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/state/reducer.test.ts src/ui/Game.test.tsx`
Expected: FAIL. `puzzleId` is undefined in the reducer test, and the Game test finds the suspect still placed.

- [ ] **Step 3: Store the puzzle id**

In `src/state/storage.ts`, replace:

```ts
export interface DayProgress {
  dateKey: string
```

with:

```ts
export interface DayProgress {
  dateKey: string
  puzzleId?: string
```

In `src/state/reducer.ts`, replace:

```ts
export function newGame(dateKey: string, now: number): GameState {
  return {
    progress: { dateKey, placements
```

with:

```ts
export function newGame(dateKey: string, now: number, puzzleId?: string): GameState {
  return {
    progress: { dateKey, puzzleId, placements
```

In `src/ui/Game.tsx`, replace:

```ts
  dateKey: string
  storage
```

with:

```ts
  dateKey: string
  puzzleId?: string
  storage
```

In `src/ui/Game.tsx`, replace:

```ts
export function Game({ puzzle, dateKey, storage, now = Date.now }: GameProps) {
```

with:

```ts
export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: GameProps) {
```

In `src/ui/Game.tsx`, replace:

```ts
    saved.today?.dateKey === dateKey ? { progress: saved.today, selected: null } : newGame(dateKey, now()),
```

with:

```ts
    saved.today?.dateKey === dateKey && saved.today.puzzleId === puzzleId
      ? { progress: saved.today, selected: null }
      : newGame(dateKey, now(), puzzleId),
```


- [ ] **Step 4: Wire the app**

In `src/main.tsx`, replace:

```ts
import App from './App.tsx'
```

with:

```ts
import App from './App.tsx'
import { registerBuiltins } from './plugins'

registerBuiltins()
```

In `src/App.tsx`, replace:

```ts
import { dailyPuzzle, dateKey } from './plugins/classic/daily'
```

with:

```ts
import { registry } from './engine/registry'
import { dateKey } from './plugins/classic/daily'
```

In `src/App.tsx`, replace:

```tsx
  const puzzle = useMemo(() => dailyPuzzle(key), [key])
  return <Game puzzle={puzzle} dateKey={key} storage={localStorageOrNull()} />
```

with:

```tsx
  const puzzle = useMemo(() => registry.puzzleSource('daily').get(key), [key])
  const puzzleId = `${key}:${registry.fingerprint()}`
  return <Game puzzle={puzzle} dateKey={key} puzzleId={puzzleId} storage={localStorageOrNull()} />
```


- [ ] **Step 5: Update the e2e test**

The spec runs in Node and builds the same puzzle the app shows, so it must register the builtins too.

In `tests/e2e/solve.spec.ts`, replace:

```ts
import { dailyPuzzle } from '../../src/engine/daily'
import { killerOf } from '../../src/engine/clues'
import { solve } from '../../src/engine/solver'
```

with:

```ts
import { answerOf } from '../../src/engine/clues'
import { solve } from '../../src/engine/solver'
import { registerBuiltins } from '../../src/plugins'
import { dailyPuzzle } from '../../src/plugins/classic/daily'
```

In `tests/e2e/solve.spec.ts`, replace:

```ts
const DAY = '2026-10-02'
```

with:

```ts
const DAY = '2026-10-02'

registerBuiltins()
```

In the same file change `killerOf(puzzle, placement)!` to `answerOf(puzzle, placement)!`.

- [ ] **Step 6: Run everything**

Run: `npx tsc -b && npx vitest run && npm run build && npx playwright test`
Expected: no type errors, all unit tests pass, the build succeeds, and the e2e solve test passes. (Playwright needs `npx playwright install chromium` once.)

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "Wire the app to the registry and tag saved progress with a puzzle id"
```

---

### Task 6: Architecture guards

Two tests lock the design in: the kernel, state and UI never import plugin code, and a second theme plus a new clue type work without touching the kernel.

**Files:**
- Create: `src/engine/boundary.test.ts`, `src/plugins/extensibility.test.ts`

- [ ] **Step 1: Write the boundary test**

It reads source text through Vite's `?raw` glob so it needs no Node types. The regex must catch both `from '...'` and bare `import '...'`.

Create `src/engine/boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob(
  ['../engine/**/*.{ts,tsx}', '../state/**/*.{ts,tsx}', '../ui/**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

describe('kernel boundary', () => {
  it('scans the kernel, state and UI sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })

  it('keeps plugin code out of the kernel, state and UI', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /(from|import)\s*['"][^'"]*\/plugins(\/|['"])/.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
```

- [ ] **Step 2: Prove the guard can fail**

Run each mutation, confirm the boundary test fails naming the file, then restore the file with `git checkout`:

```bash
echo "import '../plugins'" >> src/engine/rng.ts && npx vitest run src/engine/boundary.test.ts; git checkout src/engine/rng.ts
echo "import { x } from '../plugins/classic'" >> src/ui/Game.tsx && npx vitest run src/engine/boundary.test.ts; git checkout src/ui/Game.tsx
```

Expected for both: `1 failed`, with the offending file in the diff. Only use `git checkout` here after Task 5's commit, so it restores the committed version.

- [ ] **Step 3: Write the extensibility test**

Create `src/plugins/extensibility.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { evaluate, renderClue } from '../engine/clues'
import { tiny } from '../engine/fixtures'
import type { Plugin } from '../engine/plugin'
import { registry } from '../engine/registry'
import { countSolutions } from '../engine/solver'
import { generate } from './classic/generator'

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
      objects: {
        chair: { noun: 'a barstool', standingOn: 'perched on a barstool', glyph: 'S', weight: 0.1 },
        shelf: { noun: 'a safe', standingOn: 'on a safe', glyph: 'X', weight: 0.05 },
      },
    })
    api.addClueType({
      id: 'notInRow',
      scope: 'unary',
      evaluate: (clue, _puzzle, placement) => placement[clue.suspect].r !== clue.row,
      render: (clue, puzzle) => `${puzzle.suspects[clue.suspect].name} avoided row ${Number(clue.row) + 1}.`,
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
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b && npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/boundary.test.ts src/plugins/extensibility.test.ts
git commit -m "Add kernel boundary and extensibility tests"
```

---

### Task 7: Docs and final verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README layout section**

In `README.md`, replace:

```ts
- `src/engine/` pure TypeScript: seeded RNG, clue evaluation and text, backtracking solver with
  solution counting, procedural layouts, the clue generator and the daily seed. Every generated
  puzzle is verified to have exactly one solution.
- `src/state/` reducer, versioned localStorage persistence and streak logic.
- `src/ui/` React components.
- `docs/design/` the spec and implementation plan.
```

with:

```ts
- `src/engine/` the kernel: grid and cell types, seeded RNG, the backtracking solver with
  solution counting, and the plugin registry. It knows nothing about specific objects, clues or
  themes.
- `src/plugins/classic/` the built-in plugin: object kinds, clue types, the victim/killer rule, the
  default theme, tools, procedural layouts, the clue generator and the daily puzzle source. Every
  generated puzzle is verified to have exactly one solution.
- `src/state/` reducer, versioned localStorage persistence and streak logic.
- `src/ui/` React components. They reach plugin content only through the registry.
- `docs/design/` the specs and implementation plans.

### Writing a plugin

A plugin is `{ id, version, requires?, register(api) }`. `register` adds object kinds, clue
types, rules, themes, tools or puzzle sources through `api`. Register it with
`registry.register(plugin)` at startup (see `src/plugins/index.ts`). `src/plugins/extensibility.test.ts`
shows a second theme and a new clue type added this way. Code under `src/engine`, `src/state` and
`src/ui` must not import from `src/plugins`; a test enforces it.
```


- [ ] **Step 2: Full verification**

```bash
npx tsc -b && npx oxlint && npx vitest run && npm run build && npx playwright test
```

Expected: every command exits 0. Report the test counts you actually see.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "Document the plugin architecture in the README"
```

- [ ] **Step 4: Hand back**

Do not merge. Report the branch name, the commit list (`git log --oneline main..plugin-kernel`) and the verification output, then use superpowers:finishing-a-development-branch.

---

## Self-Review Notes

- **Spec coverage:** kernel and registry (Task 1); object kinds and `blocking` as the single source of truth (Task 2); clue types, rules and solver hooks (Task 3); themes with validation (Tasks 1 and 4); tools and puzzle source (Task 4); determinism and puzzle id (Tasks 4 and 5); `classic` dogfooding and the boundary test (Tasks 2 to 6); second theme and new clue type (Task 6). Multi-cell `footprint` is validated in Task 1 and deliberately not generated or rendered.
- **Known deviations from the spec text, already reflected in the amended spec:** `Puzzle.victim` stays in the kernel type; `footprint` is descriptive only; progress is tagged with `puzzleId` rather than a seed.
- **Types used across tasks:** `ClueTypeDef`, `RuleDef`, `ThemeDef`, `ObjectKindDef`, `ToolDef`, `PuzzleSourceDef`, `PartialPlacement` (all from `src/engine/plugin.ts`); `answerOf` and `rulesHold` (from `src/engine/clues.ts`); `generate(seed, tier, themeId?)`; `generateLayout(rng, size, roomCount, theme?)`; `newGame(dateKey, now, puzzleId?)`.
