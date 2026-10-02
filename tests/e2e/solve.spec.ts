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

test('crosses out a row by dragging the X tool and undoes it in one step', async ({ page }) => {
  await page.goto('./')
  const row = page.locator('[data-testid^="cell-0-"]')
  const size = await row.count()
  const open = await page.locator('[data-testid^="cell-0-"]:not([aria-disabled="true"])').count()
  const box = (await page.getByRole('grid').boundingBox())!
  const y = box.y + box.height / size / 2

  await page.getByTestId('tool-x').click()
  await page.mouse.move(box.x + 4, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 4, y, { steps: 12 })
  await page.mouse.up()
  await expect(page.locator('[data-testid^="cell-0-"][data-marked="true"]')).toHaveCount(open)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.locator('[data-testid^="cell-0-"][data-marked="true"]')).toHaveCount(0)
})

test('places a suspect by dragging its card onto the board', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const target = solve(puzzle)![0]
  await page.goto('./')
  const card = (await page.getByTestId('suspect-0').boundingBox())!
  const cell = (await page.getByTestId(`cell-${target.r}-${target.c}`).boundingBox())!

  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.mouse.move(cell.x + cell.width / 2, cell.y + cell.height / 2, { steps: 12 })
  await page.mouse.up()
  await expect(page.getByTestId(`cell-${target.r}-${target.c}`)).toHaveAttribute('data-occupant', '0')
})
