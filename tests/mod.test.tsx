import { expect, test } from 'claude-code/testing'

import { BASE, boot, HOME, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: {}, view: {} } as any

const pane = ($: any, surface = 'terminal') => $.ui.mount({ plugin: 'helm', surface, component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
const band = ($: any) => $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })

const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

test('a new project gets the notice, and Open remembers the folder', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  const notice = await band($)
  expect(await textOf(notice)).toContain('New project “shop”. Set it up?')
  await notice.press({ key: 'open' })
  expect([...w.store.values()]).toContain('ready')
})

test('"Not here" is remembered', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  await (await band($)).press({ key: 'skip' })
  expect([...w.store.values()]).toContain('declined')
})

test('the home folder is not a project', async ($, on) => {
  world($, on)
  await boot($, HOME)
  expect(await textOf(await pane($))).toContain('no project here')
})

test('describing the project shortlists the fitting tools, and one press turns them on there only', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.input({ key: 'ask', text: 'a report with citations' })
  const text = await textOf(ui)
  expect(text).toContain('Report writer')
  // Everything that fits is already on, so there is nothing to turn on.
  expect(await ui.find({ key: 'here' })).toBeUndefined()
  // The global settings file is never touched.
  expect(JSON.parse(w.files.get(`${BASE}/settings.json`)!).enabledPlugins).toEqual({ 'tdd@m': true, 'seo@m': false })
})

test('the Global tab checks the setup and updates every plugin', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.press({ key: 'global' })
  await ui.press({ key: 'update' })
  expect(w.ran.filter(a => a[2] === 'update').map(a => a[3]).sort()).toEqual(['seo@m', 'tdd@m'])
  await ui.press({ key: 'check' })
  expect(await textOf(ui)).toContain('Healthy')
})

test('the research box reads a repository and offers an install only after a verdict', async ($, on) => {
  const repo = { full_name: 'demo/tool', description: 'x', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-01T00:00:00Z', stargazers_count: 300 }
  const w = world($, on, {
    run: argv => {
      if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
      const url = argv.join(' ')
      if (url.endsWith('repos/demo/tool')) return { exitCode: 0, stdout: JSON.stringify(repo), stderr: '' }
      if (url.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'demo', plugins: [{ name: 'tool' }] }), stderr: '' }
      return { exitCode: 1, stdout: '', stderr: '' }
    },
  })
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.press({ key: 'sub-discover' })
  await ui.input({ key: 'research', text: 'https://github.com/demo/tool' })
  expect(await textOf(ui)).toContain('Looks fine')
  expect(w.ran.some(a => a[1] === 'plugin' && a[2] === 'install')).toBe(false)
  await ui.press({ key: 'install' })
  expect(w.ran.find(a => a[2] === 'install')).toEqual(['claude', 'plugin', 'install', 'tool@demo', '--scope', 'local'])
})

test('the map draws on the terminal and on a surface with SVG', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  const term = await pane($)
  await term.press({ key: 'graph' })
  expect(await term.find({ key: 'map' })).toBeDefined()
  const desk = await pane($, 'desktop')
  await desk.press({ key: 'graph' })
  expect(await textOf(desk)).toContain('Lit dots')
})

test('the GitHub box appears only with a GitHub connector, and its brief rides the first prompt once', async ($, on) => {
  world($, on, { tools: [{ name: 'mcp__github__create_repository', mcp: true }] })
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.press({ key: 'gh' })
  const first = await $.prompt.submit({ text: 'start the report' })
  expect(first.text).toContain('GitHub setup requested')
  const second = await $.prompt.submit({ text: 'next' })
  expect(second.text).toBe('next')
})

const submit = ($: any, text: string) => $.prompt.submit({ text })
const localFile = (w: any) => [...w.files].find(([k]) => k.endsWith('shop/.claude/settings.local.json'))?.[1]

