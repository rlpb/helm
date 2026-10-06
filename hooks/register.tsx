import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Core, Found, Hit, Meta, Nav, ProjectState, Setup } from '../types'
import { installPlan, judge, parseTarget } from '../src/research'
import { tally } from '../src/catalog'
import { loadIndex } from '../src/load'
import { shortlist } from '../src/shortlist'
import { estimateTokens, hintFor, parseChoice, refinePrompt } from '../src/suggest'
import { isProject, localSettings, projectKey, projectName } from '../src/project'
import { applyPicks, undoPicks } from '../src/apply'
import type { Before } from '../src/apply'
import { checkup, updateAll } from '../src/tidy'
import { ITEMS, DEFAULT_SETUP, brief, hasGithub, nextLicense } from '../src/github'
import { GLOW_MS, cells, layout, svg } from '../src/graph'

const PANE = 'helm'
let isTerminal = false
let fading = false
const core = atom({ plugin: 'helm', key: 'core' } as const, { hint: null, setup: DEFAULT_SETUP, used: {}, tick: 0, found: null, hits: null, candidates: [], dir: '', message: null, report: null, confirm: null, index: null, project: null, state: null, ask: null } as Core)
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
const tempKey = (key: string) => `temp:${key}`
const ignoreKey = (key: string) => `ignored:${key}`

/** The way back for every key turned on here: the first value seen wins, so Undo goes to the original. */
async function keepBefore($: any, key: string, before: Before) {
  const old = ((await $.store.get(undoKey(key))) as Before | undefined) ?? {}
  await $.store.set(undoKey(key), { ...before, ...old })
}

/** Turns one tool on for this folder, for good or only until the next session. */
async function accept($: any, key: string, scope: 'project' | 'session') {
  const c = await read($, core)
  const entry = (c.index ?? []).find(x => x.key === key)
  if (!c.project || !entry) return
  const file = localSettings(c.project.root)
  const text = (await $.fs.exists(file)) ? ((await $.fs.read(file)) as string) : ''
  const done = applyPicks(text, [entry])
  if (!done) return say($, 'The settings file of this folder is not valid JSON, so Helm left it alone.')
  await $.fs.write(file, done.text)
  await keepBefore($, c.project.key, done.before)
  if (scope === 'session') {
    const temp = ((await $.store.get(tempKey(c.project.key))) as string[] | undefined) ?? []
    await $.store.set(tempKey(c.project.key), [...new Set([...temp, key])])
  }
  const where = scope === 'session' ? 'for this session' : 'for this project'
  await update($, core, s => ({ ...s, hint: null, message: `${entry.name} is on ${where}. A skill applies at once; a plugin from the next chat.` }))
}

/** "No": the tool is not suggested again in this folder. */
async function dismiss($: any, key: string) {
  const c = await read($, core)
  if (!c.project) return
  const ignored = ((await $.store.get(ignoreKey(c.project.key))) as string[] | undefined) ?? []
  await $.store.set(ignoreKey(c.project.key), [...new Set([...ignored, key])])
  await update($, core, s => ({ ...s, hint: null }))
}

/** One small-model call over the shortlist's candidates; the price is shown before, the real use after. */
async function refine($: any) {
  const c = await read($, core)
  if (!c.ask) return
  const index = c.index ?? []
  const candidates = shortlist(index, c.ask.text, 12).map(k => index.find(x => x.key === k)!).filter(Boolean)
  if (candidates.length < 2) return
  await say($, 'Asking a small model…')
  const r = await $.model.complete({ model: 'haiku', prompt: refinePrompt(candidates, c.ask.text), maxTokens: 100 }).catch(() => ({ isAnswered: false }))
  if (!r.isAnswered) return say($, 'The small model did not answer; the word match stays.')
  const picks = parseChoice(r.text, candidates)
  const used = (r.usage?.input_tokens ?? 0) + (r.usage?.output_tokens ?? 0)
  await update($, core, s => ({ ...s, ask: s.ask ? { ...s.ask, picks } : s.ask, message: `Refined: ${picks.length} of ${candidates.length} kept (${used} tokens).` }))
}

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
  await keepBefore($, c.project.key, done.before)
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
  await $.store.delete(undoKey(c.project.key))
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

