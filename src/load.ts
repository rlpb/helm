// Reads what is installed from the Claude Code config folder into the index. The only file in the
// slice that touches the disk, and only through the small `Disk` seam, so tests pass a fake one.

import type { Entry } from '../types'
import { buildIndex, parseFrontmatter } from './catalog'

export type Disk = {
  read: (path: string) => Promise<string>
  list: (path: string) => Promise<{ name: string; kind: string; isLink?: boolean }[]>
  exists: (path: string) => Promise<boolean>
}

type Settings = { enabledPlugins?: Record<string, unknown>; skillOverrides?: Record<string, unknown> }

const SAFE = /^[A-Za-z0-9._:-]+$/

async function json(disk: Disk, path: string): Promise<any> {
  try {
    return JSON.parse(await disk.read(path))
  } catch {
    return null
  }
}

/** Every installed plugin and own skill, with its on/off state taken from the merged settings. */
export async function loadIndex(disk: Disk, configDir: string, settings: Settings): Promise<Entry[]> {
  const installed = (await json(disk, `${configDir}/plugins/installed_plugins.json`))?.plugins ?? {}
  const plugins: { id: string; description?: string; on: boolean }[] = []
  for (const [id, rows] of Object.entries<any[]>(installed)) {
    const where = rows?.[0]?.installPath
    const manifest = where ? await json(disk, `${String(where).replace(/\\/g, '/')}/.claude-plugin/plugin.json`) : null
    plugins.push({ id, description: manifest?.description, on: settings.enabledPlugins?.[id] === true })
  }

  const skills: { name: string; description?: string; on: boolean }[] = []
  let dirs: Awaited<ReturnType<Disk['list']>> = []
  try {
    dirs = await disk.list(`${configDir}/skills`)
  } catch {
    // No skills folder: no own skills.
  }
  for (const d of dirs) {
    if (!(d.kind === 'dir' || d.isLink) || !SAFE.test(d.name)) continue
    const file = `${configDir}/skills/${d.name}/SKILL.md`
    if (!(await disk.exists(file))) continue
    const meta = parseFrontmatter(await disk.read(file).catch(() => ''))
    const off = settings.skillOverrides?.[d.name]
    skills.push({ name: d.name, description: meta.description, on: off !== 'off' })
  }
  return buildIndex({ plugins, skills })
}

/** The folders a scan can read: each plugin where it is installed, each own skill in the skills folder. */
export async function scanTargets(disk: Disk, configDir: string, index: Entry[]): Promise<{ key: string; path: string }[]> {
  const installed = (await json(disk, `${configDir}/plugins/installed_plugins.json`))?.plugins ?? {}
  const out: { key: string; path: string }[] = []
  for (const e of index) {
    if (e.kind === 'plugin') {
      const where = installed[e.key.slice(7)]?.[0]?.installPath
      if (where) out.push({ key: e.key, path: String(where).replace(/\\/g, '/') })
    } else if (SAFE.test(e.key.slice(6))) {
      out.push({ key: e.key, path: `${configDir}/skills/${e.key.slice(6)}` })
    }
  }
  return out
}
