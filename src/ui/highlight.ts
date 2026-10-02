export interface Highlight {
  cells: ReadonlySet<string>
  rooms: ReadonlySet<number>
  suspects: ReadonlySet<number>
}

export const NO_HIGHLIGHT: Highlight = { cells: new Set(), rooms: new Set(), suspects: new Set() }
