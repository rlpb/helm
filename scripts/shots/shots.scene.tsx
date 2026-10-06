// Draws the documentation's screenshots. Nothing here captures a screen: the real panel draws a
// made-up setup in a test, the tree it returns is printed as JSON, and scripts/shots.mjs turns that
// into pictures. So no image can contain a real account, a real path or somebody else's window.
//
// This file lives outside tests/ on purpose, so the test run does not draw pictures on every push.

import { test } from 'claude-code/testing'

import { projectKey } from '../src/project'
import { BASE, boot, HOME, world } from './world'

const PROJECT = `${HOME}/work/shop`
const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 76, placement: 'inline', scroll: {}, view: {} } as any
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: {}, view: {} } as any

const plugin = (id: string, description: string): [string, string][] => [[`${BASE}/cache/${id}/.claude-plugin/plugin.json`, JSON.stringify({ description })]]
const own = (name: string, description: string): [string, string] => [`${BASE}/skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: ${description}\n---\n`]

const PLUGINS = {
  'superpowers@official': 'Plans, tests and debugging for code, step by step',
  'claude-seo@community': 'Audit a website for search: pages, links, sitemap and markup',
  'office@official': 'Work with docx, pptx, xlsx and pdf documents',
  'diagrams@community': 'Draw architecture diagrams and visual flows',
}

type Shot = { name: string; band?: boolean; open?: boolean; tab?: string; sub?: string; fold?: string[]; ask?: string; github?: boolean; research?: string; tidy?: boolean; scan?: boolean }
const SHOTS: Shot[] = [
  { name: 'band', band: true },
  { name: 'rest', band: true, open: true },
  { name: 'project', ask: 'a report with charts and citations', github: true },
  { name: 'research', research: 'https://github.com/example/citation-tools' },
  { name: 'global', tab: 'global', tidy: true, scan: true, fold: ['fold-build', 'fold-write'] },
]

const REPO = { full_name: 'example/citation-tools', description: 'Format citations', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-20T00:00:00Z', stargazers_count: 412 }
const NOW = Date.UTC(2026, 9, 6, 12, 0, 0)
// What was used in this folder alone: less than everything, in made-up numbers.
const PUSES = {
  'skill:report-writer': { n: 14, last: NOW - 3 * 60_000 },
  'plugin:superpowers@official': { n: 9, last: NOW - 25 * 60_000 },
  'skill:humanizer': { n: 4, last: NOW - 3 * 3_600_000 },
}
const USES = {
  'skill:report-writer': { n: 14, last: NOW - 3 * 60_000 },
  'plugin:superpowers@official': { n: 31, last: NOW - 25 * 60_000 },
  'skill:humanizer': { n: 6, last: NOW - 3 * 3_600_000 },
  'plugin:diagrams@community': { n: 2, last: NOW - 2 * 86_400_000 },
}

for (const shot of SHOTS) {
  test(`draw ${shot.name}`, async ($, on) => {
    world($, on, {
      settings: { enabledPlugins: { 'superpowers@official': true, 'claude-seo@community': false, 'office@official': true, 'diagrams@community': true } },
      tools: shot.github ? [{ name: 'mcp__github__create_repository', mcp: true }] : [],
      store: { uses: USES, [`puses:${projectKey(PROJECT)}`]: PUSES },
      files: [
        [`${BASE}/plugins/installed_plugins.json`, JSON.stringify({ plugins: { ...Object.fromEntries(Object.keys(PLUGINS).map(id => [id, [{ installPath: `${BASE}/cache/${id}` }]])), ...(shot.tidy ? { 'old-tool@community': [{ installPath: `${BASE}/cache/old-tool` }] } : {}) } })],
        ...Object.entries(PLUGINS).flatMap(([id, d]) => plugin(id, d)),
        own('report-writer', 'Write a report with citations'),
        own('humanizer', 'Edit a draft so it stops sounding like a machine wrote it'),
        own('release-notes', 'Draft release notes from merged pull requests'),
        own('brand-voice', 'Write in the house tone'),
        ...(shot.tidy ? [[`${BASE}/skills/half-done/notes.txt`, 'x'] as [string, string]] : []),
      ],
      scanner: target => (target.endsWith('humanizer') ? { risk_assessment: { score: 62, severity: 'HIGH', recommendation: 'CAUTION', max_issue_severity: 'HIGH' }, issues: [{ severity: 'CRITICAL', pattern: 'External Script Fetching', location: { file: 'SKILL.md', start_line: 31 } }] } : { risk_assessment: { score: 0, severity: 'LOW', recommendation: 'SAFE', max_issue_severity: 'NONE' }, issues: [] }),
      run: argv => {
        if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
        const url = argv.join(' ')
        if (url.endsWith('repos/example/citation-tools')) return { exitCode: 0, stdout: JSON.stringify(REPO), stderr: '' }
        if (url.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'citation-tools', plugins: [{ name: 'citation-tools' }] }), stderr: '' }
        return { exitCode: 1, stdout: '', stderr: '' }
      },
    })
    await boot($, PROJECT)
    if (shot.band) {
      let band = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
      if (shot.open) {
        await band.press({ key: 'open' })
        band = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
      }
      console.log(`HELM-SHOT ${shot.name} ${JSON.stringify({ columns: 120, tree: await band.drawn() })}`)
      return
    }
    const ui = await $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
    if (shot.tab) await ui.press({ key: shot.tab })
    if (shot.sub) await ui.press({ key: shot.sub })
    if (shot.ask) await ui.input({ key: 'ask', text: shot.ask })
    if (shot.github) await ui.press({ key: 'gh' })
    if (shot.research) await ui.input({ key: 'research', text: shot.research })
    if (shot.tidy) await ui.press({ key: 'check' })
    if (shot.scan) await ui.press({ key: 'scan' })
    for (const key of shot.fold ?? []) await ui.press({ key })
    console.log(`HELM-SHOT ${shot.name} ${JSON.stringify({ columns: 76, tree: await ui.drawn() })}`)
  })
}
