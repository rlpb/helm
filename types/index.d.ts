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

/** One thing the health check found. `a` and `b` are the names the sentence is about. */
export type Issue = { kind: 'stale-plugin' | 'broken-skill' | 'no-description' | 'duplicate'; key: string; a: string; b?: string; fix?: string[] }

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

/** Why a tool got its verdict: a code the panel turns into a sentence, and a number when one is needed. */
export type Reason = { k: 'archived' | 'noform' | 'nolicense' | 'idle' | 'stars' | 'scanhigh' | 'scanmid' | 'unscanned' | 'noscanner' | 'testsOnly'; n?: number }

export type Verdict = { level: 'ok' | 'caution' | 'no'; reasons: Reason[] }

/** A tool the person asked about: what it is and what Helm thinks. */
export type Found = { meta: Meta; verdict: Verdict; scan?: ScanResult | null }
export type Hit = { repo: string; description: string; stars: number }

/** The GitHub baseline the person chose, kept across sessions. */
export type Setup = { on: boolean; license: 'Apache-2.0' | 'MIT' | 'GPL-3.0' | 'none'; items: string[]; details: string }

/** What SkillSpector said about one skill or plugin: the score, and the worst findings outside tests and docs. */
export type ScanResult = { score: number; severity: string; recommendation: string; flagged: number; critical: number; high: number; top: { sev: string; pattern: string; where: string }[]; testOnly: number }

export type Scanner = { state: 'unknown' | 'missing' | 'ready'; version: string | null }

export type Lang = 'en' | 'it' | 'es' | 'fr' | 'de' | 'pt' | 'nl' | 'ru' | 'zh' | 'ja' | 'ko' | 'hi' | 'ar' | 'tr' | 'pl' | 'id'

/** How full each limit is, in percent; null where the session does not say. */
export type Usage = { five: number | null; week: number | null; ctx: number | null }

export type Core = {
  /** The security scanner: installed or not, and its version. */
  scanner: Scanner
  /** The latest scan of each installed plugin and skill, by key. */
  scans: Record<string, ScanResult>
  scanning: { done: number; total: number } | null
  /** The repository whose "install anyway" awaits a second press. */
  anyway: string | null
  /** The language shown, and the person's choice (`auto` follows the computer). */
  lang: Lang
  pref: Lang | 'auto'
  usage: Usage | null
  /** How often and when Claude used each tool, kept across sessions. */
  uses: Record<string, { n: number; last: number }>
  /** The key of an off tool that fits the prompt just typed, offered above the prompt. */
  hint: string | null
  setup: Setup
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
  /** A conversation is already under way in this session. */
  chat: boolean
  /** Something is under way: the top line shows it with a mark. */
  busy: boolean
  ask: Ask | null
}

/** `open` holds the category ids unfolded in Global. */
export type Nav = { tab: Tab; sub: 'setup' | 'discover'; inspect: string | null; open: string[]; /** The category the map is zoomed on, or none for the whole map. */ zoom: string | null }

declare module 'claude-code' {
  interface PluginState {
    helm: {
      core: Core
      nav: Nav
    }
  }
}