const gh = ($: any, args: string[]) => $.process.run(['gh', ...args], { timeoutMs: 30_000 }).catch(() => ({ exitCode: -1, stdout: '', stderr: '' }))
const RAW = ['-H', 'Accept: application/vnd.github.raw']

/** Reads a repo the way a careful person would: its page, then whether it holds a plugin catalog or one skill. */
async function inspect($: any, repo: string): Promise<Found | null> {
  const page = await gh($, ['api', `repos/${repo}`])
  if (page.exitCode !== 0) return null
  const r = JSON.parse(page.stdout)
  const cat = await gh($, ['api', ...RAW, `repos/${repo}/contents/.claude-plugin/marketplace.json`])
  let marketplace: Meta['marketplace'] = null
  if (cat.exitCode === 0) {
    try {
      const m = JSON.parse(cat.stdout)
      const all: string[] = (m.plugins ?? []).map((p: any) => String(p.name))
      const own = repo.split('/')[1]
      // One plugin, or the one named like the repo: never a whole catalog at once.
      const pick = all.length === 1 ? all : all.filter(n => n === own).slice(0, 1)
      if (pick.length > 0) marketplace = { name: String(m.name), plugins: pick }
    } catch {
      // A catalog that is not JSON counts as no catalog.
    }
  }
  const skill = marketplace ? { exitCode: 1 } : await gh($, ['api', ...RAW, `repos/${repo}/contents/SKILL.md`])
  const meta: Meta = {
    repo: r.full_name,
    description: String(r.description ?? ''),
    license: r.license?.spdx_id ?? null,
    archived: r.archived === true,
    pushedAt: String(r.pushed_at ?? ''),
    stars: Number(r.stargazers_count ?? 0),
    marketplace,
    isSkill: skill.exitCode === 0,
  }
  return { meta, verdict: judge(meta, await $.clock.now()) }
}

async function research($: any, input: string) {
  const target = parseTarget(input)
  await update($, core, s => ({ ...s, found: null, hits: null, message: target.kind === 'none' ? 'Type a GitHub link, owner/name, or a name.' : 'Looking…' }))
  if (target.kind === 'repo') {
    const found = await inspect($, target.repo)
    return void (await update($, core, s => ({ ...s, found, message: found ? null : 'Could not read that repository (is it public, and is gh signed in?).' })))
  }
  if (target.kind === 'search') {
    const r = await gh($, ['search', 'repos', target.query, '--limit', '5', '--json', 'fullName,description,stargazersCount'])
    let hits: Hit[] = []
    try {
      hits = JSON.parse(r.stdout).map((x: any) => ({ repo: x.fullName, description: String(x.description ?? ''), stars: Number(x.stargazersCount ?? 0) }))
    } catch {
      // No usable answer: no hits.
    }
    await update($, core, s => ({ ...s, hits, message: hits.length ? null : 'Nothing found.' }))
  }
}

/** Installs after the person's yes. In a project the plugin is installed for that folder only, and remembered as a global candidate. */
async function install($: any, scope: 'user' | 'local') {
  const c = await read($, core)
  if (!c.found || c.found.verdict.level === 'no') return
  const plan = installPlan(c.found.meta, scope, `${c.dir}/skills`)
  if (!plan) return say($, 'Helm does not know how to install that form.')
  await say($, 'Installing…')
  for (const argv of plan) {
    const r = await $.process.run(argv, { timeoutMs: 180_000, ...(scope === 'local' && c.project ? { cwd: c.project.root } : {}) }).catch(() => ({ exitCode: -1 }))
    if (r.exitCode !== 0) return say($, `Stopped at: ${argv.slice(0, 4).join(' ')}`)
  }
  const repo = c.found.meta.repo
  const candidates = scope === 'local' ? [...new Set([...c.candidates, repo])] : c.candidates.filter(x => x !== repo)
  await $.store.set('candidates', candidates)
  await update($, core, s => ({ ...s, candidates, found: null, message: `Installed ${repo}${scope === 'local' ? ' for this project' : ''}. It loads in the next chat.` }))
}

