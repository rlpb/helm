import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Core, Found, Hit, Meta, Nav, ProjectState, ScanResult, Setup } from '../types'
import { installPlan, judge, parseTarget } from '../src/research'
import { loadIndex, scanTargets } from '../src/load'
import { shortlist } from '../src/shortlist'
import { hintFor, parseChoice, refinePrompt } from '../src/suggest'
import { isProject, localSettings, projectKey, projectName } from '../src/project'
import { applyPicks, setSkillOff, undoPicks } from '../src/apply'
import type { Before } from '../src/apply'
import { checkup, updateAll } from '../src/tidy'
import { DEFAULT_SETUP, brief, hasGithub, nextLicense } from '../src/github'
import { GLOW_MS, cells, glow, layout, svg } from '../src/graph'
import { foldVerdict, installCmd, isOverridable, parseScan, parseVersion, repoTarget, scanCmd, upgradeCmd, versionCmd } from '../src/skillspector'
import { detectLang, isLang, t } from '../src/i18n'
import type { Key, Lang } from '../src/i18n'
import { Band } from '../src/views/band'
import { Panel, ago } from '../src/views/panel'

const PANE = 'helm'
let isTerminal = false
let fading = false

const core = atom(
  { plugin: 'helm', key: 'core' } as const,
  {
    scanner: { state: 'unknown', version: null },
    scans: {},
    scanning: null,
    anyway: null,
    lang: 'en',
    pref: 'auto',
    usage: null,
    uses: {},
    hint: null,
    setup: DEFAULT_SETUP,
    used: {},
    tick: 0,
    found: null,
    hits: null,
    candidates: [],
    dir: '',
    message: null,
    report: null,
    confirm: null,
    index: null,
    project: null,
    state: null,
    chat: false,
    ask: null,
  } as Core,
)
const nav = atom({ plugin: 'helm', key: 'nav' } as const, { tab: 'project', sub: 'setup', inspect: null, open: [] } as Nav)

const stateKey = (key: string) => `project:${key}`
const undoKey = (key: string) => `undo:${key}`
const tempKey = (key: string) => `temp:${key}`
const ignoreKey = (key: string) => `ignored:${key}`

/** A line in the panel's footer, in the language shown. */
async function say($: any, key: Key, ...vars: (string | number)[]) {
  const c = await read($, core)
  await update($, core, s => ({ ...s, message: t(c.lang, key, ...vars) }))
}

async function setState($: any, state: ProjectState) {
  const c = await read($, core)
  if (!c.project) return
  await $.store.set(stateKey(c.project.key), state)
  await update($, core, s => ({ ...s, state }))
}

/** A chat already under way: read what the folder is about and shortlist the tools that fit it, instead of asking from zero. */
async function lookHere($: any) {
  const c = await read($, core)
  if (!c.project) return
  const names = (((await $.fs.list(c.project.root).catch(() => [])) as { name: string }[]) ?? []).map(x => x.name).filter(n => !n.startsWith('.'))
  const notes: string[] = []
  for (const file of ['package.json', 'README.md', 'pyproject.toml', 'Cargo.toml']) {
    if (names.includes(file)) notes.push((((await $.fs.read(`${c.project.root}/${file}`).catch(() => '')) as string) ?? '').slice(0, 600))
  }
  const text = [c.project.name, ...names.slice(0, 40), ...notes].join(' ')
  const picks = shortlist(c.index ?? [], text)
  const named = picks.map(k => (c.index ?? []).find(x => x.key === k)?.name).filter(Boolean).slice(0, 4)
  await setState($, 'ready')
  await update($, core, s => ({ ...s, ask: { text: [c.project!.name, ...names.slice(0, 8)].join(' '), picks }, message: t(c.lang, 'msg.read', c.project!.name, named.join(', ') || '-') }))
  await update($, nav, s => ({ ...s, tab: 'project', sub: 'setup' }))
  await $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
}

const disk = ($: any) => ({
  read: async (p: string) => (await $.fs.read(p)) as string,
  list: (p: string) => $.fs.list(p),
  exists: (p: string) => $.fs.exists(p),
})

// ---- language and limits ----

