// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SpriteDef } from '../../engine/plugin'
import { Sprite } from './Sprite'

afterEach(cleanup)

describe('Sprite', () => {
  it('draws one element per shape on a 100 x 100 canvas', () => {
    const sprite: SpriteDef = {
      shapes: [
        { kind: 'rect', x: 1, y: 2, w: 3, h: 4, fill: 'red' },
        { kind: 'ellipse', cx: 5, cy: 6, rx: 7, ry: 8, stroke: 'blue', sw: 2 },
        { kind: 'path', d: 'M0 0 L10 10', stroke: 'black', sw: 1 },
      ],
    }
    const { container } = render(<Sprite sprite={sprite} />)
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 100 100')
    expect(container.querySelectorAll('rect, ellipse, path')).toHaveLength(3)
    expect(container.querySelector('rect')).toHaveAttribute('width', '3')
    expect(container.querySelector('ellipse')).toHaveAttribute('stroke-width', '2')
  })

  it('ignores fields outside the whitelist', () => {
    const hostile = { kind: 'rect', x: 0, y: 0, w: 5, h: 5, onload: 'alert(1)', href: 'javascript:x' } as never
    const { container } = render(<Sprite sprite={{ shapes: [hostile] }} />)
    const rect = container.querySelector('rect')!
    expect(rect).not.toHaveAttribute('onload')
    expect(rect).not.toHaveAttribute('href')
  })
})
