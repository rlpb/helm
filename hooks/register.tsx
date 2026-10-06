import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Core, Nav, ProjectState } from '../types'
import { tally } from '../src/catalog'
import { loadIndex } from '../src/load'
import { shortlist } from '../src/shortlist'
import { isProject, projectKey, projectName } from '../src/project'

const PANE = 'helm'
const core = atom({ plugin: 'helm', key: 'core' } as const, { index: null, project: null, state: null, ask: null } as Core)
const nav = atom({ plugin: 'helm', key: 'nav' } as const, { tab: 'project' } as Nav)

const stateKey = (key: string) => `project:${key}`

async function setState($: any, state: ProjectState) {
  const c = await read($, core)
  if (!c.project) return
  await $.store.set(stateKey(c.project.key), state)
  await update($, core, s => ({ ...s, state }))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const home = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
    const configDir = (((await $.env.get('CLAUDE_CONFIG_DIR')) ?? '') || `${home}/.claude`).replace(/\\/g, '/').replace(/\/+$/, '')
    const cwd = (((await $.session.cwd().catch(() => '')) ?? '') as string).replace(/\\/g, '/').replace(/\/+$/, '')

    await $.command.register({ name: 'helm', description: 'Open Helm: the control panel for this project' })

    const project = isProject(cwd, configDir, home) ? { root: cwd, name: projectName(cwd), key: projectKey(cwd) } : null
    const saved = project ? ((await $.store.get(stateKey(project.key))) as ProjectState | undefined) : undefined
    const settings = ((await $.settings.read().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const index = await loadIndex(
      { read: async p => (await $.fs.read(p)) as string, list: p => $.fs.list(p), exists: p => $.fs.exists(p) },
      configDir,
      settings,
    ).catch(() => [])

    await update($, core, () => ({ index, project, state: project ? (saved ?? 'new') : null, ask: null }))
    return next(e)
  })

  on('command.run', { command: 'helm' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
    return { text: 'Helm opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await read($, core)
    if (e.props.hasSurvey || !c.project || c.state !== 'new') return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Text dimColor>New project: {c.project.name}. Set it up with Helm? </Text>
        <Button
          key="open"
          label="Open"
          onPress={async () => {
            await setState($, 'ready')
            await $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
          }}
        />
        <Text> </Text>
        <Button key="skip" label="Not here" onPress={() => setState($, 'declined')} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Input, Text } = $.ui.resolve(e)
    const c = await read($, core)
    const n = await read($, nav)
    const rows = tally(c.index ?? [])
    const active = (c.index ?? []).filter(x => x.on).length
    return (
      <Box flexDirection="column">
        <Box>
          <Button key="project" label={n.tab === 'project' ? '[Project]' : 'Project'} onPress={() => update($, nav, () => ({ tab: 'project' }))} />
          <Text> </Text>
          <Button key="global" label={n.tab === 'global' ? '[Global]' : 'Global'} onPress={() => update($, nav, () => ({ tab: 'global' }))} />
        </Box>
        <Text bold>{n.tab === 'project' ? (c.project ? c.project.name : 'No project here') : 'Everything installed'}</Text>
        {c.index === null && <Text dimColor>Reading what is installed…</Text>}
        {c.index !== null && (
          <Text dimColor>
            {c.index.length} installed, {active} on
          </Text>
        )}
        {n.tab === 'project' && c.project && (
          <Input
            key="ask"
            label="What are you building? "
            placeholder="a web shop, a CLI tool, a data report…"
            value={c.ask?.text ?? ''}
            submitLabel="find tools"
            onSubmit={text => update($, core, s => ({ ...s, ask: { text, picks: shortlist(s.index ?? [], text) } }))}
          />
        )}
        {n.tab === 'project' && c.ask && (
          <Box flexDirection="column">
            {c.ask.picks.length === 0 && <Text dimColor>Nothing installed fits that yet.</Text>}
            {c.ask.picks.map(key => {
              const entry = (c.index ?? []).find(x => x.key === key)
              return entry ? (
                <Text key={key}>
                  {entry.on ? '● ' : '○ '}
                  {entry.name} <Text dimColor>{entry.description}</Text>
                </Text>
              ) : null
            })}
          </Box>
        )}
        {(n.tab === 'global' || !c.ask) &&
          rows.map(r => (
            <Text key={r.category}>
              {r.category}: {r.on}/{r.total}
            </Text>
          ))}
      </Box>
    )
  })
}