/** The computer's language: the usual variables first, then what the runtime reports. */
async function systemLang($: any): Promise<Lang> {
  const env: Record<string, string | undefined> = {
    LC_ALL: ((await $.env.get('LC_ALL')) as string | undefined) ?? undefined,
    LC_MESSAGES: ((await $.env.get('LC_MESSAGES')) as string | undefined) ?? undefined,
    LANGUAGE: ((await $.env.get('LANGUAGE')) as string | undefined) ?? undefined,
    LANG: ((await $.env.get('LANG')) as string | undefined) ?? undefined,
  }
  let runtime: string | undefined
  try {
    runtime = Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    // No Intl: the variables are all there is.
  }
  return detectLang(env, runtime)
}

async function setLang($: any, pref: string) {
  if (pref !== 'auto' && !isLang(pref)) return
  await $.store.set('lang-pref', pref)
  const lang = pref === 'auto' ? await systemLang($) : (pref as Lang)
  await update($, core, s => ({ ...s, pref: pref as Core['pref'], lang, message: null }))
}

/** How full the 5-hour limit, the weekly limit and the context are. */
async function refreshUsage($: any) {
  const u = await $.session.usage().catch(() => null)
  if (!u) return
  const limit = (kind: RegExp): number | null => {
    const found = (u.rateLimits ?? []).find((x: any) => kind.test(String(x.kind)))
    return found && Number.isFinite(Number(found.percentUsed)) ? Math.round(Number(found.percentUsed)) : null
  }
  const ctx = u.context?.percent ?? u.context?.breakdown?.percentage
  // A session that has already cost something has a conversation in it.
  const spoken = Number(u.cost?.usd ?? 0) > 0
  await update($, core, s => ({ ...s, chat: s.chat || spoken, usage: { five: limit(/five|5/i), week: limit(/seven|week|7/i), ctx: ctx == null ? null : Math.round(Number(ctx)) } }))
}

// ---- turning tools on for a project ----

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
  if (!done) return say($, 'msg.badjson')
  await $.fs.write(file, done.text)
  await keepBefore($, c.project.key, done.before)
  if (scope === 'session') {
    const temp = ((await $.store.get(tempKey(c.project.key))) as string[] | undefined) ?? []
    await $.store.set(tempKey(c.project.key), [...new Set([...temp, key])])
  }
  const where = t(c.lang, scope === 'session' ? 'msg.scopeSession' : 'msg.scopeProject')
  await update($, core, s => ({ ...s, hint: null, message: t(c.lang, 'msg.on', entry.name, where) }))
}

/** "No": the tool is not suggested again in this folder. */
async function dismiss($: any, key: string) {
  const c = await read($, core)
  if (!c.project) return
  const ignored = ((await $.store.get(ignoreKey(c.project.key))) as string[] | undefined) ?? []
  await $.store.set(ignoreKey(c.project.key), [...new Set([...ignored, key])])
  await update($, core, s => ({ ...s, hint: null }))
}

/** One small-model call over the shortlist's candidates; the size is shown before, the real use after. */
async function refine($: any) {
  const c = await read($, core)
  if (!c.ask) return
  const index = c.index ?? []
  const candidates = shortlist(index, c.ask.text, 12).map(k => index.find(x => x.key === k)!).filter(Boolean)
  if (candidates.length < 2) return
  await say($, 'msg.refining')
  const r = await $.model.complete({ model: 'haiku', prompt: refinePrompt(candidates, c.ask.text), maxTokens: 100 }).catch(() => ({ isAnswered: false }))
  if (!r.isAnswered) return say($, 'msg.nomodel')
  const picks = parseChoice(r.text, candidates)
  const used = (r.usage?.input_tokens ?? 0) + (r.usage?.output_tokens ?? 0)
  await update($, core, s => ({ ...s, ask: s.ask ? { ...s.ask, picks } : s.ask, message: t(c.lang, 'msg.refined', picks.length, candidates.length, used) }))
}

/** Turns the shortlist on for this folder only, in its own settings.local.json, and keeps the way back. */
async function turnOnHere($: any) {
  const c = await read($, core)
  if (!c.project || !c.ask) return
  const picks = (c.index ?? []).filter(x => c.ask!.picks.includes(x.key))
  const file = localSettings(c.project.root)
  const text = (await $.fs.exists(file)) ? ((await $.fs.read(file)) as string) : ''
  const done = applyPicks(text, picks)
  if (!done) return say($, 'msg.badjson')
  await $.fs.write(file, done.text)
  await keepBefore($, c.project.key, done.before)
  await say($, 'msg.turnedOn', Object.keys(done.before).length, c.project.name)
}

