import type { ObjectKind } from '../engine/types'

export const GLYPH: Record<ObjectKind, string> = {
  chair: '\u{1FA91}',
  rug: '\u{25A6}',
  water: '\u{1F4A7}',
  table: '\u{1F7EB}',
  shelf: '\u{1F4DA}',
  plant: '\u{1FAB4}',
  rock: '\u{1FAA8}',
  tree: '\u{1F333}',
  tv: '\u{1F4FA}',
}

const ROOM_HUES = [200, 30, 120, 280, 0, 60, 170, 320, 90, 240, 15, 150]

export const roomHue = (room: number): number => ROOM_HUES[room % ROOM_HUES.length]

export const suspectColor = (suspect: number): string => `hsl(${(suspect * 47) % 360} 65% 42%)`
