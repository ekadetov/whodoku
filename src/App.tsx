import { useMemo, useState } from 'react'
import { dailyPuzzle, dateKey } from './engine/daily'
import { Game } from './ui/Game'

function localStorageOrNull(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export default function App() {
  const [key] = useState(() => dateKey(new Date()))
  const puzzle = useMemo(() => dailyPuzzle(key), [key])
  return <Game puzzle={puzzle} dateKey={key} storage={localStorageOrNull()} />
}
