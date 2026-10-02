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
