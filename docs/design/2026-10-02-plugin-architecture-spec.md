# Whodoku: Plugin Architecture Spec

Status: draft for review. Date: 2026-10-02. Extends `2026-10-02-whodoku-spec.md`. The UI redesign
(`2026-10-02-ui-redesign-spec.md`) builds on this.

## 1. Goal

A small kernel with everything else added through plugins: object kinds, clue types, global
rules, themes, tools and puzzle sources. New content (a different theme, a new clue type, a new
tool) must be addable without editing the kernel.

Success criteria:

- The kernel imports nothing from the built-in `classic` plugin. A test enforces this.
- Every current behavior is reproduced by `classic`. The full existing test suite passes
  unchanged after the refactor.
- A second theme can be added as data plus art, with no kernel or engine changes.
- A broken plugin fails at registration time with a clear error, not mid-game.

Non-goals: loading third-party code at runtime, a plugin marketplace, a plugin settings UI.

## 2. Kernel

The kernel owns only:

- The N x N grid, rooms, and the cell model (section 4).
- The one-suspect-per-row-and-column placement rule.
- The solver, which counts solutions up to 2 so uniqueness is always checkable.
- The plugin registry (section 3).
- The game state reducer, including undo and the active tool.

Everything else lives in plugins. The kernel has no knowledge of chairs, zoos, or specific
sprites. `Puzzle` keeps a `victim` index because the genre defines one, but what it means (the
killer is the other suspect in the victim's room) is the `victim-killer` rule in `classic`.
The kernel lives in `src/engine/`; the UI and state layers talk to it only through the registry.

## 3. Plugin contract

```ts
interface Plugin {
  id: string              // unique, kebab-case
  version: string         // semver
  requires?: string[]     // ids of plugins that must be registered first
  register(api: PluginApi): void
}
```

`PluginApi` exposes one `add*` method per extension point (section 4). Plugins are TypeScript
modules bundled at build time. Registration happens once at startup, in dependency order.
Registration fails loudly on: duplicate ids, a missing `requires`, an invalid definition, or a
theme that fails validation (section 6).

## 4. Extension points

| Point | Definition | Used by |
|---|---|---|
| Object kind | `{ id, blocking, footprint? }` | cell occupancy, generator, clues, renderer |
| Clue type | `{ id, scope, evaluate, render, candidates?, prune?, feasible? }` | solver, generator, card text |
| Global rule | `{ id, check(puzzle, placement), answer? }`, pure | solver, Submit check, accusation |
| Theme | `{ id, rooms, suspects, objects }` (section 6) | generator, renderer |
| Tool | `{ id, label, paint?, holdToClear? }`; stroke tools define `paint` | tools panel, board |
| Puzzle source | `{ id, get(dateKey) }` | app shell |

Rules for definitions:

- `evaluate` and global-rule `check` are pure and deterministic.
- `scope` is `unary` (depends on one suspect's cell), `binary` (also names an `other` suspect) or
  `global` (depends on everyone). The solver uses it to decide when a clue can be checked.
- `prune` and `feasible` are optional solver speedups for partial placements. The solver is
  correct with `evaluate` alone, so a plugin can be slow but cannot make a puzzle wrong.
- `candidates` proposes clues for the generator. The generator keeps a puzzle only if the solver
  reports exactly one solution.

## 5. Object model

- A cell has a room, an optional `object` id, and the terrain look comes from the room's texture.
- `blocking` on the object kind is the only source of truth for occupancy. `isOccupiable(cell)`
  reads it from the registry. No UI code decides this.
- `footprint` lists extra cell offsets that describe the shape of a multi-cell prop such as the
  L-shaped rugs and the 2x2 elephants. Stored puzzles keep one object id per covered cell, so the
  puzzle format does not change when multi-cell generation and rendering land later. The registry
  only validates the offsets now (integers, never the anchor itself).
- Stored puzzles reference object ids as strings, not enum values.

## 6. Themes

A theme is data:

- `rooms`: names and a texture id each.
- `suspects`: name and a portrait (SVG component or image).
- `objects`: for each object kind id, a `noun` and a `standingOn` phrase for clue text, a `sprite`
  (a list of rect, ellipse and path shapes on a 100 x 100 canvas, plain data so a theme can ship as
  JSON), and a spawn `weight` for the layout generator. The UI plan replaces the temporary `glyph`
  field used by the kernel plan with `sprite`.
- `tokens`: colors, wall weights, shadow, fonts (UI spec, section 7).

A theme validator runs at registration: non-empty unique rooms and suspects, every object is a
registered kind with a noun, standingOn and at least one sprite shape, and at least one spawnable blocking and one
spawnable occupiable object. The generator additionally refuses a theme with fewer rooms or
suspects than the grid size it was asked for.

The generator takes a theme and builds puzzles from its rooms, objects and suspects. Which theme a
given day uses is decided by the puzzle source (default: the single built-in theme).

## 7. Determinism

- The daily puzzle seed includes the sorted `id@version` of every plugin that contributed to it,
  so the same date gives the same puzzle on every device that has the same plugin set.
- Stored progress records a `puzzleId` (`<dateKey>:<fingerprint>`). Progress saved under a
  different `puzzleId` is discarded the same way a different date is today.

## 8. Built-in `classic` plugin

Ships in the repo and provides today's content: the nine object kinds (chair, rug, water as
occupiable; table, shelf, plant, rock, tree, tv as blocking), all current clue types, the
victim/killer rule, the default theme, and the select, X and eraser tools. It is registered the
same way as any other plugin, with no special access.

## 9. Refactor plan (behavior-preserving)

1. Introduce the registry and plugin contract, with tests.
2. Move object kinds out of `engine/types.ts` into `classic`; `ObjectKind` becomes a string id.
3. Move clue types and the victim/killer rule into `classic`.
4. Move the room, suspect and sprite data into the default theme.
5. Add the dependency test: the kernel must not import `classic`.

Each step keeps the existing suite green and lands as its own commit.

## 10. Testing

- Registry: duplicate id, missing dependency, ordering, invalid definition.
- Contract tests run against every registered clue type and global rule: pure, deterministic,
  and the solver finds exactly one solution for a generated puzzle.
- Theme validator tests, including a deliberately broken theme that must be rejected.
- The existing engine, state and UI tests, unchanged, as the regression net.
- Dependency test for the kernel boundary (section 1).

## 11. IP note

Themes based on third-party properties (films, games, brands) need licensed or original content.
The repo ships only original or generic themes. Third-party themes are the owner's decision and
responsibility.

## 12. Out of scope

- Runtime loading of third-party code plugins; only data themes may be loaded at runtime later.
- A plugin marketplace or settings UI.
- Rendering multi-cell shapes, which is covered by the UI redesign.
- Additional puzzle sources beyond the daily generator.
