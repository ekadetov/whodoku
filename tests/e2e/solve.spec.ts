import { expect, test } from '@playwright/test'
import { answerOf } from '../../src/engine/clues'
import { solve } from '../../src/engine/solver'
import { registerBuiltins } from '../../src/plugins'
import { dailyPuzzle } from '../../src/plugins/classic/daily'

const DAY = '2026-10-02'

registerBuiltins()

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${DAY}T12:00:00Z`))
})

test('solves the daily puzzle through the UI and keeps the result after reload', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const placement = solve(puzzle)!
  const killer = answerOf(puzzle, placement)!

  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Whodoku' })).toBeVisible()
  await expect(page.getByText(`Daily puzzle ${DAY}`)).toBeVisible()

  for (const [i, pos] of placement.entries()) {
    await page.getByTestId(`suspect-${i}`).click()
    await page.getByTestId(`cell-${pos.r}-${pos.c}`).click()
  }

  await page.getByRole('button', { name: /Submit/ }).click()
  await page.getByTestId(`accuse-${killer}`).click()
  await expect(page.getByText('Case closed!')).toBeVisible()
  await expect(page.getByText(`${puzzle.suspects[killer].name} did it`)).toBeVisible()

  await page.reload()
  await expect(page.getByText('Case closed!')).toBeVisible()
  await expect(page.getByText('Streak 1')).toBeVisible()
})
