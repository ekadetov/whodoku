import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { answerOf, evaluate, isLegalPlacement, renderClue } from '../engine/clues'
import { suspectHints } from '../engine/hints'
import { registry } from '../engine/registry'
import { solve } from '../engine/solver'
import { isOccupiable } from '../engine/types'
import type { Pos, Puzzle } from '../engine/types'
import { isFinished, newGame, posKey, reduce } from '../state/reducer'
import { loadState, saveState } from '../state/storage'
import type { ReadableStorage, WritableStorage } from '../state/storage'
import { currentStreak, recordSolve } from '../state/streak'
import { Board } from './Board'
import { NO_HIGHLIGHT } from './highlight'
import type { Highlight } from './highlight'
import { ResultDialog } from './ResultDialog'
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

type Phase = 'play' | 'stamp' | 'result' | 'done'

const STAMP_MS = 1400

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
  const [help, setHelp] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)

  const { progress, selected, tool } = game
  const solved = progress.solvedAt !== null
  const finished = isFinished(progress)
  const [phase, setPhase] = useState<Phase>(() => (isFinished(game.progress) ? 'result' : 'play'))

  useEffect(() => {
    if (phase !== 'stamp') return
    const timer = setTimeout(() => setPhase('result'), STAMP_MS)
    return () => clearTimeout(timer)
  }, [phase])

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
  const active = hovered !== null && !progress.placements[hovered] ? hovered : selected
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
  const culprit = complete !== null ? answerOf(puzzle, complete) : null
  const verdict = useMemo(() => {
    const answer = finished ? solve(puzzle) : null
    if (!answer) return undefined
    return new Map(
      puzzle.suspects.map((_, i) => {
        const pos = progress.placements[i]
        return [i, pos !== undefined && pos.r === answer[i].r && pos.c === answer[i].c] as const
      }),
    )
  }, [finished, puzzle, progress.placements])
  const correct = verdict ? [...verdict.values()].filter(Boolean).length : 0

  const crossesFor = (pos: Pos): Pos[] =>
    puzzle.cells.flatMap((row, r) =>
      row.flatMap((cell, c) => ((r === pos.r) !== (c === pos.c) && isOccupiable(cell) ? [{ r, c }] : [])),
    )

  const onHold = (pos: Pos) => {
    if (!finished) dispatch({ type: 'place', pos, cross: crossesFor(pos) })
  }

  const onCellClick = (pos: Pos) => {
    if (finished || !isOccupiable(puzzle.cells[pos.r][pos.c])) return
    if (selected !== null) dispatch({ type: 'toggleNote', pos, suspect: selected })
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
        ? 'Everything fits. Press Submit when you are sure.'
        : `${bad.length} suspect${bad.length === 1 ? '' : 's'} contradict their clues.`,
    )
    return bad.length === 0
  }

  const onSubmit = () => {
    if (complete === null || finished) return
    const answer = solve(puzzle)
    const at = now()
    if (answer && complete.every((pos, i) => pos.r === answer[i].r && pos.c === answer[i].c)) {
      dispatch({ type: 'solved', at })
      setSaved((s) => ({
        ...s,
        history: { ...s.history, [dateKey]: { solved: true, seconds: Math.round((at - progress.startedAt) / 1000) } },
        streak: recordSolve(s.streak, dateKey),
      }))
      setPhase('stamp')
    } else {
      dispatch({ type: 'failed', at })
      setPhase('result')
    }
  }

  const onClearAll = (toolId: string) => {
    dispatch({ type: 'setTool', tool: toolId })
    dispatch({ type: 'reset' })
  }

  const onPlayAgain = () => {
    dispatch({ type: 'restart', now: now() })
    setCheck(null)
    setNotice('')
    setPhase('play')
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
            <li>The victim was alone with the murderer. Place everyone, then press Submit.</li>
            <li>Tap a suspect, then a square to leave a note. Press and hold a square to place the suspect there.</li>
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
            if (finished) return
            dispatch({ type: 'select', suspect })
            dispatch({ type: 'place', pos, cross: crossesFor(pos) })
          }}
        />

        <section className="play">
          <Board
            puzzle={puzzle}
            placements={progress.placements}
            marks={marks}
            selected={selected}
            notes={progress.notes ?? {}}
            verdict={verdict}
            conflicts={conflicts}
            tool={registry.tools().find((t) => t.id === tool)}
            highlight={highlight}
            selectedClue={selectedClue}
            gridRef={boardRef}
            onCellClick={onCellClick}
            onHold={onHold}
            onStroke={(cells, mode) => dispatch({ type: 'paint', cells, mode })}
          />

          <p className="notice" role="status">
            {notice}
          </p>

        </section>

        <ToolsPanel
          tools={registry.tools()}
          active={tool}
          canUndo={game.history.length > 0}
          canSubmit={allPlaced}
          locked={finished}
          helpOpen={help}
          onTool={(id) => dispatch({ type: 'setTool', tool: id })}
          onUndo={() => dispatch({ type: 'undo' })}
          onHint={runCheck}
          onSubmit={onSubmit}
          onClearAll={onClearAll}
          onToggleHelp={() => setHelp((open) => !open)}
        />
      </div>

      {(phase === 'stamp' || phase === 'result') && <div className="curtain" aria-hidden="true" />}
      {phase === 'stamp' && (
        <div className="stamp" aria-hidden="true">
          CASE SOLVED
        </div>
      )}
      {phase === 'result' && finished && (
        <ResultDialog
          message={
            solved && culprit !== null
              ? `You've found the murderer! ${puzzle.suspects[culprit].name} (${puzzle.suspects[culprit].name[0]}) killed ${puzzle.suspects[puzzle.victim].name} (${puzzle.suspects[puzzle.victim].name[0]})!`
              : `You did not find everyone's position! ${correct} of ${puzzle.suspects.length} correct. The murderer escaped!`
          }
          detail={
            solved
              ? `Solved in ${formatDuration(progress.solvedAt! - progress.startedAt)}. Streak: ${saved.streak.current}, best: ${saved.streak.best}. Come back tomorrow for a new case.`
              : undefined
          }
          onClose={() => setPhase('done')}
          onPlayAgain={solved ? undefined : onPlayAgain}
        />
      )}
    </main>
  )
}
