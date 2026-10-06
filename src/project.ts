// Where a chat runs: the project folder and who it is. Pure.

const slashes = (path: string): string => path.replace(/\\/g, '/').replace(/\/+$/, '')

/** A short, stable id for a folder, the same on every OS and for either slash. */
export function projectKey(root: string): string {
  const text = slashes(root).toLowerCase()
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** The name a person knows the folder by. */
export const projectName = (root: string): string => slashes(root).split('/').pop() || root

/** The settings file that holds a project's own setup. */
export const localSettings = (root: string): string => `${slashes(root)}/.claude/settings.local.json`

/**
 * Whether a folder can be a project. The home folder and Claude Code's own config folder cannot:
 * their `.claude/settings.json` is the global file, so nothing set there could be "only here".
 */
export function isProject(root: string, configDir: string, home = ''): boolean {
  const r = slashes(root).toLowerCase()
  const c = slashes(configDir).toLowerCase()
  if (r === '' || r === c || `${r}/.claude` === c) return false
  return !(home !== '' && r === slashes(home).toLowerCase())
}
