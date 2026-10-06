import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Core, Nav, ProjectState } from '../types'
import { tally } from '../src/catalog'
import { loadIndex } from '../src/load'
import { shortlist } from '../src/shortlist'
import { isProject, localSettings, projectKey, projectName } from '../src/project'
import { applyPicks, undoPicks } from '../src/apply'
import type { Before } from '../src/apply'
import { checkup, updateAll } from '../src/tidy'

const PANE = 'helm'
const core = atom({ plugin: 'helm', key: 'core' } as const, { dir: '', message: null, report: null, confirm: null, index: null, project: null, state: null, ask: null } as Core)
const nav = atom({ plugin: 'helm', key: 'nav' } as const, { tab: 'project' } as Nav)

const stateKey = (key: string) => `project:${key}`

async function setState($: any, state: ProjectState) {
  const c = await read($, core)
  if (!c.project) return
  await $.store.set(stateKey(c.project.key), state)
  await update($, core, s => ({ ...s, state }))
}

const say = ($: any, message: string | null) => update($, core, s => ({ ...s, message }))

const disk = ($: any) => ({
  read: async (p: string) => (await $.fs.read(p)) as string,
  list: (p: string) => $.fs.list(p),
  exists: (p: string) => $.fs.exists(p),
})

const undoKey = (key: string) => `undo:${key}`

/** Turns the shortlist on for this folder only, in its own settings.local.json, and keeps the way back. */
async function turnOnHere($: any) {
  const c = await read($, core)
  if (!c.project || !c.ask) return
  const picks = (c.index ?? []).filter(x => c.ask!.picks.includes(x.key))
  const file = localSettings(c.project.root)
  const text = (await $.fs.exists(file)) ? ((await $.fs.read(file)) as string) : ''
  const done = applyPicks(text, picks)
  if (!done) return say($, 'This folder\'s settings file is not valid JSON, so Helm left it alone.')
  await $.fs.write(file, done.text)
  await $.store.set(undoKey(c.project.key), done.before)
  await say($, `Turned on ${Object.keys(done.before).length} for ${c.project.name}. It applies from the next chat here.`)
}

async function undoHere($: any) {
  const c = await read($, core)
  if (!c.project) return
  const before = (await $.store.get(undoKey(c.project.key))) as Before | undefined
  const file = localSettings(c.project.root)
  if (!before || !(await $.fs.exists(file))) return say($, 'Nothing to undo here.')
  const text = undoPicks((await $.fs.read(file)) as string, before)
  if (text === null) return say($, 'This folder\'s settings file is not valid JSON, so Helm left it alone.')
  await $.fs.write(file, text)
  await $.store.set(undoKey(c.project.key), undefined)
  await say($, 'Put this folder back as it was.')
}

async function runCheckup($: any) {
  const c = await read($, core)
  await say($, 'Checking…')
  const report = await checkup(disk($), c.dir).catch(() => [])
  await update($, core, s => ({ ...s, report, confirm: null, message: report.length ? `${report.length} to look at.` : 'Healthy: nothing to fix.' }))
}

async function runUpdate($: any) {
  const c = await read($, core)
  const ids = (c.index ?? []).filter(x => x.kind === 'plugin').map(x => x.key.slice(7))
  await say($, `Updating ${ids.length} plugins…`)
  let ok = 0
  for (const argv of updateAll(ids)) {
    const r = await $.process.run(argv, { timeoutMs: 120_000 }).catch(() => ({ exitCode: -1 }))
    if (r.exitCode === 0) ok += 1
  }
  await say($, `Updated ${ok} of ${ids.length}. New versions load in the next chat.`)
}

/** The only fix Helm runs: it needs the second press on the same issue. */
async function fixIssue($: any, key: string) {
  const c = await read($, core)
  const issue = c.report?.find(i => i.key === key)
  if (!issue?.fix) return
  if (c.confirm !== key) return void (await update($, core, s => ({ ...s, confirm: key })))
  const r = await $.process.run(issue.fix, { timeoutMs: 60_000 }).catch(() => ({ exitCode: -1 }))
  if (r.exitCode !== 0) return say($, `Could not fix ${key}.`)
  await runCheckup($)
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

    await update($, core, () => ({ dir: configDir, message: null, report: null, confirm: null, index, project, state: project ? (saved ?? 'new') : null, ask: null }))
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
            {c.ask.picks.length > 0 && (
              <Box>
                <Button key="here" label="Turn on for this project" onPress={() => turnOnHere($)} />
                <Text> </Text>
                <Button key="undo" label="Undo" onPress={() => undoHere($)} />
              </Box>
            )}
          </Box>
        )}
        {n.tab === 'global' && (
          <Box flexDirection="column">
            <Box>
              <Button key="check" label="Tidy up" onPress={() => runCheckup($)} />
              <Text> </Text>
              <Button key="update" label="Update all" onPress={() => runUpdate($)} />
            </Box>
            {(c.report ?? []).map(i => (
              <Box key={i.key + i.kind}>
                <Text>{i.text} </Text>
                {i.fix && <Button key={`fix-${i.key}`} label={c.confirm === i.key ? 'Press again to remove' : 'Remove'} onPress={() => fixIssue($, i.key)} />}
              </Box>
            ))}
          </Box>
        )}
        {c.message && <Text dimColor>{c.message}</Text>}
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
