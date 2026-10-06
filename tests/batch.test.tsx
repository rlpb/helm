import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')
const repo = (full: string, stars = 300) => ({ full_name: full, description: 'x', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-01T00:00:00Z', stargazers_count: stars })

const run = (argv: string[]) => {
  if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
  const call = argv.join(' ')
  if (call.includes('search repos')) return { exitCode: 0, stdout: JSON.stringify([{ fullName: 'demo/caveman', stargazersCount: 900 }]), stderr: '' }
  const m = call.match(/repos\/([^/\s]+\/[^/\s]+)(?:\/contents\/(.+))?$/)
  if (!m) return { exitCode: 1, stdout: '', stderr: '' }
  const [, full, file] = m
  if (full === 'demo/gone') return { exitCode: 1, stdout: '', stderr: '404' }
  if (!file) return { exitCode: 0, stdout: JSON.stringify(repo(full)), stderr: '' }
  if (full === 'demo/bare') return { exitCode: 1, stdout: '', stderr: '' }
  if (file.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'mk', plugins: [{ name: full.split('/')[1] }] }), stderr: '' }
  return { exitCode: 1, stdout: '', stderr: '' }
}

test('a pasted list is checked line by line and only the ticked ones are installed', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.post({ text: ['Things to try:', '- https://github.com/demo/alpha', '- demo/gone', '- Caveman', 'and https://example.com/other'].join('\n') }, { in: 'research-editor' })
  await ui.press({ key: 'research-go' })
  await new Promise(r => setTimeout(r, 200))
  const text = await textOf(ui)
  expect(text).toContain('found in your text')
  expect(text).toContain('demo/alpha')
  expect(text).toContain('Not found on GitHub')
  expect(text).toContain('demo/caveman')
  expect(text).toContain('matched by name')
  expect(text).toContain('not supported yet')
  // Nothing was installed by looking.
  expect(w.ran.some(a => a.includes('install'))).toBe(false)
  await ui.press({ key: 'b-install' })
  await new Promise(r => setTimeout(r, 200))
  const installs = w.ran.filter(a => a[0] === 'claude' && a[1] === 'plugin' && a[2] === 'install').map(a => a[3])
  expect(installs.sort()).toEqual(['alpha@mk', 'caveman@mk'])
  expect(await textOf(ui)).toContain('installed')
})

test('one link still gives the single verdict card, not a list', async ($, on) => {
  world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.post({ text: 'https://github.com/demo/alpha' }, { in: 'research-editor' })
  await ui.press({ key: 'research-go' })
  await new Promise(r => setTimeout(r, 100))
  const text = await textOf(ui)
  expect(text).not.toContain('found in your text')
  expect(text).toContain('demo/alpha')
})

test('Ctrl+Enter inside the text area searches, and Clear empties the draft', async ($, on) => {
  world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.post({ text: 'https://github.com/demo/alpha', submit: true }, { in: 'research-editor' })
  await new Promise(r => setTimeout(r, 100))
  expect(await textOf(ui)).toContain('demo/alpha')
  await ui.press({ key: 'research-clear' })
  await ui.press({ key: 'research-go' })
  await new Promise(r => setTimeout(r, 50))
  expect(await textOf(ui)).not.toContain('found in your text')
})

test('what is already installed is not looked up again, and a repository that is no skill is greyed, not red', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.post({ text: ['demo/tdd', 'demo/alpha', 'demo/bare'].join('\n') }, { in: 'research-editor' })
  await ui.press({ key: 'research-go' })
  await new Promise(r => setTimeout(r, 200))
  const text = await textOf(ui)
  expect(text).toContain('Already installed')
  expect(w.ran.some(a => a.join(' ').includes('repos/demo/tdd'))).toBe(false)
  expect(text).toContain('No plugin catalog or SKILL.md')
})
