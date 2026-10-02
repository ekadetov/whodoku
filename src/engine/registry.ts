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
