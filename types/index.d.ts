// Type contract of Helm's session state. Every value is plain JSON so that the host can hold it
// across hot reloads. See hooks/register.tsx.

export type Tab = 'project' | 'global' | 'graph'

/** What kind of thing an installed entry is. */
export type Kind = 'plugin' | 'skill'

/** One installed thing, as the index knows it. */
export type Entry = {
  /** `plugin:<id>` or `skill:<name>`: unique and stable. */
  key: string
  kind: Kind
  name: string
  /** What it says about itself, cut short. */
  description: string
  category: string
  /** Whether Claude Code loads it in this chat. */
  on: boolean
}

/** The folder a chat runs in, when it can have a project of its own. */
export type Project = { root: string; name: string; key: string }

/** `new`: Helm has not seen this folder; `ready`: set up; `declined`: the person said "not here". */
export type ProjectState = 'new' | 'ready' | 'declined'

/** What the person said they are building, and the entries that fit it. */
export type Ask = { text: string; picks: string[] }

export type Issue = { kind: string; key: string; text: string; fix?: string[] }

/** What the repository page and its top-level files say about a tool. */
export type Meta = {
  repo: string
  description: string
  license: string | null
  archived: boolean
  pushedAt: string
  stars: number
  /** A plugin catalog found in the repo, if any. */
  marketplace: { name: string; plugins: string[] } | null
  /** The repo is one skill (SKILL.md at its root). */
  isSkill: boolean
}

export type Verdict = { level: 'ok' | 'caution' | 'no'; reasons: string[] }

/** A tool the person asked about: what it is and what Helm thinks. */
export type Found = { meta: Meta; verdict: Verdict }
export type Hit = { repo: string; description: string; stars: number }

export type Core = {
  /** When each tool was last used by Claude, in clock milliseconds, by entry key. */
  used: Record<string, number>
  /** Bumped while a glow fades, so a terminal redraws. */
  tick: number
  found: Found | null
  hits: Hit[] | null
  /** Repos installed for one project, offered later as global installs. */
  candidates: string[]
  /** Claude Code's config folder, slashes forward. */
  dir: string
  /** The last result worth telling, in one line. */
  message: string | null
  /** The health check, once run. */
  report: Issue[] | null
  /** The issue key whose fix awaits a second press. */
  confirm: string | null
  index: Entry[] | null
  project: Project | null
  state: ProjectState | null
  ask: Ask | null
}

export type Nav = { tab: Tab }

declare module 'claude-code' {
  interface PluginState {
    helm: {
      core: Core
      nav: Nav
    }
  }
}
