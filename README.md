# Whodoku

A free, browser-based daily murder-mystery logic puzzle. One puzzle per day, the same for every
player, generated entirely in the browser (no backend). Installable as a PWA and playable offline.

## How to play

- Place every suspect on the grid. No two suspects may share a row or a column.
- Blocked squares (tables, shelves, plants, rocks, trees, TVs) cannot be occupied.
- Each suspect has one or two clues. Rooms are outlined with dark borders and labeled.
- The victim was alone with the killer. Once everyone fits, name the killer.
- "Beside" means directly up, down, left or right, within the same room.

The daily puzzle changes at 00:00 UTC. Difficulty follows the weekday: Mon and Tue are easy
(6x6), Wed and Thu medium (8x8), Fri to Sun hard (9x9).

## Development

```bash
npm install
npm run dev          # local dev server
npm test             # unit and component tests (Vitest)
npm run typecheck    # tsc -b
npm run lint         # oxlint
npm run test:e2e     # Playwright smoke test (builds and serves the app)
npm run build        # production build into dist/
```

Playwright needs a browser once: `npx playwright install chromium`.

### Layout

- `src/engine/` pure TypeScript: seeded RNG, clue evaluation and text, backtracking solver with
  solution counting, procedural layouts, the clue generator and the daily seed. Every generated
  puzzle is verified to have exactly one solution.
- `src/state/` reducer, versioned localStorage persistence and streak logic.
- `src/ui/` React components.
- `docs/design/` the spec and implementation plan.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`, which tests, builds and publishes `dist/`
to GitHub Pages. The Vite `base` is `/whodoku/`; change it if the site moves to a custom domain.

## Legal

Whodoku is an independent project. The genre it draws on ("Murdoku", by Manuel Garand) is a
commercial product; its name, art, themes and published puzzles are not used here. Do a
trademark search on the name before launching commercially.

## License

MIT
