import type { SpriteDef, SpriteShape } from '../../engine/plugin'

function element(shape: SpriteShape, key: number) {
  const paint = {
    fill: shape.fill ?? 'none',
    stroke: shape.stroke ?? 'none',
    strokeWidth: shape.sw ?? 0,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  }
  switch (shape.kind) {
    case 'rect':
      return <rect key={key} x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.rx} {...paint} />
    case 'ellipse':
      return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...paint} />
    case 'path':
      return <path key={key} d={shape.d} {...paint} />
  }
}

/** Renders only the whitelisted fields of each shape, so sprite data can never inject attributes. */
export function Sprite({ sprite, className }: { sprite: SpriteDef; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      {sprite.shapes.map(element)}
    </svg>
  )
}
