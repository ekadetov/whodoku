import { useEffect, useRef } from 'react'
import type { ToolDef } from '../engine/plugin'

interface ToolsPanelProps {
  tools: readonly ToolDef[]
  active: string
  canUndo: boolean
  canSubmit: boolean
  locked: boolean
  helpOpen: boolean
  onTool: (id: string) => void
  onUndo: () => void
  onHint: () => void
  onSubmit: () => void
  onClearAll: (toolId: string) => void
  onToggleHelp: () => void
}

const HOLD_MS = 800

function ToolIcon({ id }: { id: string }) {
  if (id === 'x') {
    return (
      <svg viewBox="0 0 100 100" className="tool-icon" aria-hidden="true">
        <path d="M20 20L80 80M80 20L20 80" />
      </svg>
    )
  }
  if (id === 'eraser') {
    return (
      <svg viewBox="0 0 100 100" className="tool-icon eraser" aria-hidden="true">
        <path d="M18 62L52 18L82 40L48 84H30Z" />
        <path d="M34 44L66 66" />
      </svg>
    )
  }
  return null
}

interface ToolButtonProps {
  tool: ToolDef
  active: boolean
  disabled: boolean
  onPick: () => void
  onHold: () => void
}

function ToolButton({ tool, active, disabled, onPick, onHold }: ToolButtonProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const stop = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])

  return (
    <button
      type="button"
      data-testid={`tool-${tool.id}`}
      className={`tool${active ? ' active' : ''}`}
      aria-pressed={active}
      disabled={disabled}
      onPointerDown={() => {
        held.current = false
        if (!tool.holdToClear) return
        timer.current = setTimeout(() => {
          held.current = true
          onHold()
        }, HOLD_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (held.current) {
          held.current = false
          return
        }
        onPick()
      }}
    >
      <ToolIcon id={tool.id} />
      <span>{tool.label}</span>
      {tool.holdToClear && <small>hold to clear all</small>}
    </button>
  )
}

export function ToolsPanel({
  tools,
  active,
  canUndo,
  canSubmit,
  locked,
  helpOpen,
  onTool,
  onUndo,
  onHint,
  onSubmit,
  onClearAll,
  onToggleHelp,
}: ToolsPanelProps) {
  return (
    <aside className="tools" aria-label="Tools">
      <h2 className="tools-title">Tools</h2>
      {tools
        .filter((tool) => tool.paint)
        .map((tool) => (
          <ToolButton
            key={tool.id}
            tool={tool}
            active={active === tool.id}
            disabled={locked}
            onPick={() => onTool(active === tool.id ? 'select' : tool.id)}
            onHold={() => onClearAll(tool.id)}
          />
        ))}
      <button type="button" className="action" disabled={locked || !canUndo} onClick={onUndo}>
        Undo
      </button>
      <span className="tools-gap" />
      <button type="button" className="action" disabled={locked} onClick={onHint}>
        Hint
      </button>
      <button type="button" className="action submit" disabled={locked || !canSubmit} onClick={onSubmit}>
        Submit
        {!canSubmit && !locked && <small>(place everyone first)</small>}
      </button>
      <button type="button" className="action" aria-expanded={helpOpen} onClick={onToggleHelp}>
        How to play
      </button>
    </aside>
  )
}
