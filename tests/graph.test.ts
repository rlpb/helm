import { describe, expect, test } from 'claude-code/testing'

import { GLOW_MS, cells, glow, layout, svg } from '../src/graph'
import type { Entry } from '../types'

const entry = (key: string, category: string, on = true): Entry => ({ key, kind: 'skill', name: key.slice(6), description: '', category, on })
const INDEX = [entry('skill:a', 'build'), entry('skill:b', 'build', false), entry('skill:c', 'web')]

describe('the map', () => {
  test('one hub per category and one dot per tool, all inside the picture', () => {
    const lay = layout(INDEX)
    expect(lay.nodes.filter(n => n.hub).map(n => n.cat)).toEqual(['build', 'web'])
    expect(lay.nodes.filter(n => !n.hub)).toHaveLength(3)
    expect(lay.edges).toHaveLength(2)
    for (const n of lay.nodes) {
      expect(n.x).toBeGreaterThan(0)
      expect(n.y).toBeGreaterThan(0)
    }
  })

  test('a used tool glows and fades to nothing', () => {
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000)).toBe(1)
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000 + GLOW_MS / 2)).toBe(0.5)
    expect(glow({ 'skill:a': 1000 }, 'skill:a', 1000 + GLOW_MS * 2)).toBe(0)
    expect(glow({}, 'skill:a', 5)).toBe(0)
  })

  test('only a lit tool animates in the SVG, and the markup is well formed', () => {
    const lay = layout(INDEX)
    const dark = svg(lay, {}, 0)
    const lit = svg(lay, { 'skill:a': 0 }, 1000)
    // The map always breathes (a ripple and a pulse per hub); a lit tool adds two more.
    const extra = (lit.match(/<animate /g) ?? []).length - (dark.match(/<animate /g) ?? []).length
    expect(extra).toBe(2)
    expect(lit.startsWith('<svg ')).toBe(true)
    expect(lit.endsWith('</svg>')).toBe(true)
  })

  test('every dot has a hover card, and the markup stays under the engine limit', () => {
    const many = Array.from({ length: 193 }, (_, i) => ({ key: `skill:s${i}`, name: `s${i}`, description: 'Does a thing & more <b> for you', category: ['build', 'web', 'data'][i % 3], kind: 'skill', on: i % 2 === 0 })) as any
    const text = svg(layout(many), {}, 0, { label: c => c })
    expect(text.length).toBeLessThan(131072)
    expect((text.match(/class="h h\d+"/g) ?? []).length).toBe(193)
    expect((text.match(/class="t t\d+ /g) ?? []).length).toBe(193)
    expect(text).toContain('Does a thing &amp; more &lt;b&gt; for you')
  })

  test('the terminal grid has columns x rows x 3 words', () => {
    const b64 = cells(layout(INDEX), {}, 0, 40, 10)
    const bytes = b64.length / 4 * 3 - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0)
    expect(bytes).toBe(40 * 10 * 3 * 4)
  })
})
