import { describe, expect, test } from 'claude-code/testing'

import { review, similar } from '../src/health'
import { readUpdate } from '../src/tidy'
import type { Entry } from '../types'
import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: {}, view: {} } as any
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

const e = (key: string, name: string, description: string, kind: 'skill' | 'plugin' = 'skill', on = true): Entry => ({ key, kind, name, description, category: 'build', on })
const SAFE = { score: 0, severity: 'LOW', recommendation: 'SAFE', flagged: 0, critical: 0, high: 0, top: [], testOnly: 0 }

describe('what an update said', () => {
  test('already latest is current, updated from is updated, anything else failed', () => {
    expect(readUpdate(0, '✔ helm is already at the latest version (0.11.0).')).toEqual({ state: 'current' })
    expect(readUpdate(0, '✔ Plugin "helm" updated from 0.9.5 to 0.10.0 for scope user.')).toEqual({ state: 'updated' })
    expect(readUpdate(1, 'Plugin not found').state).toBe('failed')
    expect(readUpdate(0, '').state).toBe('failed')
  })
})

describe('judging the setup, not only its files', () => {
  const a = e('skill:a', 'Report writer', 'Write a long report with citations, sections, figures and a bibliography from research notes')
  const b = e('skill:b', 'Report builder', 'Build a long report with citations, sections, figures and a bibliography from research notes')
  const c = e('skill:c', 'Pdf reader', 'Extract text and tables from pdf files for further processing in other steps')

  test('two tools that do the same job are suggested for switching off, the less used one', () => {
    expect(similar([a, b, c]).map(x => [x.a.key, x.b.key])).toEqual([['skill:a', 'skill:b']])
    const out = review([a, b, c], { 'skill:a': { n: 5, last: 0 } }, 0)
    expect(out).toEqual([{ kind: 'similar', key: 'skill:b', a: 'Report builder', b: 'Report writer' }])
  })

  test('the same tool installed twice is the clearest duplicate', () => {
    const plugin = e('plugin:x@m', 'Caveman', 'x', 'plugin')
    const skill = e('skill:caveman', 'Caveman', 'y')
    expect(similar([plugin, skill])).toHaveLength(1)
  })

  test('a skill that was never used is judged only after two weeks of watching, and plugins never', () => {
    const plugin = e('plugin:p@m', 'Some plugin', 'does hooks and commands and servers in a way this record cannot see', 'plugin')
    expect(review([c, plugin], {}, 3)).toEqual([])
    expect(review([c, plugin], {}, 20)).toEqual([{ kind: 'unused', key: 'skill:c', a: 'Pdf reader', b: '20' }])
    expect(review([c], { 'skill:c': { n: 1, last: 0 } }, 20)).toEqual([])
  })
})

describe('the panel does not round up', () => {
  test('a fresh setup is "learning", not "all good", and the dot is amber until everything is scanned', async ($, on) => {
    world($, on, { store: { scans: { 'plugin:tdd@m': SAFE } } })
    await boot($, PROJECT)
    const ui = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
    await ui.press({ key: 'global' })
    const text = await textOf(ui)
    expect(text).toContain('Learning how you work')
    expect(text).toContain('not scanned yet')
    const first = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
    await first.press({ key: 'open' })
    const band = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND_PROPS, bodyColumns: 101 } })
    const dots = (await band.findAll({ type: 'Text' })).filter((t: any) => t.text === '●')
    expect(dots.some((d: any) => d.props.color === 'warning')).toBe(true)
  })

  test('scanning everything turns the dot green, and the security tile says all were scanned', async ($, on) => {
    world($, on)
    await boot($, PROJECT)
    const ui = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
    await ui.press({ key: 'global' })
    await ui.press({ key: 'scan' })
    await new Promise(r => setTimeout(r, 100))
    expect(await textOf(ui)).toContain('scanned, nothing flagged')
    const first = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
    await first.press({ key: 'open' })
    const band = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: { ...BAND_PROPS, bodyColumns: 101 } })
    const dots = (await band.findAll({ type: 'Text' })).filter((t: any) => t.text === '●')
    expect(dots.some((d: any) => d.props.color === 'success')).toBe(true)
  })
})
