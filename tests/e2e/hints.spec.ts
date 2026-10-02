import { expect, test } from '@playwright/test'
import { suspectHints } from '../../src/engine/hints'
import { registerBuiltins } from '../../src/plugins'
import { dailyPuzzle } from '../../src/plugins/classic/daily'

const DAY = '2026-10-02'

registerBuiltins()

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00Z`))
})

test('hovering a card lights what its clue names', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const suspect = puzzle.suspects.findIndex((_, i) => suspectHints(puzzle, i).cells.length > 0)
  const expected = suspectHints(puzzle, suspect).cells.length

  await page.goto('./')
  await page.getByTestId(`suspect-${suspect}`).hover()
  await expect(page.locator('.cell.hint')).toHaveCount(expected)
  await page.mouse.move(1, 1)
  await expect(page.locator('.cell.hint')).toHaveCount(0)
})

test('a selected card keeps its hints and explains cells as you hover them', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const suspect = puzzle.suspects.findIndex((_, i) => suspectHints(puzzle, i).cells.length > 0)
  const expected = suspectHints(puzzle, suspect).cells.length

  await page.goto('./')
  await page.getByTestId(`suspect-${suspect}`).click()
  await page.mouse.move(1, 1)
  await expect(page.locator('.cell.hint')).toHaveCount(expected)

  await page.locator('[data-testid^="cell-"]:not([aria-disabled="true"])').first().hover()
  await expect(page.locator('.tip.clue')).toContainText(`${puzzle.suspects[suspect].name} was`)
})

test('relation words in clues carry a glossary entry', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('b.term').first()).toHaveAttribute('data-tip', /.+/)
})
