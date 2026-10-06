import { describe, expect, test } from 'claude-code/testing'

import { COLOR, GLOW_MS, glow } from '../src/graph'

describe('the map', () => {
  test('a used tool glows and fades to nothing', () => {
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000)).toBe(1)
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000 + GLOW_MS / 2)).toBe(0.5)
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000 + GLOW_MS * 2)).toBe(0)
    expect(glow({}, 'skill:a', 5)).toBe(0)
  })

  test('every category has a color', () => {
    for (const cat of ['build', 'write', 'research', 'design', 'web', 'data', 'security', 'docs', 'setup', 'other']) expect(COLOR[cat]).toBeDefined()
  })
})