/** Changes the GitHub baseline and keeps it for every project. */
async function setSetup($: any, change: (s: Setup) => Setup) {
  const c = await read($, core)
  const setup = change(c.setup)
  await $.store.set('github-setup', setup)
  await update($, core, s => ({ ...s, setup }))
}

const toggleItem = (id: string) => (s: Setup): Setup => ({ ...s, items: s.items.includes(id) ? s.items.filter(x => x !== id) : [...s.items, id] })

async function pickHit($: any, repo: string) {
  const found = await inspect($, repo)
  await update($, core, s => ({ ...s, hits: null, found, message: found ? null : 'Could not read that repository.' }))
}

async function globalInstall($: any, repo: string) {
  const found = await inspect($, repo)
  if (!found) return say($, 'Could not read that repository.')
  await update($, core, s => ({ ...s, found }))
  await install($, 'user')
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
    const started = await next(e)
    const home = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/\\/g, '/')
    const configDir = (((await $.env.get('CLAUDE_CONFIG_DIR')) ?? '') || `${home}/.claude`).replace(/\\/g, '/').replace(/\/+$/, '')
    const cwd = (((await $.session.cwd().catch(() => '')) ?? '') as string).replace(/\\/g, '/').replace(/\/+$/, '')

    await $.command.register({ name: 'helm', description: 'Open Helm: the control panel for this project' })

    const project = isProject(cwd, configDir, home) ? { root: cwd, name: projectName(cwd), key: projectKey(cwd) } : null
    const saved = project ? ((await $.store.get(stateKey(project.key))) as ProjectState | undefined) : undefined
    // Tools turned on "for this session" last time go back first, so the index below is read as they now stand.
    if (project) {
      const temp = ((await $.store.get(tempKey(project.key))) as string[] | undefined) ?? []
      const before = ((await $.store.get(undoKey(project.key))) as Before | undefined) ?? {}
      const file = localSettings(project.root)
      if (temp.length > 0 && (await $.fs.exists(file))) {
        const back = undoPicks((await $.fs.read(file)) as string, Object.fromEntries(temp.filter(k => k in before).map(k => [k, before[k]])))
        if (back !== null) await $.fs.write(file, back)
        await $.store.delete(tempKey(project.key))
      }
    }
    const settings = ((await $.settings.read().catch(() => ({}))) ?? {}) as Record<string, unknown>
    const index = await loadIndex(
      { read: async p => (await $.fs.read(p)) as string, list: p => $.fs.list(p), exists: p => $.fs.exists(p) },
      configDir,
      settings,
    ).catch(() => [])

    const setup = { ...DEFAULT_SETUP, ...(((await $.store.get('github-setup')) as object | undefined) ?? {}) }
    const candidates = ((await $.store.get('candidates')) as string[] | undefined) ?? []
    await update($, core, () => ({ hint: null, used: {}, tick: 0, found: null, hits: null, setup, candidates, dir: configDir, message: null, report: null, confirm: null, index, project, state: project ? (saved ?? 'new') : null, ask: null }))
    return started
  })

  // A Skill call lights its dot. A terminal has no animation of its own, so it redraws while the glow fades.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = String((e as any).skill ?? '')
    const c = await read($, core)
    const list = c.index ?? []
    const entry = list.find(x => x.key === `skill:${name}`) ?? list.find(x => x.kind === 'plugin' && x.key.startsWith(`plugin:${name.split(':')[0]}@`))
    if (entry) {
      const at = await $.clock.now()
      await update($, core, s => ({ ...s, used: { ...s.used, [entry.key]: at } }))
      if (isTerminal && !fading) {
        fading = true
        void (async () => {
          while ((await $.clock.now()) - at < GLOW_MS + 500) {
            await $.clock.sleep(500)
            await update($, core, s => ({ ...s, tick: s.tick + 1 }))
          }
          fading = false
        })()
      }
    }
    return next(e)
  })

  // The GitHub brief rides on the first prompt of a project, once.
  on('prompt.submit', async ($, e, next) => {
    const c = await read($, core)
    if (c.project && c.state !== 'declined') {
      const ignored = ((await $.store.get(ignoreKey(c.project.key))) as string[] | undefined) ?? []
      const hint = hintFor(c.index ?? [], e.text, ignored)
      if (hint !== c.hint) await update($, core, s => ({ ...s, hint }))
    }
    if (!c.project || !c.setup.on || !hasGithub(await $.tool.list().catch(() => []))) return next(e)
    const sentKey = `gh-sent:${c.project.key}`
    if (await $.store.get(sentKey)) return next(e)
    const text = brief(c.setup)
    if (text === '') return next(e)
    await $.store.set(sentKey, true)
    return next({ ...e, text: `${e.text}\n\n${text}` })
  })

  on('command.run', { command: 'helm' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
    return { text: 'Helm opened.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const c = await read($, core)
    if (e.props.hasSurvey || !c.project) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const hinted = c.hint ? (c.index ?? []).find(x => x.key === c.hint) : undefined
    if (hinted && c.state !== 'new') {
      return (
        <Box>
          <Text dimColor>{`${hinted.name} is off and fits this. Turn it on `}</Text>
          <Button key="hint-session" label="This session" onPress={() => accept($, hinted.key, 'session')} />
          <Text> </Text>
          <Button key="hint-project" label="This project" onPress={() => accept($, hinted.key, 'project')} />
          <Text> </Text>
          <Button key="hint-no" label="No" onPress={() => dismiss($, hinted.key)} />
        </Box>
      )
    }
    if (c.state !== 'new') return next(e)
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
    const { Box, Button, Input, Raster, Svg, Text } = $.ui.resolve(e as any) as any
    const c = await read($, core)
    const n = await read($, nav)
    const github = hasGithub(await $.tool.list().catch(() => []))
    const rows = tally(c.index ?? [])
    const active = (c.index ?? []).filter(x => x.on).length
    const tabs = (
      <Box>
        <Button key="project" label={n.tab === 'project' ? '[Project]' : 'Project'} onPress={() => update($, nav, () => ({ tab: 'project' }))} />
        <Text> </Text>
        <Button key="global" label={n.tab === 'global' ? '[Global]' : 'Global'} onPress={() => update($, nav, () => ({ tab: 'global' }))} />
        <Text> </Text>
        <Button key="graph" label={n.tab === 'graph' ? '[Map]' : 'Map'} onPress={() => update($, nav, () => ({ tab: 'graph' }))} />
      </Box>
    )
    if (n.tab === 'graph') {
      const now = await $.clock.now()
      const lay = layout(c.index ?? [])
      const columns = Math.max(40, Math.min(e.props.bodyColumns ?? 80, 100))
      const lines = 16
      isTerminal = e.surface === 'terminal'
      return (
        <Box flexDirection="column">
          {tabs}
          {e.surface === 'terminal' ? (
            <Raster key="map" columns={columns} rows={lines} cells={cells(lay, c.used, now, columns, lines)} />
          ) : (
            <Svg source={svg(lay, c.used, now)} alt="Map of installed tools, lit when used" />
          )}
          <Text dimColor>Lit dots are tools Claude just used.</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        {tabs}
        <Text bold>{n.tab === 'project' ? (c.project ? c.project.name : 'No project here') : 'Everything installed'}</Text>
        {c.index === null && <Text dimColor>Reading what is installed…</Text>}
        {c.index !== null && (
          <Text dimColor>
            {`${c.index.length} installed, ${active} on`}
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
        {n.tab === 'project' && c.project && github && (
          <Box flexDirection="column">
            <Button
              key="gh"
              label={`${c.setup.on ? '[x]' : '[ ]'} Set up GitHub to professional standards`}
              onPress={() => setSetup($, s => ({ ...s, on: !s.on }))}
            />
            {c.setup.on && (
              <Box flexDirection="column">
                <Button key="license" label={`License: ${c.setup.license} (change)`} onPress={() => setSetup($, s => ({ ...s, license: nextLicense(s.license) }))} />
                <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                  {ITEMS.map(i => (
                    <Button key={`i-${i.id}`} label={`${c.setup.items.includes(i.id) ? '[x]' : '[ ]'} ${i.label}`} onPress={() => setSetup($, toggleItem(i.id))} />
                  ))}
                </Box>
                <Input
                  key="details"
                  label="Details: "
                  placeholder="extra directions, e.g. a private repo, a Ko-fi link"
                  value={c.setup.details}
                  submitLabel="save"
                  onSubmit={text => setSetup($, s => ({ ...s, details: text }))}
                />
                <Text dimColor>Added once to your first prompt in this project.</Text>
              </Box>
            )}
          </Box>
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
            {shortlist(c.index ?? [], c.ask.text, 12).length > 1 && (
              <Button
                key="refine"
                label={`Refine with a small model (about ${estimateTokens(refinePrompt((c.index ?? []).filter(x => shortlist(c.index ?? [], c.ask!.text, 12).includes(x.key)), c.ask.text))} tokens)`}
                onPress={() => refine($)}
              />
            )}
            {c.ask.picks.some(k => (c.index ?? []).some(x => x.key === k && !x.on)) && (
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
        {n.tab === 'global' && c.candidates.length > 0 && (
          <Box flexDirection="column">
            <Text dimColor>Added for one project, make global?</Text>
            {c.candidates.map(repo => (
              <Box key={repo}>
                <Text>{repo} </Text>
                <Button key={`g-${repo}`} label="Install for all" onPress={() => globalInstall($, repo)} />
              </Box>
            ))}
          </Box>
        )}
        {c.hits && (
          <Box flexDirection="column">
            {c.hits.map(h => (
              <Box key={h.repo}>
                <Button key={`h-${h.repo}`} label={h.repo} onPress={() => pickHit($, h.repo)} />
                <Text dimColor>{` ${h.stars}★ ${h.description.slice(0, 60)}`}</Text>
              </Box>
            ))}
          </Box>
        )}
        {c.found && (
          <Box flexDirection="column">
            <Text bold>
              {c.found.meta.repo} <Text dimColor>{`${c.found.meta.license ?? "no license"}, ${c.found.meta.stars}★`}</Text>
            </Text>
            <Text>{c.found.verdict.level === 'ok' ? 'Looks fine.' : c.found.verdict.level === 'caution' ? 'Check before you install:' : 'Do not install:'}</Text>
            {c.found.verdict.reasons.map(reason => (
              <Text key={reason} dimColor>
                · {reason}
              </Text>
            ))}
            {c.found.verdict.level !== 'no' && (
              <Button
                key="install"
                label={n.tab === 'project' && c.project ? 'Yes, install for this project' : 'Yes, install for all'}
                onPress={() => install($, n.tab === 'project' && c.project ? 'local' : 'user')}
              />
            )}
          </Box>
        )}
        <Input key="research" label="Find a tool: " placeholder="GitHub link, owner/name, or a name" submitLabel="look" onSubmit={text => research($, text)} />
        {c.message && <Text dimColor>{c.message}</Text>}
        {(n.tab === 'global' || !(c.ask || c.found || c.hits)) &&
          rows.map(r => (
            <Text key={r.category}>
              {`${r.category}: ${r.on}/${r.total}`}
            </Text>
          ))}
      </Box>
    )
  })
}
