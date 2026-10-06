import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

const REGISTRY_FILE = '/helm-demo-home/.claude/plugins/installed_plugins.json'
const REGISTRY = JSON.stringify({
  plugins: {
    'tdd@m': [{ installPath: '/helm-demo-home/.claude/cache/tdd' }],
    'seo@m': [{ installPath: '/helm-demo-home/.claude/cache/seo' }],
    'gone@m': [{ installPath: '/helm-demo-home/.claude/cache/gone' }],
  },
})

const open = async ($: any) => {
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.press({ key: 'global' })
  await ui.press({ key: 'check' })
  return ui
}

test('a plugin installed under another scope is removed, trying each scope', async ($, on) => {
  const w = world($, on, {
    files: [[REGISTRY_FILE, REGISTRY]],
    // The command only works for the scope the plugin sits in.
    run: argv => (argv.includes('uninstall') && argv.includes('local') ? { exitCode: 0, stdout: '', stderr: '' } : { exitCode: 1, stdout: '', stderr: 'not installed at user scope' }),
  })
  await boot($, PROJECT)
  const ui = await open($)
  await ui.press({ key: 'fix-plugin:gone@m' })
  await ui.press({ key: 'fix-plugin:gone@m' })
  expect(w.ran.some(a => a.includes('uninstall') && a.includes('local'))).toBe(true)
  expect(await textOf(ui)).not.toContain('Could not fix')
})

test('when every command fails the entry is taken out by hand, with a copy kept', async ($, on) => {
  const w = world($, on, {
    files: [[REGISTRY_FILE, REGISTRY]],
    run: argv => (argv.includes('uninstall') ? { exitCode: 1, stdout: '', stderr: 'boom' } : { exitCode: 0, stdout: '', stderr: '' }),
  })
  await boot($, PROJECT)
  const ui = await open($)
  await ui.press({ key: 'fix-plugin:gone@m' })
  await ui.press({ key: 'fix-plugin:gone@m' })
  const now = JSON.parse(w.files.get(REGISTRY_FILE) as string)
  expect(Object.keys(now.plugins)).toEqual(['tdd@m', 'seo@m'])
  expect(w.files.has(`${REGISTRY_FILE}.helm-backup`)).toBe(true)
})

test('a name in an opened category has an info block revealed in a fixed slot, never over the list', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.press({ key: 'global' })
  await ui.press({ key: 'fold-all' })
  const drawn = JSON.stringify(await ui.drawn())
  const scopes = [...drawn.matchAll(/"scope":"([^"]+)"/g)].map(m => m[1])
  // Each scope is named twice: by the name and by its info block.
  const counts = scopes.reduce<Record<string, number>>((n, s) => ({ ...n, [s]: (n[s] ?? 0) + 1 }), {})
  expect(Object.keys(counts).length).toBeGreaterThan(2)
  expect(Object.values(counts).every(n => n === 2)).toBe(true)
  expect(drawn).not.toContain('"position":"absolute"')
})
