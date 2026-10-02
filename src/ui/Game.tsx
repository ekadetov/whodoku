import { useEffect, useMemo, useReducer, useState } from 'react'
import { evaluate, isLegalPlacement, isSolved, killerOf } from '../engine/clues'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { newGame, posKey, reduce } from '../state/reducer'
import { loadState, saveState } from '../state/storage'
import type { ReadableStorage, WritableStorage } from '../state/storage'
import { currentStreak, recordSolve } from '../state/streak'
import { Board } from './Board'
import { CluePanel } from './CluePanel'
import { Legend } from './Legend'
import { SuspectTray } from './SuspectTray'

interface GameProps {
  puzzle: Puzzle
  dateKey: string
  storage: (ReadableStorage & WritableStorage) | null
  now?: () => number
}

function findConflicts(placements: Record<number, Pos>): Set<string> {
  const entries = Object.values(placements)
  const conflicts = new Set<string>()
  for (const a of entries) {
    for (const b of entries) {
      if (a !== b && (a.r === b.r || a.c === b.c)) conflicts.add(posKey(a))
    }
  }
  return conflicts
}

function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  return minutes > 0 ? `${minutes} min ${total % 60} s` : `${total} s`
}

export function Game({ puzzle, dateKey, storage, now = Date.now }: GameProps) {
  const [saved, setSaved] = useState(() => loadState(storage))
  const [game, dispatch] = useReducer(reduce, undefined, () =>
    saved.today?.dateKey === dateKey ? { progress: saved.today, selected: null } : newGame(dateKey, now()),
  )
  const [notice, setNotice] = useState('')
  const [check, setCheck] = useState<{ key: string; failing: number[] } | null>(null)

  const { progress, selected } = game
  const solved = progress.solvedAt !== null

  useEffect(() => {
    saveState(storage, { ...saved, today: progress })
  }, [storage, saved, progress])

  const placementList = puzzle.suspects.map((_, i) => progress.placements[i])
  const allPlaced = placementList.every((pos) => pos !== undefined)
  const complete = allPlaced ? placementList : null
  const placementKey = JSON.stringify(progress.placements)
  const conflicts = useMemo(() => findConflicts(progress.placements), [progress.placements])
  const marks = useMemo(() => new Set(progress.marks), [progress.marks])
  const failing = new Set(check?.key === placementKey ? check.failing : [])
  const readyToAccuse = complete !== null && !solved && isSolved(puzzle, complete)
  const killer = complete !== null ? killerOf(puzzle, complete) : null

  const onCellClick = (pos: Pos) => {
    if (solved || !isOccupiable(puzzle.cells[pos.r][pos.c])) return
    if (selected !== null) {
      dispatch({ type: 'place', pos })
      return
    }
    const occupant = Object.entries(progress.placements).find(([, p]) => posKey(p) === posKey(pos))
    if (occupant) dispatch({ type: 'select', suspect: Number(occupant[0]) })
    else dispatch({ type: 'toggleMark', pos })
  }

  const onCheck = () => {
    if (complete === null) {
      setNotice('Place every suspect before checking.')
      return
    }
    if (!isLegalPlacement(puzzle, complete)) {
      setNotice('Two suspects share a row or column.')
      return
    }
    const bad = puzzle.suspects
      .map((_, i) => i)
      .filter((i) => puzzle.clues.some((clue) => clue.suspect === i && !evaluate(clue, puzzle, complete)))
    setCheck({ key: placementKey, failing: bad })
    setNotice(
      bad.length === 0
        ? 'Everything fits. Now name the killer.'
        : `${bad.length} suspect${bad.length === 1 ? '' : 's'} contradict their clues.`,
    )
  }

  const onAccuse = (suspect: number) => {
    if (suspect !== killer) {
      setNotice(`${puzzle.suspects[suspect].name} is innocent. Think again.`)
      return
    }
    const at = now()
    dispatch({ type: 'solved', at })
    setSaved((s) => ({
      ...s,
      history: { ...s.history, [dateKey]: { solved: true, seconds: Math.round((at - progress.startedAt) / 1000) } },
      streak: recordSolve(s.streak, dateKey),
    }))
    setNotice('')
  }

  const streak = currentStreak(saved.streak, dateKey)

  return (
    <main className="game">
      <header>
        <h1>Whodoku</h1>
        <p className="sub">
          Daily puzzle {dateKey} (UTC) &middot; Streak {streak} &middot; Best {saved.streak.best}
        </p>
      </header>

      <details className="how">
        <summary>How to play</summary>
        <ul>
          <li>Place every suspect on the grid. Nobody may share a row or column with another suspect.</li>
          <li>Blocked squares (tables, shelves, plants, rocks, trees, TVs) cannot be occupied.</li>
          <li>Each clue is about the suspect it names. Rooms are outlined in dark borders.</li>
          <li>The victim was alone with the killer. Once everything fits, name the killer.</li>
          <li>Tap a suspect, then a square. Tap an empty square with nobody selected to mark it with an x.</li>
        </ul>
      </details>

      <SuspectTray
        puzzle={puzzle}
        placements={progress.placements}
        selected={selected}
        onSelect={(suspect) => dispatch({ type: 'select', suspect })}
      />

      <Board
        puzzle={puzzle}
        placements={progress.placements}
        marks={marks}
        selected={selected}
        conflicts={conflicts}
        onCellClick={onCellClick}
      />

      <Legend puzzle={puzzle} />

      <div className="toolbar">
        <button type="button" onClick={onCheck} disabled={solved}>
          Check
        </button>
        <button
          type="button"
          onClick={() => selected !== null && dispatch({ type: 'remove', suspect: selected })}
          disabled={solved || selected === null || !progress.placements[selected]}
        >
          Remove selected
        </button>
        <button type="button" onClick={() => dispatch({ type: 'reset' })} disabled={solved}>
          Reset
        </button>
      </div>

      <p className="notice" role="status">
        {notice}
      </p>

      {readyToAccuse && (
        <section className="accuse" aria-label="Accusation">
          <h2>Who did it?</h2>
          <div className="accuse-buttons">
            {puzzle.suspects.map(
              (suspect, i) =>
                i !== puzzle.victim && (
                  <button key={suspect.name} type="button" data-testid={`accuse-${i}`} onClick={() => onAccuse(i)}>
                    {suspect.name}
                  </button>
                ),
            )}
          </div>
        </section>
      )}

      {solved && killer !== null && (
        <section className="win" aria-label="Case closed">
          <h2>Case closed!</h2>
          <p>
            {puzzle.suspects[killer].name} did it. Solved in {formatDuration(progress.solvedAt! - progress.startedAt)}.
          </p>
          <p>
            Streak: {saved.streak.current} &middot; Best: {saved.streak.best}. Come back tomorrow for a new case.
          </p>
        </section>
      )}

      <h2>Clues</h2>
      <CluePanel
        puzzle={puzzle}
        struck={progress.struck}
        failing={failing}
        onToggleStrike={(suspect) => dispatch({ type: 'toggleStrike', suspect })}
      />
    </main>
  )
}
