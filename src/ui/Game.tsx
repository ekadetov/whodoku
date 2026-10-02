import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { answerOf, evaluate, isLegalPlacement, isSolved, renderClue } from '../engine/clues'
import { suspectHints } from '../engine/hints'
import { registry } from '../engine/registry'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { newGame, posKey, reduce } from '../state/reducer'
import { loadState, saveState } from '../state/storage'
import type { ReadableStorage, WritableStorage } from '../state/storage'
import { currentStreak, recordSolve } from '../state/streak'
import { Board } from './Board'
import { NO_HIGHLIGHT } from './highlight'
import type { Highlight } from './highlight'
import { SuspectPanel } from './SuspectPanel'
import { ToolsPanel } from './ToolsPanel'

interface GameProps {
  puzzle: Puzzle
  dateKey: string
  puzzleId?: string
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

export function Game({ puzzle, dateKey, puzzleId, storage, now = Date.now }: GameProps) {
  const [saved, setSaved] = useState(() => loadState(storage))
  const [game, dispatch] = useReducer(reduce, undefined, () =>
    saved.today?.dateKey === dateKey && saved.today.puzzleId === puzzleId
      ? { ...newGame(dateKey, now(), puzzleId), progress: saved.today }
      : newGame(dateKey, now(), puzzleId),
  )
  const [notice, setNotice] = useState('')
  const [check, setCheck] = useState<{ key: string; failing: number[] } | null>(null)
  const [accusing, setAccusing] = useState(false)
  const [help, setHelp] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const { progress, selected, tool } = game
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
  const active = hovered ?? selected
  const highlight = useMemo<Highlight>(() => {
    if (active === null) return NO_HIGHLIGHT
    const hint = suspectHints(puzzle, active)
    return {
      cells: new Set(hint.cells.map(posKey)),
      rooms: new Set(hint.rooms),
      suspects: new Set(hint.suspects),
    }
  }, [puzzle, active])
  const selectedClue =
    selected === null
      ? null
      : puzzle.clues
          .filter((clue) => clue.suspect === selected)
          .map((clue) => renderClue(clue, puzzle))
          .join(' ')
  const readyToAccuse = complete !== null && !solved && isSolved(puzzle, complete)
  const culprit = complete !== null ? answerOf(puzzle, complete) : null

  const onCellClick = (pos: Pos) => {
    if (solved || !isOccupiable(puzzle.cells[pos.r][pos.c])) return
    if (selected !== null) {
      dispatch({ type: 'place', pos, cross: [] })
      return
    }
    const occupant = Object.entries(progress.placements).find(([, p]) => posKey(p) === posKey(pos))
    if (occupant) dispatch({ type: 'select', suspect: Number(occupant[0]) })
  }

  const runCheck = (): boolean => {
    if (complete === null) {
      setNotice('Place every suspect before checking.')
      return false
    }
    if (!isLegalPlacement(puzzle, complete)) {
      setNotice('Two suspects share a row or column.')
      return false
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
    return bad.length === 0
  }

  const onSubmit = () => {
    if (runCheck()) setAccusing(true)
  }

  const onClearAll = () => {
    if (window.confirm('Clear the whole board?')) dispatch({ type: 'reset' })
  }

  const onAccuse = (suspect: number) => {
    if (suspect !== culprit) {
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
      <header className="topbar">
        <h1>Whodoku</h1>
        <p className="sub">
          Daily puzzle {dateKey} (UTC) &middot; Streak {streak} &middot; Best {saved.streak.best}
        </p>
      </header>

      {help && (
        <section className="how" aria-label="How to play">
          <ul>
            <li>Place every suspect on the grid. Nobody may share a row or column with another suspect.</li>
            <li>Blocked squares (tables, shelves, plants, rocks, trees, TVs) cannot be occupied.</li>
            <li>Each clue is about the suspect it names. Rooms are outlined in dark borders.</li>
            <li>The victim was alone with the killer. Once everything fits, name the killer.</li>
            <li>Tap a suspect, then a square, or drag a suspect onto the grid.</li>
            <li>Pick the X tool and drag across squares to cross them out. The eraser clears squares; hold it to clear the board.</li>
          </ul>
        </section>
      )}

      <div className="stage">
        <SuspectPanel
          puzzle={puzzle}
          placements={progress.placements}
          selected={selected}
          struck={progress.struck}
          failing={failing}
          linked={highlight.suspects}
          boardRef={boardRef}
          onSelect={(suspect) => dispatch({ type: 'select', suspect })}
          onToggleStrike={(suspect) => dispatch({ type: 'toggleStrike', suspect })}
          onHover={setHovered}
          onDrop={(suspect, pos) => {
            if (solved) return
            dispatch({ type: 'select', suspect })
            dispatch({ type: 'place', pos, cross: [] })
          }}
        />

        <section className="play">
          <Board
            puzzle={puzzle}
            placements={progress.placements}
            marks={marks}
            selected={selected}
            conflicts={conflicts}
            tool={registry.tools().find((t) => t.id === tool)}
            highlight={highlight}
            selectedClue={selectedClue}
            gridRef={boardRef}
            onCellClick={onCellClick}
            onStroke={(cells, mode) => dispatch({ type: 'paint', cells, mode })}
          />

          <p className="notice" role="status">
            {notice}
          </p>

          {accusing && readyToAccuse && (
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

          {solved && culprit !== null && (
            <section className="win" aria-label="Case closed">
              <h2>Case closed!</h2>
              <p>
                {puzzle.suspects[culprit].name} did it. Solved in {formatDuration(progress.solvedAt! - progress.startedAt)}.
              </p>
              <p>
                Streak: {saved.streak.current} &middot; Best: {saved.streak.best}. Come back tomorrow for a new case.
              </p>
            </section>
          )}
        </section>

        <ToolsPanel
          tools={registry.tools()}
          active={tool}
          canUndo={game.history.length > 0}
          canSubmit={allPlaced}
          locked={solved}
          helpOpen={help}
          onTool={(id) => dispatch({ type: 'setTool', tool: id })}
          onUndo={() => dispatch({ type: 'undo' })}
          onHint={runCheck}
          onSubmit={onSubmit}
          onClearAll={onClearAll}
          onToggleHelp={() => setHelp((open) => !open)}
        />
      </div>
    </main>
  )
}
