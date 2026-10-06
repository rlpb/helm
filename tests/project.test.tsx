import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')
const pane = ($: any, surface = 'terminal') => $.ui.mount({ plugin: 'helm', surface, component: 'Pane', props: PANE_PROPS, requestId: 'helm' })

test('the project page lists only what Claude used in this project, by category and how often', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  const ui = await pane($)
  expect(await textOf(ui)).toContain('Nothing used in this project yet')
  await $.tool.call({ tool: 'Skill', tool_use_id: 't1', skill: 'report-writer' }).catch(() => undefined)
  await $.tool.call({ tool: 'Skill', tool_use_id: 't1', skill: 'report-writer' }).catch(() => undefined)
  const text = await textOf(ui)
  expect(text.toLowerCase()).toContain('used in this project')
  expect(text).toContain('Report writer')
  expect(text).toContain('×2')
  expect([...w.store.keys()].some(k => k.startsWith('puses:'))).toBe(true)
  await new Promise(r => setTimeout(r, 50))
})

test('what was used in another project does not show here', async ($, on) => {
  world($, on, { store: { uses: { 'skill:report-writer': { n: 9, last: 0 } } } })
  await boot($, PROJECT)
  expect(await textOf(await pane($))).not.toContain('Report writer')
})
