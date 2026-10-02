import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { answerOf } from '../../src/engine/clues'
import { solve } from '../../src/engine/solver'
import { registerBuiltins } from '../../src/plugins'
import { dailyPuzzle } from '../../src/plugins/classic/daily'

const DAY = '2026-10-02'

registerBuiltins()

async function holdOn(page: Page, r: number, c: number) {
  const box = (await page.getByTestId(`cell-${r}-${c}`).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(750)
  await page.mouse.up()
}

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
    await holdOn(page, pos.r, pos.c)
    await expect(page.getByTestId(`cell-${pos.r}-${pos.c}`)).toHaveAttribute('data-occupant', String(i))
  }

  const name = (i: number) => puzzle.suspects[i].name
  await page.getByRole('button', { name: /Submit/ }).click()
  await expect(page.getByText('CASE SOLVED')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText(
    `You've found the murderer! ${name(killer)} (${name(killer)[0]}) killed ${name(puzzle.victim)} (${name(puzzle.victim)[0]})!`,
  )

  await page.reload()
  await expect(page.getByRole('dialog')).toContainText("You've found the murderer!")
  await expect(page.getByText('Streak 1', { exact: false }).first()).toBeVisible()
})

test('leaves notes on a click, places on a hold with crosses, and undoes the placement', async ({ page }) => {
  const puzzle = dailyPuzzle(DAY)
  const target = solve(puzzle)![0]
  await page.goto('./')

  await page.getByTestId('suspect-0').click()
  await page.getByTestId(`cell-${target.r}-${target.c}`).click()
  await expect(page.getByTestId(`cell-${target.r}-${target.c}`).locator('.note')).toHaveText(puzzle.suspects[0].name[0])
  await page.getByTestId(`cell-${target.r}-${target.c}`).click()
  await expect(page.locator('.note')).toHaveCount(0)

  await holdOn(page, target.r, target.c)
  await expect(page.getByTestId(`cell-${target.r}-${target.c}`)).toHaveAttribute('data-occupant', '0')
  await expect(page.locator('[data-marked="true"]').first()).toBeVisible()
  await expect(page.getByTestId('suspect-0').locator('xpath=ancestor::li')).toHaveClass(/placed/)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByTestId(`cell-${target.r}-${target.c}`)).not.toHaveAttribute('data-occupant')
  await expect(page.locator('[data-marked="true"]')).toHaveCount(0)
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
