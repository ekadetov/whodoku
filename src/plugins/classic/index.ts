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
