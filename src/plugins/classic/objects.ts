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