async function undoHere($: any) {
  const c = await read($, core)
  if (!c.project) return
  const before = (await $.store.get(undoKey(c.project.key))) as Before | undefined
  const file = localSettings(c.project.root)
  if (!before || !(await $.fs.exists(file))) return say($, 'msg.nothingUndo')
  const text = undoPicks((await $.fs.read(file)) as string, before)
  if (text === null) return say($, 'msg.badjson')
  await $.fs.write(file, text)
  await $.store.delete(undoKey(c.project.key))
  await say($, 'msg.undone')
}

// ---- the health of the global setup ----

async function runCheckup($: any) {
  const c = await read($, core)
  await say($, 'msg.checking')
  const report = await checkup(disk($), c.dir).catch(() => [])
  await update($, core, s => ({ ...s, report, confirm: null, message: report.length ? t(c.lang, 'g.todo', report.length) : t(c.lang, 'msg.healthy') }))
}

async function runUpdate($: any) {
  const c = await read($, core)
  const ids = (c.index ?? []).filter(x => x.kind === 'plugin').map(x => x.key.slice(7))
  await say($, 'msg.updating', ids.length)
  let ok = 0
  for (const argv of updateAll(ids)) {
    const r = await $.process.run(argv, { timeoutMs: 120_000 }).catch(() => ({ exitCode: -1 }))
    if (r.exitCode === 0) ok += 1
  }
  if (c.scanner.state === 'ready') await updateScanner($, true)
  await say($, 'msg.updated', ok, ids.length)
}

/** The only fix Helm runs: it needs the second press on the same issue. */
async function fixIssue($: any, key: string) {
  const c = await read($, core)
  const issue = c.report?.find(i => i.key === key)
  if (!issue?.fix) return
  if (c.confirm !== key) return void (await update($, core, s => ({ ...s, confirm: key })))
  const r = await $.process.run(issue.fix, { timeoutMs: 60_000 }).catch(() => ({ exitCode: -1 }))
  if (r.exitCode !== 0) return say($, 'msg.cannotFix', key)
  await runCheckup($)
}

// ---- finding and installing new tools ----

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
  let verdict = judge(meta, await $.clock.now())
  const scanner = (await read($, core)).scanner.state
  const target = repoTarget(meta.repo)
  let scan: ScanResult | null = null
  if (verdict.level !== 'no' && target && scanner === 'ready') {
    await say($, 'msg.scanning')
    scan = await scanOne($, target)
  }
  if (verdict.level !== 'no') verdict = foldVerdict(verdict, scan, scanner)
  return { meta, verdict, scan }
}

async function research($: any, input: string) {
  const c = await read($, core)
  const target = parseTarget(input)
  await update($, core, s => ({ ...s, found: null, hits: null, message: t(c.lang, target.kind === 'none' ? 'msg.type' : 'msg.looking') }))
  if (target.kind === 'repo') {
    const found = await inspect($, target.repo)
    return void (await update($, core, s => ({ ...s, found, message: found ? null : t(c.lang, 'msg.noRead') })))
  }
  if (target.kind === 'search') {
    const r = await gh($, ['search', 'repos', target.query, '--limit', '5', '--json', 'fullName,description,stargazersCount'])
    let hits: Hit[] = []
    try {
      hits = JSON.parse(r.stdout).map((x: any) => ({ repo: x.fullName, description: String(x.description ?? ''), stars: Number(x.stargazersCount ?? 0) }))
    } catch {
      // No usable answer: no hits.
    }
    await update($, core, s => ({ ...s, hits, message: hits.length ? null : t(c.lang, 'msg.nothing') }))
  }
}

/** Installs after the person's yes. In a project the plugin is installed for that folder only, and remembered as a global candidate. */
async function install($: any, scope: 'user' | 'local', force = false) {
  const c = await read($, core)
  if (!c.found || (c.found.verdict.level === 'no' && !force)) return
  const plan = installPlan(c.found.meta, scope, `${c.dir}/skills`)
  if (!plan) return say($, 'msg.unknownForm')
  await say($, 'msg.installing')
  for (const argv of plan) {
    const r = await $.process.run(argv, { timeoutMs: 180_000, ...(scope === 'local' && c.project ? { cwd: c.project.root } : {}) }).catch(() => ({ exitCode: -1 }))
    if (r.exitCode !== 0) return say($, 'msg.stopped', argv.slice(0, 4).join(' '))
  }
  const repo = c.found.meta.repo
  const candidates = scope === 'local' ? [...new Set([...c.candidates, repo])] : c.candidates.filter(x => x !== repo)
  await $.store.set('candidates', candidates)
  await update($, core, s => ({ ...s, candidates, found: null, message: t(c.lang, scope === 'local' ? 'msg.installedHere' : 'msg.installed', repo) }))
}

