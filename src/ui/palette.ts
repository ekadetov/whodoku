const ROOM_HUES = [200, 30, 120, 280, 0, 60, 170, 320, 90, 240, 15, 150]

export const roomHue = (room: number): number => ROOM_HUES[room % ROOM_HUES.length]

export const suspectColor = (suspect: number): string => `hsl(${(suspect * 47) % 360} 65% 42%)`
