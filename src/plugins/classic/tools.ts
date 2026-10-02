import type { ToolDef } from '../../engine/plugin'

export const TOOLS: readonly ToolDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'x', label: 'Mark', paint: ({ marked }) => (marked ? 'unmark' : 'mark') },
  { id: 'eraser', label: 'Eraser', paint: () => 'erase', holdToClear: true },
]