async function pickHit($: any, repo: string) {
  const c = await read($, core)
  const found = await inspect($, repo)
  await update($, core, s => ({ ...s, hits: null, found, message: found ? null : t(c.lang, 'msg.noRead') }))
}

async function globalInstall($: any, repo: string) {
  const found = await inspect($, repo)
  if (!found) return say($, 'msg.noRead')
  await update($, core, s => ({ ...s, found }))
  await install($, 'user')
}

/** Changes the GitHub baseline and keeps it for every project. */
async function setSetup($: any, change: (s: Setup) => Setup) {
  const c = await read($, core)
  const setup = change(c.setup)
  await $.store.set('github-setup', setup)
  await update($, core, s => ({ ...s, setup }))
}

const toggleItem = (id: string) => (s: Setup): Setup => ({ ...s, items: s.items.includes(id) ? s.items.filter(x => x !== id) : [...s.items, id] })


// ---- the security scanner: SkillSpector, by NVIDIA ----

const WEEK = 7 * 86_400_000

/** Whether SkillSpector answers, and which version. */
async function probeScanner($: any) {
  const r = await $.process.run(versionCmd(), { timeoutMs: 20_000 }).catch(() => null)
  const version = r && r.exitCode === 0 ? parseVersion(String(r.stdout ?? '')) : null
  await update($, core, s => ({ ...s, scanner: version ? { state: 'ready', version } : { state: 'missing', version: null } }))
}

/** One scan: the report comes on stdout, and exit 1 only means "do not install". */
async function scanOne($: any, target: string): Promise<ScanResult | null> {
  const r = await $.process.run(scanCmd(target), { timeoutMs: 180_000 }).catch(() => null)
  return r ? parseScan(String(r.stdout ?? '')) : null
}

async function installScanner($: any) {
  await say($, 'msg.installing')
  const r = await $.process.run(installCmd(), { timeoutMs: 600_000 }).catch(() => null)
  if (!r || r.exitCode !== 0) return say($, 'msg.noUv')
  await probeScanner($)
  await say($, 'msg.scannerInstalled')
}

/** Keeps the scanner current: by hand with Update all, and on its own once a week. */
async function updateScanner($: any, quiet = false) {
  const r = await $.process.run(upgradeCmd(), { timeoutMs: 600_000 }).catch(() => null)
  if (r && r.exitCode === 0) {
    await probeScanner($)
    if (!quiet) await say($, 'msg.scannerUpdated')
  }
}

/** What identifies the state of a folder: its top-level names, sizes and times. A plugin's path already holds its version. */
async function fingerprint($: any, path: string): Promise<string> {
  const entries = await $.fs.list(path).catch(() => [])
  return [path, ...entries.map((e: any) => `${e.name}:${e.size}:${e.mtimeMs}`)].join('|')
}

/** Scans every installed plugin and own skill, one after the other, and keeps the results. A folder that did not change since its last scan is not scanned again. */
async function runScan($: any) {
  const c = await read($, core)
  if (c.scanner.state !== 'ready') return
  const targets = await scanTargets(disk($), c.dir, c.index ?? [])
  const known = ((await $.store.get('scan-fps')) as Record<string, string> | undefined) ?? {}
  const fps: Record<string, string> = {}
  const scans: Record<string, ScanResult> = {}
  for (const [i, target] of targets.entries()) {
    await update($, core, s => ({ ...s, scanning: { done: i, total: targets.length }, message: null }))
    const fp = await fingerprint($, target.path)
    const before = c.scans[target.key]
    if (before && known[target.key] === fp) {
      scans[target.key] = before
      fps[target.key] = fp
      continue
    }
    const result = await scanOne($, target.path)
    if (result) {
      scans[target.key] = result
      fps[target.key] = fp
    }
  }
  const bad = Object.values(scans).filter(s => s.recommendation !== 'SAFE' && s.flagged > 0).length
  await $.store.set('scans', scans)
  await $.store.set('scan-fps', fps)
  await update($, core, s => ({ ...s, scans, scanning: null, message: t(c.lang, 'msg.scanDone', targets.length, bad) }))
}

