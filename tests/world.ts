import { mock } from 'claude-code/testing'

// A fake home that reads the same on every OS: the fake file system keys on the part from this
// marker on, whatever drive or folder the engine puts in front.
export const HOME = '/helm-demo-home'
export const BASE = `${HOME}/.claude`
export const PROJECT = `${HOME}/work/shop`

type Options = {
  files?: [string, string][]
  settings?: object
  tools?: { name: string; mcp: boolean }[]
  store?: Record<string, unknown>
  run?: (argv: string[]) => { exitCode: number; stdout: string; stderr: string }
}

export function world($: any, on: any, options: Options = {}) {
  const files = new Map<string, string>([
    [`${BASE}/settings.json`, JSON.stringify(options.settings ?? { enabledPlugins: { 'tdd@m': true, 'seo@m': false } }, null, 2)],
    [`${BASE}/plugins/installed_plugins.json`, JSON.stringify({ plugins: { 'tdd@m': [{ installPath: `${BASE}/cache/tdd` }], 'seo@m': [{ installPath: `${BASE}/cache/seo` }] } })],
    [`${BASE}/cache/tdd/.claude-plugin/plugin.json`, JSON.stringify({ description: 'Test driven development and debugging for code' })],
    [`${BASE}/cache/seo/.claude-plugin/plugin.json`, JSON.stringify({ description: 'Audit a website for search: sitemap and markup' })],
    [`${BASE}/skills/report-writer/SKILL.md`, '---\nname: report-writer\ndescription: Write a report with citations\n---\n'],
  ])
  const key = (path: string): string => {
    const p = path.split('\\').join('/')
    const at = p.indexOf('helm-demo-home')
    return at < 0 ? p : `/${p.slice(at)}`
  }
  for (const [path, text] of options.files ?? []) files.set(key(path), text)

  const store = new Map<string, unknown>(Object.entries(options.store ?? {}))
  on('store.get', (_$: any, e: any) => ({ value: store.get(e.key) }))
  on('store.set', (_$: any, e: any) => {
    store.set(e.key, e.value === undefined ? undefined : JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', (_$: any, e: any) => {
    store.delete(e.key)
    return { value: undefined }
  })
  on('ui.open', () => ({ value: undefined }))
  on('prompt.submit', (_$: any, e: any) => ({ text: e.text }))
  mock.clock(on, { now: Date.UTC(2026, 9, 6, 12, 0, 0) })
  mock.env(on, { USERPROFILE: HOME })

  on('fs.read', (_$: any, e: any) => {
    const path = key(e.path)
    if (!files.has(path)) throw new Error(`ENOENT ${path}`)
    return { value: files.get(path) }
  })
  on('fs.write', (_$: any, e: any) => {
    files.set(key(e.path), e.text)
    return { value: undefined }
  })
  on('fs.exists', (_$: any, e: any) => {
    const path = key(e.path)
    return { value: files.has(path) || [...files.keys()].some(k => k.startsWith(`${path}/`)) }
  })
  on('fs.list', (_$: any, e: any) => {
    const prefix = `${key(e.path).replace(/\/$/, '')}/`
    const names = new Map<string, boolean>()
    for (const k of files.keys()) {
      if (!k.startsWith(prefix)) continue
      const rest = k.slice(prefix.length)
      names.set(rest.split('/')[0], rest.includes('/'))
    }
    return { value: [...names].map(([name, isDir]) => ({ name, kind: isDir ? 'dir' : 'file', size: 0, mtimeMs: 0, isLink: false })) }
  })
  // Nothing really runs: each program is recorded and answered from options.run.
  const ran: string[][] = []
  on('process.run', (_$: any, e: any) => {
    ran.push([...e.argv])
    const result = options.run?.([...e.argv]) ?? { exitCode: 0, stdout: '', stderr: '' }
    return { value: { isStdoutTruncated: false, isStderrTruncated: false, ...result } }
  })
  const started = { cwd: HOME }
  on('session.start', (_$: any, e: any) => {
    started.cwd = e.cwd
    return { cwd: e.cwd }
  })
  on('session.cwd', () => ({ value: started.cwd }))
  on('command.register', () => ({ value: undefined }))
  on('tool.list', () => ({ value: options.tools ?? [] }))
  on('settings.read', (_$: any, e: any) => {
    const parse = (path: string) => (files.has(path) ? JSON.parse(files.get(path) as string) : {})
    const root = String(started.cwd).split('\\').join('/')
    const user = parse(`${BASE}/settings.json`)
    const local = parse(key(`${root}/.claude/settings.local.json`))
    if (e.source) return { value: e.source === 'user' ? user : e.source === 'local' ? local : {} }
    return { value: { ...user, ...local, enabledPlugins: { ...(user.enabledPlugins ?? {}), ...(local.enabledPlugins ?? {}) } } }
  })
  return { files, ran, store }
}

export const boot = async ($: any, cwd: string = HOME) => {
  await $.session.start({ cwd, surface: 'terminal', isInteractive: true })
}
