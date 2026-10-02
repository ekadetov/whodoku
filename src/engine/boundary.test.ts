import { describe, expect, it } from 'vitest'

const sources = import.meta.glob(
  ['../engine/**/*.{ts,tsx}', '../state/**/*.{ts,tsx}', '../ui/**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

describe('kernel boundary', () => {
  it('scans the kernel, state and UI sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })

  it('keeps plugin code out of the kernel, state and UI', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /(from|import)\s*['"][^'"]*\/plugins(\/|['"])/.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })
})