/** Switches a tool off or on at the user level: a plugin through the CLI, a skill through skillOverrides. Reversible. */
async function toggleTool($: any, key: string) {
  const c = await read($, core)
  const entry = (c.index ?? []).find(x => x.key === key)
  if (!entry) return
  const off = entry.on
  if (entry.kind === 'plugin') {
    const r = await $.process.run(['claude', 'plugin', off ? 'disable' : 'enable', key.slice(7)], { timeoutMs: 60_000 }).catch(() => null)
    if (!r || r.exitCode !== 0) return say($, 'msg.cannotFix', entry.name)
  } else {
    const file = `${c.dir}/settings.json`
    const text = (await $.fs.exists(file)) ? ((await $.fs.read(file)) as string) : ''
    const next = setSkillOff(text, key.slice(6), off)
    if (next === null) return say($, 'msg.badjson')
    await $.fs.write(file, next)
  }
  await update($, core, s => ({ ...s, index: (s.index ?? []).map(x => (x.key === key ? { ...x, on: !off } : x)), message: t(c.lang, off ? 'msg.switchedOff' : 'msg.switchedOn', entry.name) }))
}

/** "Install anyway": only when the scanner alone said no, and only on a second press. */
async function installAnyway($: any, scope: 'user' | 'local') {
  const c = await read($, core)
  if (!c.found || !isOverridable(c.found)) return
  if (c.anyway !== c.found.meta.repo) return void (await update($, core, s => ({ ...s, anyway: c.found!.meta.repo })))
  await update($, core, s => ({ ...s, anyway: null }))
  await install($, scope, true)
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
    const uses = ((await $.store.get('uses')) as Core['uses'] | undefined) ?? {}
    const saidPref = await $.store.get('lang-pref')
    const pref = (saidPref === 'auto' || isLang(saidPref) ? saidPref : 'auto') as Core['pref']
    const lang = pref === 'auto' ? await systemLang($) : (pref as Lang)
    const scans = ((await $.store.get('scans')) as Core['scans'] | undefined) ?? {}
    await update($, core, () => ({ scanner: { state: 'unknown', version: null } as Core['scanner'], scans, scanning: null, anyway: null, lang, pref, usage: null, uses, hint: null, used: {}, tick: 0, found: null, hits: null, setup, candidates, dir: configDir, message: null, report: null, confirm: null, index, project, state: project ? (saved ?? 'new') : null, chat: false, ask: null }))
    await refreshUsage($)
    await probeScanner($)
    const checked = Number((await $.store.get('scanner-checked')) ?? 0)
    const now = await $.clock.now()
    if ((await read($, core)).scanner.state === 'ready' && now - checked > WEEK) {
      await $.store.set('scanner-checked', now)
      void updateScanner($, true)
    }
    return started
  })

  // A Skill call lights its dot and is counted. A terminal has no animation of its own, so it redraws while the glow fades.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const name = String((e as any).skill ?? '')
    const c = await read($, core)
    const list = c.index ?? []
    const entry = list.find(x => x.key === `skill:${name}`) ?? list.find(x => x.kind === 'plugin' && x.key.startsWith(`plugin:${name.split(':')[0]}@`))
    if (entry) {
      const at = await $.clock.now()
      const uses = { ...c.uses, [entry.key]: { n: (c.uses[entry.key]?.n ?? 0) + 1, last: at } }
      await $.store.set('uses', uses)
      await update($, core, s => ({ ...s, uses, used: { ...s.used, [entry.key]: at } }))
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

  on('turn.complete', async ($, e, next) => {
    await refreshUsage($)
    return next(e)
  })

  // A tool that fits what was just typed is offered, and the GitHub brief rides on the first prompt of a project, once.
  on('prompt.submit', async ($, e, next) => {
    const c = await read($, core)
    if (!c.chat) await update($, core, s => ({ ...s, chat: true }))
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
    if (e.props.hasSurvey) return next(e)
    const ui = $.ui.resolve(e as any) as any
    const c = await read($, core)
    const now = await $.clock.now()
    const lit = Object.entries(c.used)
      .sort((x, y) => y[1] - x[1])
      .find(([key, at]) => glow({ [key]: at }, key, now) > 0)
    const litEntry = lit ? (c.index ?? []).find(x => x.key === lit[0]) : undefined
    const act = {
      open: () => void $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true }),
      accept: (key: string, scope: 'project' | 'session') => void accept($, key, scope),
      dismiss: (key: string) => void dismiss($, key),
      start: () => {
        void setState($, 'ready')
        void $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
      },
      look: () => void lookHere($),
      skip: () => void setState($, 'declined'),
      security: () => {
        void update($, nav, s => ({ ...s, tab: 'global' }))
        void $.ui.open({ id: PANE, title: 'Helm', focus: true, closeOnEscape: true })
      },
    }
    return Band({ ui, c, lang: c.lang, act, terminal: e.surface === 'terminal', width: e.props.bodyColumns ?? 100, litName: litEntry?.name, litCat: litEntry?.category })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e as any) as any
    const c = await read($, core)
    const n = await read($, nav)
    const github = hasGithub(await $.tool.list().catch(() => []))
    const terminal = e.surface === 'terminal'
    const width = Math.max(40, Math.min(e.props.bodyColumns ?? 80, 100))
    const now = await $.clock.now()
    const act = {
      tab: (tab: Nav['tab']) => void update($, nav, s => ({ ...s, tab })),
      fold: (cat: string) => void update($, nav, s => ({ ...s, open: (s.open ?? []).includes(cat) ? s.open.filter(x => x !== cat) : [...(s.open ?? []), cat] })),
      foldAll: (cats: string[]) => void update($, nav, s => ({ ...s, open: (s.open ?? []).length > 0 ? [] : cats })),
      inspect: (key: string) => void update($, nav, s => ({ ...s, inspect: key })),
      lang: (pref: string) => void setLang($, pref),
      ask: (text: string) => void update($, core, s => ({ ...s, ask: { text, picks: shortlist(s.index ?? [], text) } })),
      refine: () => void refine($),
      turnOn: () => void turnOnHere($),
      undo: () => void undoHere($),
      gh: () => void setSetup($, s => ({ ...s, on: !s.on })),
      license: () => void setSetup($, s => ({ ...s, license: nextLicense(s.license) })),
      item: (id: string) => void setSetup($, toggleItem(id)),
      details: (text: string) => void setSetup($, s => ({ ...s, details: text })),
      research: (text: string) => void research($, text),
      pick: (repo: string) => void pickHit($, repo),
      install: (scope: 'user' | 'local') => void install($, scope),
      check: () => void runCheckup($),
      update: () => void runUpdate($),
      fix: (key: string) => void fixIssue($, key),
      makeGlobal: (repo: string) => void globalInstall($, repo),
      scan: () => void runScan($),
      installScanner: () => void installScanner($),
      toggle: (key: string) => void toggleTool($, key),
      anyway: (scope: 'user' | 'local') => void installAnyway($, scope),
    }
    try {
      let map: any = null
      if (n.tab === 'graph') {
        const lay = layout(c.index ?? [])
        const opts = {
          label: (cat: string) => t(c.lang, `cat.${cat}` as Key),
          uses: Object.fromEntries(Object.entries(c.uses).map(([k, v]) => [k, v.n])),
          note: (key: string) => (c.uses[key] ? `${t(c.lang, 'map.uses', c.uses[key].n)} · ${t(c.lang, 'map.last', ago(now - c.uses[key].last))}` : ''),
          states: { on: t(c.lang, 'map.on'), off: t(c.lang, 'map.off') },
        }
        isTerminal = terminal
        map = terminal ? (
          <ui.Raster key="map" columns={width} rows={16} cells={cells(lay, c.used, now, width, 16, opts)} />
        ) : (
          <ui.Svg source={svg(lay, c.used, now, opts)} alt="Map of installed tools, lit when used" isInteractive />
        )
      }
      return Panel({ ui, c, n, github, act, terminal, width, map, now, lang: c.lang })
    } catch (err) {
      // A panel that cannot draw says why, instead of the engine's empty "nothing to show".
      return (
        <ui.Box flexDirection="column">
          <ui.Text bold color="claude">Helm</ui.Text>
          <ui.Text color="error">{`The panel could not be drawn: ${String((err as Error)?.message ?? err).slice(0, 300)}`}</ui.Text>
        </ui.Box>
      )
    }
  })
}