test('a prompt that fits an off tool raises a hint, and "This project" writes it to the folder', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  await (await band($)).press({ key: 'open' })
  await submit($, 'audit the website sitemap')
  const hint = await band($)
  expect(await textOf(hint)).toContain('SEO is off and fits this')
  await hint.press({ key: 'hint-project' })
  expect(JSON.parse(localFile(w)).enabledPlugins).toEqual({ 'seo@m': true })
})

test('"This session" is undone at the next start, and "No" is remembered', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  await (await band($)).press({ key: 'open' })
  await submit($, 'audit the website sitemap')
  await (await band($)).press({ key: 'hint-session' })
  expect(JSON.parse(localFile(w)).enabledPlugins).toEqual({ 'seo@m': true })
  await boot($, PROJECT)
  expect(JSON.parse(localFile(w))).toEqual({})
  await submit($, 'audit the website sitemap')
  await (await band($)).press({ key: 'hint-no' })
  expect([...w.store.keys()].some(k => k.startsWith('ignored:'))).toBe(true)
})

test('refining asks one small model, keeps its numbers, and says what it used', async ($, on) => {
  world($, on, { model: '[1]' })
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.input({ key: 'ask', text: 'a report with citations and a website sitemap' })
  expect(await ui.find({ key: 'refine' })).toBeDefined()
  await ui.press({ key: 'refine' })
  expect(await textOf(ui)).toContain('Refined: 1 of')
  expect(await textOf(ui)).toContain('35 tokens')
})

test('without a GitHub connector the box is not there', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  expect(await (await pane($)).find({ key: 'gh' })).toBeUndefined()
})

test('an off tool that fits is written to the folder only, then Undo takes it back', async ($, on) => {
  const w = world($, on)
  await boot($, PROJECT)
  const ui = await pane($)
  await ui.input({ key: 'ask', text: 'audit a website sitemap' })
  await ui.press({ key: 'here' })
  const local = `${PROJECT}/.claude/settings.local.json`
  expect(JSON.parse([...w.files].find(([k]) => k.endsWith('shop/.claude/settings.local.json'))![1]).enabledPlugins).toEqual({ 'seo@m': true })
  await ui.press({ key: 'undo' })
  expect(JSON.parse([...w.files].find(([k]) => k.endsWith('shop/.claude/settings.local.json'))![1])).toEqual({})
  expect(local).toContain('settings.local.json')
  expect(JSON.parse(w.files.get(`${BASE}/settings.json`)!).enabledPlugins['seo@m']).toBe(false)
})

test('a resting row with an Open button is always above the prompt, in a project or not', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  await (await band($)).press({ key: 'open' })
  const rest = await band($)
  expect(await textOf(rest)).toContain('Helm')
  expect(await textOf(rest)).toContain('shop')
  expect(await rest.find({ key: 'helm-open' })).toBeDefined()
  await boot($, HOME)
  const home = await band($)
  expect(await textOf(home)).toContain('no project here')
  expect(await home.find({ key: 'helm-open' })).toBeDefined()
})

test('the panel speaks the computer language by default, and the choice sticks', async ($, on) => {
  const w = world($, on, { lang: 'it_IT.UTF-8' })
  await boot($, PROJECT)
  const ui = await pane($)
  expect(await textOf(ui)).toContain('Cosa stai costruendo?'.toUpperCase())
  await ui.select({ key: 'lang', value: 'de' })
  expect(await textOf(ui)).toContain('WAS BAUST DU GERADE?')
  expect(w.store.get('lang-pref')).toBe('de')
  await ui.select({ key: 'lang', value: 'auto' })
  expect(await textOf(ui)).toContain('COSA STAI COSTRUENDO?')
})

test('the resting row shows the limits as bars, from the session usage', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  await (await band($)).press({ key: 'open' })
  const rest = await band($)
  const text = await textOf(rest)
  expect(text).toContain('5h')
  expect(text).toContain('24%')
  expect(text).toContain('week')
})
