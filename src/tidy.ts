// The health check of the global setup. It only reads and reports; the one fix it offers is removing
// a plugin whose files are gone, and only after a second press. It never touches a project's files.

import type { Disk } from './load'

export type Issue = {
  kind: 'stale-plugin' | 'broken-skill' | 'no-description' | 'duplicate'
  /** Entry key, `plugin:<id>` or `skill:<name>`. */
  key: string
  /** One plain sentence. */
  text: string
  /** The command that fixes it, when there is a safe one. */
  fix?: string[]
}

const SAFE = /^[A-Za-z0-9._:-]+$/

export async function checkup(disk: Disk, configDir: string): Promise<Issue[]> {
  const issues: Issue[] = []
  let installed: Record<string, any[]> = {}
  try {
    installed = JSON.parse(await disk.read(`${configDir}/plugins/installed_plugins.json`)).plugins ?? {}
  } catch {
    // No registry: nothing installed to check.
  }
  for (const [id, rows] of Object.entries(installed)) {
    const where = rows?.[0]?.installPath
    if (!where || !SAFE.test(id.replace('@', ':'))) continue
    if (!(await disk.exists(`${String(where).replace(/\\/g, '/')}/.claude-plugin/plugin.json`))) {
      issues.push({ kind: 'stale-plugin', key: `plugin:${id}`, text: `${id} is registered but its files are gone.`, fix: ['claude', 'plugin', 'uninstall', id] })
    }
  }
  const seen = new Map<string, string>()
  let dirs: Awaited<ReturnType<Disk['list']>> = []
  try {
    dirs = await disk.list(`${configDir}/skills`)
  } catch {
    // No skills folder.
  }
  for (const d of dirs) {
    if (!(d.kind === 'dir' || d.isLink) || !SAFE.test(d.name)) continue
    const file = `${configDir}/skills/${d.name}/SKILL.md`
    if (!(await disk.exists(file))) {
      issues.push({ kind: 'broken-skill', key: `skill:${d.name}`, text: `${d.name} is a skill folder with no SKILL.md.` })
      continue
    }
    const raw = await disk.read(file).catch(() => '')
    if (!/^description:\s*\S/m.test(raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '')) {
      issues.push({ kind: 'no-description', key: `skill:${d.name}`, text: `${d.name} has no description, so Claude cannot choose it.` })
    }
    const same = seen.get(d.name.toLowerCase())
    if (same) issues.push({ kind: 'duplicate', key: `skill:${d.name}`, text: `${d.name} and ${same} are the same name.` })
    seen.set(d.name.toLowerCase(), d.name)
  }
  return issues
}

/** The plugin ids to update, one `claude plugin update` each; skills from git are left to their owners. */
export const updateAll = (ids: string[]): string[][] => ids.filter(id => SAFE.test(id.replace('@', ':'))).map(id => ['claude', 'plugin', 'update', id])
