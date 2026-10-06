import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any

// An element's key is its address: two of them with the same key make the engine refuse the whole tree.
const keysIn = (node: any, out: string[] = []): string[] => {
  if (node && typeof node === 'object') {
    if (node.props?.key !== undefined) out.push(String(node.props.key))
    for (const child of node.children ?? []) keysIn(child, out)
  }
  return out
}

const repo = { full_name: 'demo/tool', description: 'x', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-01T00:00:00Z', stargazers_count: 300 }

for (const surface of ['terminal', 'desktop']) {
  test(`no two elements share a key, on ${surface}, in every tab and state`, async ($, on) => {
    world($, on, {
      tools: [{ name: 'mcp__github__create_repository', mcp: true }],
      scanner: 'missing',
      run: argv => {
        if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
        const url = argv.join(' ')
        if (url.endsWith('repos/demo/tool')) return { exitCode: 0, stdout: JSON.stringify(repo), stderr: '' }
        if (url.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'demo', plugins: [{ name: 'tool' }] }), stderr: '' }
        return { exitCode: 1, stdout: '', stderr: '' }
      },
    })
    await boot($, PROJECT)
    const ui = await $.ui.mount({ plugin: 'helm', surface, component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
    const check = async (label: string) => {
      const keys = keysIn(await ui.drawn())
      const dupes = keys.filter((k, i) => keys.indexOf(k) !== i)
      expect(dupes, `${surface} ${label}`).toEqual([])
    }
    await check('setup')
    await ui.press({ key: 'gh' })
    await ui.input({ key: 'ask', text: 'a report with citations and a website sitemap' })
    await check('setup with picks and GitHub')
    await ui.input({ key: 'research', text: 'demo/tool' })
    await check('discover with a verdict')
    await ui.press({ key: 'global' })
    await check('global')
    await ui.press({ key: 'check' })
    await check('global after tidy')
    await ui.press({ key: 'graph' })
    await check('map')
  })
}
