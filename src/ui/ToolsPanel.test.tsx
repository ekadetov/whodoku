// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ToolDef } from '../engine/plugin'
import { ToolsPanel } from './ToolsPanel'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select' },
  { id: 'x', label: 'Mark', paint: () => 'mark' },
  { id: 'eraser', label: 'Eraser', paint: () => 'erase', holdToClear: true },
]

function setup(overrides: Partial<Parameters<typeof ToolsPanel>[0]> = {}) {
  const handlers = {
    onTool: vi.fn(),
    onUndo: vi.fn(),
    onHint: vi.fn(),
    onSubmit: vi.fn(),
    onClearAll: vi.fn(),
    onToggleHelp: vi.fn(),
  }
  render(
    <ToolsPanel
      tools={TOOLS}
      active="select"
      canUndo
      canSubmit
      locked={false}
      helpOpen={false}
      {...handlers}
      {...overrides}
    />,
  )
  return handlers
}

describe('ToolsPanel', () => {
  it('lists the stroke tools but not the implicit select tool', () => {
    setup()
    expect(screen.getByTestId('tool-x')).toBeInTheDocument()
    expect(screen.getByTestId('tool-eraser')).toBeInTheDocument()
    expect(screen.queryByTestId('tool-select')).toBeNull()
  })

  it('picks a tool, and a second press on the active tool goes back to select', () => {
    const { onTool } = setup()
    fireEvent.click(screen.getByTestId('tool-x'))
    expect(onTool).toHaveBeenLastCalledWith('x')
    cleanup()
    const again = setup({ active: 'x' })
    expect(screen.getByTestId('tool-x')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('tool-x'))
    expect(again.onTool).toHaveBeenLastCalledWith('select')
  })

  it('clears the whole board only when the eraser is held', () => {
    vi.useFakeTimers()
    const { onClearAll, onTool } = setup()
    const eraser = screen.getByTestId('tool-eraser')
    fireEvent.pointerDown(eraser)
    act(() => vi.advanceTimersByTime(900))
    fireEvent.pointerUp(eraser)
    fireEvent.click(eraser)
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onClearAll).toHaveBeenCalledWith('eraser')
    expect(onTool).not.toHaveBeenCalled()

    fireEvent.pointerDown(eraser)
    act(() => vi.advanceTimersByTime(200))
    fireEvent.pointerUp(eraser)
    fireEvent.click(eraser)
    expect(onClearAll).toHaveBeenCalledTimes(1)
    expect(onTool).toHaveBeenCalledWith('eraser')
  })

  it('disables undo with nothing to undo, and everything once locked', () => {
    setup({ canUndo: false })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    cleanup()
    setup({ locked: true })
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled()
    expect(screen.getByTestId('tool-x')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled()
  })

  it('only enables submit once everyone is placed', () => {
    setup({ canSubmit: false })
    expect(screen.getByRole('button', { name: /Submit/ })).toBeDisabled()
    cleanup()
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('wires hint, undo and the rules toggle', () => {
    const { onHint, onUndo, onToggleHelp } = setup({ helpOpen: true })
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    fireEvent.click(screen.getByRole('button', { name: 'How to play' }))
    expect(onHint).toHaveBeenCalled()
    expect(onUndo).toHaveBeenCalled()
    expect(onToggleHelp).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'How to play' })).toHaveAttribute('aria-expanded', 'true')
  })
})
