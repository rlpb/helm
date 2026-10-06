import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')
const repo = (full: string, stars = 300) => ({ full_name: full, description: 'x', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-01T00:00:00Z', stargazers_count: stars })

const run = (argv: string[]) => {
  if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
  const call = argv.join(' ')
  if (call.includes('search repos')) return { exitCode: 0, stdout: JSON.stringify([{ fullName: 'demo/caveman', stargazersCount: 900 }]), stderr: '' }
  const tree = call.match(/repos\/([^/\s]+\/[^/\s]+)\/git\/trees/)
  if (tree) {
    const TREES: Record<string, string[]> = {
      'demo/coll': ['README.md', 'skills/one/SKILL.md', 'skills/two/SKILL.md', 'tests/x/SKILL.md'],
      'demo/srv': ['README.md', 'server.json', 'package.json'],
      'demo/cli': ['README.md', 'pyproject.toml'],
      'demo/pkg': ['README.md', 'package.json'],
    }
    const paths = TREES[tree[1]] ?? ['README.md']
    return { exitCode: 0, stdout: JSON.stringify({ tree: paths.map(path => ({ path, type: 'blob' })) }), stderr: '' }
  }
  const m = call.match(/repos\/([^/\s]+\/[^/\s]+)(?:\/contents\/(.+))?$/)
  if (!m) return { exitCode: 1, stdout: '', stderr: '' }
  const [, full, file] = m
  if (full === 'demo/gone') return { exitCode: 1, stdout: '', stderr: '404' }
  if (!file) return { exitCode: 0, stdout: JSON.stringify(repo(full)), stderr: '' }
  if (full === 'demo/bare' || full === 'demo/coll') return { exitCode: 1, stdout: '', stderr: '' }
  if (full === 'demo/srv' && file === 'server.json') return { exitCode: 0, stdout: JSON.stringify({ packages: [{ registryType: 'npm', identifier: '@demo/srv', version: '1.2.0', packageArguments: [{ type: 'positional', value: 'mcp' }] }] }), stderr: '' }
  if (full === 'demo/cli' && file === 'pyproject.toml') return { exitCode: 0, stdout: '[project]\nname = "cli"\n\n[project.scripts]\ncli = "cli:main"\n', stderr: '' }
  if (full === 'demo/pkg' && file === 'package.json') return { exitCode: 0, stdout: JSON.stringify({ name: 'pkg', description: 'A thing', bin: { pkg: 'cli.js' } }), stderr: '' }
  if (['demo/srv', 'demo/cli', 'demo/pkg'].includes(full)) return { exitCode: 1, stdout: '', stderr: '' }
  if (file.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'mk', plugins: [{ name: full.split('/')[1] }] }), stderr: '' }
  return { exitCode: 1, stdout: '', stderr: '' }
}

test('a pasted list is checked line by line and only the ticked ones are installed', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.input({ key: 'research', text: ['Things to try:', '- https://github.com/demo/alpha', '- demo/gone', '- Caveman', 'and https://example.com/other'].join('\n') })
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
  await ui.input({ key: 'research', text: 'https://github.com/demo/alpha' })
  await new Promise(r => setTimeout(r, 100))
  const text = await textOf(ui)
  expect(text).not.toContain('found in your text')
  expect(text).toContain('demo/alpha')
})

test('what is already installed is not looked up again, and a repository that is no skill is greyed, not red', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.input({ key: 'research', text: ['demo/tdd', 'demo/alpha', 'demo/bare'].join('\n') })
  await new Promise(r => setTimeout(r, 200))
  const text = await textOf(ui)
  expect(text).toContain('Already installed')
  expect(w.ran.some(a => a.join(' ').includes('repos/demo/tdd'))).toBe(false)
  expect(text).toContain('No plugin catalog or SKILL.md')
})

test('a repository with skills in subfolders is installed through a catalog Helm writes', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.input({ key: 'research', text: 'demo/coll\ndemo/alpha' })
  await new Promise(r => setTimeout(r, 200))
  await ui.press({ key: 'b-install' })
  await new Promise(r => setTimeout(r, 200))
  const cmds = w.ran.filter(a => a[0] === 'claude' && a[1] === 'plugin').map(a => a.slice(2, 5).join(' '))
  expect(cmds.some(c => c.startsWith('marketplace add') && c.includes('demo-coll'))).toBe(true)
  expect(cmds).toContain('install coll@helm-coll --scope')
  const file = [...w.files.entries()].find(([path]) => path.endsWith('demo-coll/.claude-plugin/marketplace.json'))
  expect(file).toBeDefined()
  const plugin = JSON.parse(String(file![1])).plugins[0]
  expect(plugin.skills).toEqual(['./skills/one', './skills/two'])
  expect(plugin.strict).toBe(false)
})

test('programs are installed too: an MCP server from its registry manifest, a Python tool, an npm tool', async ($, on) => {
  const w = world($, on, { run })
  await boot($, PROJECT)
  const ui = await $.ui.mount({ plugin: 'helm', surface: 'desktop', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
  await ui.input({ key: 'research', text: ['demo/srv', 'demo/cli', 'demo/pkg'].join('\n') })
  await new Promise(r => setTimeout(r, 300))
  const text = await textOf(ui)
  expect(text).toContain('Installs with: claude mcp add --scope local srv -- npx -y @demo/srv@1.2.0 mcp')
  expect(text).toContain('Installs with: uv tool install git+https://github.com/demo/cli')
  expect(text).toContain('Installs with: npm install -g github:demo/pkg')
  expect(w.ran.some(a => a.join(' ').includes('mcp add') || a.join(' ').includes('tool install git+'))).toBe(false)
  await ui.press({ key: 'b-install' })
  await new Promise(r => setTimeout(r, 300))
  const ran = w.ran.map(a => a.join(' '))
  expect(ran).toContain('claude mcp add --scope local srv -- npx -y @demo/srv@1.2.0 mcp')
  expect(ran).toContain('uv tool install git+https://github.com/demo/cli')
  expect(ran).toContain('npm install -g github:demo/pkg')
})
