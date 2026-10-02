import { useMemo, useState } from 'react'
import { registry } from './engine/registry'
import { dateKey } from './plugins/classic/daily'
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
  const puzzle = useMemo(() => registry.puzzleSource('daily').get(key), [key])
  const puzzleId = `${key}:${registry.fingerprint()}`
  return <Game puzzle={puzzle} dateKey={key} puzzleId={puzzleId} storage={localStorageOrNull()} />
}
