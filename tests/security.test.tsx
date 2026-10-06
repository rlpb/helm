import { describe, expect, test } from 'claude-code/testing'

import { blocks, flagged, foldVerdict, isOverridable, parseScan, parseVersion, repoTarget, scanCmd, watched } from '../src/skillspector'
import { BASE, boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const pane = ($: any) => $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

const report = (recommendation: string, score: number, issues: { severity: string; pattern: string; file: string; line?: number }[] = []) => ({
  risk_assessment: { score, severity: score > 60 ? 'CRITICAL' : 'LOW', recommendation, max_issue_severity: issues[0]?.severity ?? 'NONE' },
  issues: issues.map(i => ({ severity: i.severity, pattern: i.pattern, category: 'x', location: { file: i.file, start_line: i.line ?? 1 } })),
})

const repo = { full_name: 'demo/tool', description: 'x', license: { spdx_id: 'Apache-2.0' }, archived: false, pushed_at: '2026-09-01T00:00:00Z', stargazers_count: 300 }
const github = (argv: string[]) => {
  if (argv[0] !== 'gh') return { exitCode: 0, stdout: '', stderr: '' }
  const url = argv.join(' ')
  if (url.endsWith('repos/demo/tool')) return { exitCode: 0, stdout: JSON.stringify(repo), stderr: '' }
  if (url.endsWith('marketplace.json')) return { exitCode: 0, stdout: JSON.stringify({ name: 'demo', plugins: [{ name: 'tool' }] }), stderr: '' }
  return { exitCode: 1, stdout: '', stderr: '' }
}

describe('reading what SkillSpector says', () => {
  test('a report is read, and findings in tests and docs do not count against a tool', () => {
    const scan = parseScan(JSON.stringify(report('DO_NOT_INSTALL', 90, [
      { severity: 'HIGH', pattern: 'External Script Fetching', file: 'SKILL.md', line: 4 },
      { severity: 'HIGH', pattern: 'Credential Access', file: 'tests/world.ts' },
      { severity: 'MEDIUM', pattern: 'Skill Enumeration', file: 'docs/guide.md' },
      { severity: 'HIGH', pattern: 'Agent Config', file: 'src/a.test.ts' },
    ])))!
    expect(scan.score).toBe(90)
    expect(scan.flagged).toBe(1)
    expect(scan.testOnly).toBe(3)
    expect(scan.top).toEqual([{ sev: 'HIGH', pattern: 'External Script Fetching', where: 'SKILL.md:4' }])
    expect(parseScan('not json')).toBeNull()
    expect(parseScan('{}')).toBeNull()
  })

  test('the commands are fixed, and only a plain repository name becomes a target', () => {
    expect(scanCmd('/a/b')).toEqual(['skillspector', 'scan', '/a/b', '--no-llm', '--format', 'json'])
    expect(repoTarget('demo/tool')).toBe('https://github.com/demo/tool')
    expect(repoTarget('demo/tool; rm -rf /')).toBeNull()
    expect(parseVersion('SkillSpector v2.12.0')).toBe('2.12.0')
    expect(parseVersion('command not found')).toBeNull()
  })

  test('a scan only raises a verdict, never lowers it', () => {
    const ok = { level: 'ok' as const, reasons: [] }
    const bad = parseScan(JSON.stringify(report('DO_NOT_INSTALL', 90, [{ severity: 'CRITICAL', pattern: 'p', file: 'a.md' }])))!
    const one = parseScan(JSON.stringify(report('DO_NOT_INSTALL', 90, [{ severity: 'HIGH', pattern: 'p', file: 'a.md' }])))!
    const three = parseScan(JSON.stringify(report('DO_NOT_INSTALL', 90, ['a', 'b', 'c'].map(f => ({ severity: 'HIGH', pattern: 'p', file: `${f}.md` })))))!
    const mid = parseScan(JSON.stringify(report('CAUTION', 40, [{ severity: 'MEDIUM', pattern: 'p', file: 'a.md' }])))!
    const side = parseScan(JSON.stringify(report('DO_NOT_INSTALL', 90, [{ severity: 'HIGH', pattern: 'p', file: 'tests/a.ts' }])))!
    const safe = parseScan(JSON.stringify(report('SAFE', 0)))!
    expect(foldVerdict(ok, safe, 'ready').level).toBe('ok')
    expect(foldVerdict(ok, bad, 'ready')).toEqual({ level: 'no', reasons: [{ k: 'scanhigh', n: 90 }] })
    expect(foldVerdict(ok, three, 'ready').level).toBe('no')
    expect(foldVerdict(ok, one, 'ready')).toEqual({ level: 'caution', reasons: [{ k: 'scanmid', n: 90 }] })
    expect(foldVerdict(ok, mid, 'ready').level).toBe('caution')
    expect(foldVerdict(ok, side, 'ready').reasons).toEqual([{ k: 'testsOnly', n: 1 }])
    expect(foldVerdict(ok, null, 'missing').reasons).toEqual([{ k: 'noscanner' }])
    expect(foldVerdict(ok, null, 'ready').reasons).toEqual([{ k: 'unscanned' }])
    expect(foldVerdict({ level: 'no', reasons: [{ k: 'archived' }] }, safe, 'ready').level).toBe('no')
    const meta = {} as any
    expect(isOverridable({ meta, verdict: foldVerdict(ok, bad, 'ready') })).toBe(true)
    expect(isOverridable({ meta, verdict: { level: 'no', reasons: [{ k: 'archived' }, { k: 'scanhigh', n: 9 }] } })).toBe(false)
  })
})

describe('the scanner in the panel', () => {
  test('a clean scan lets the install button through, and the scan runs on the repository', async ($, on) => {
    const w = world($, on, { run: github })
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.post({ text: 'demo/tool' }, { in: 'research-editor' })
    await ui.press({ key: 'research-go' })
    expect(await textOf(ui)).toContain('Looks fine')
    expect(w.ran.some(a => a[0] === 'skillspector' && a[2] === 'https://github.com/demo/tool')).toBe(true)
    expect(await ui.find({ key: 'install' })).toBeDefined()
  })

  test('without the scanner a tool is only "check first", and the panel offers to install the scanner', async ($, on) => {
    const w = world($, on, { run: github, scanner: 'missing' })
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.post({ text: 'demo/tool' }, { in: 'research-editor' })
    await ui.press({ key: 'research-go' })
    expect(await textOf(ui)).toContain('Check before you install')
    expect(await textOf(ui)).toContain('Not scanned')
    await ui.press({ key: 'scanner-install-found' })
    expect(w.ran.find(a => a[0] === 'uv')).toEqual(['uv', 'tool', 'install', 'git+https://github.com/NVIDIA/skillspector.git'])
  })

  test('a bad scan hides Install, offers "Install anyway" on a second press only', async ($, on) => {
    const w = world($, on, {
      run: github,
      scanner: () => report('DO_NOT_INSTALL', 90, [{ severity: 'CRITICAL', pattern: 'External Script Fetching', file: 'SKILL.md', line: 4 }]),
    })
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.post({ text: 'demo/tool' }, { in: 'research-editor' })
    await ui.press({ key: 'research-go' })
    expect(await textOf(ui)).toContain('Do not install')
    expect(await textOf(ui)).toContain('External Script Fetching')
    expect(await ui.find({ key: 'install' })).toBeUndefined()
    await ui.press({ key: 'anyway' })
    expect(w.ran.some(a => a[2] === 'install' && a[3] === 'tool@demo')).toBe(false)
    await ui.press({ key: 'anyway' })
    expect(w.ran.find(a => a[2] === 'install')).toEqual(['claude', 'plugin', 'install', 'tool@demo', '--scope', 'local'])
  })

  test('findings only in tests leave the install button, with a note', async ($, on) => {
    world($, on, { run: github, scanner: () => report('DO_NOT_INSTALL', 90, [{ severity: 'HIGH', pattern: 'Credential Access', file: 'tests/a.ts' }]) })
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.post({ text: 'demo/tool' }, { in: 'research-editor' })
    await ui.press({ key: 'research-go' })
    expect(await textOf(ui)).toContain('only in tests or docs')
    expect(await ui.find({ key: 'install' })).toBeDefined()
  })

  test('"Scan skills" scans everything installed, lists what is flagged, and can switch a skill off and on', async ($, on) => {
    const w = world($, on, {
      scanner: target => (target.endsWith('report-writer') ? report('DO_NOT_INSTALL', 80, [{ severity: 'CRITICAL', pattern: 'Data Exfiltration', file: 'SKILL.md', line: 9 }]) : report('SAFE', 0)),
    })
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.press({ key: 'global' })
    await ui.press({ key: 'scan' })
    const text = await textOf(ui)
    expect(text).toContain('1 flagged')
    expect(text).toContain('Report writer · 80/100')
    expect(w.ran.filter(a => a[0] === 'skillspector' && a[1] === 'scan')).toHaveLength(3)
    await ui.press({ key: 'sw-skill:report-writer' })
    expect(JSON.parse(w.files.get(`${BASE}/settings.json`)!).skillOverrides).toEqual({ 'report-writer': 'off' })
    await ui.press({ key: 'sw-skill:report-writer' })
    expect(JSON.parse(w.files.get(`${BASE}/settings.json`)!).skillOverrides).toBeUndefined()
  })

  test('the scanner is updated by "Update all", and on its own once a week', async ($, on) => {
    const w = world($, on, { store: { 'scanner-checked': 1 } })
    await boot($, PROJECT)
    expect(w.ran.some(a => a.join(' ') === 'uv tool upgrade skillspector')).toBe(true)
    w.ran.length = 0
    const ui = await pane($)
    await ui.press({ key: 'global' })
    await ui.press({ key: 'update' })
    expect(w.ran.some(a => a.join(' ') === 'uv tool upgrade skillspector')).toBe(true)
  })

  test('a fresh weekly check is not repeated', async ($, on) => {
    const w = world($, on, { store: { 'scanner-checked': Date.UTC(2026, 9, 6, 11, 0, 0) } })
    await boot($, PROJECT)
    expect(w.ran.some(a => a[0] === 'uv')).toBe(false)
  })
})

describe('the scan cache', () => {
  const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 120, scroll: {}, view: {} } as any
  const band = ($: any) => $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })

  test('a second scan skips what did not change', async ($, on) => {
    const w = world($, on)
    await boot($, PROJECT)
    const ui = await pane($)
    await ui.press({ key: 'global' })
    await ui.press({ key: 'scan' })
    const first = w.ran.filter(a => a[0] === 'skillspector' && a[1] === 'scan').length
    expect(first).toBe(3)
    await ui.press({ key: 'scan' })
    expect(w.ran.filter(a => a[0] === 'skillspector' && a[1] === 'scan').length).toBe(first)
  })
})

describe('what counts as flagged', () => {
  test('only a critical finding or three high ones block; the rest is watched, not alarmed', () => {
    const mk = (critical: number, high: number, rec = 'DO_NOT_INSTALL') => ({ score: 90, severity: 'HIGH', recommendation: rec, flagged: critical + high, critical, high, top: [], testOnly: 0 })
    expect(blocks(mk(1, 0))).toBe(true)
    expect(blocks(mk(0, 3))).toBe(true)
    expect(blocks(mk(0, 2))).toBe(false)
    const scans = { 'skill:a': mk(1, 0), 'skill:b': mk(0, 1), 'skill:c': mk(0, 0, 'SAFE'), 'skill:d': mk(0, 4) }
    expect(flagged(scans).map(([k]) => k).sort()).toEqual(['skill:a', 'skill:d'])
    expect(watched(scans)).toBe(1)
  })
})
