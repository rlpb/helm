// Type contract of Helm's session state. Every value is plain JSON so that the host can hold it
// across hot reloads. See hooks/register.tsx.

export type Tab = 'project' | 'global'

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

export type Core = {
  index: Entry[] | null
  project: Project | null
  state: ProjectState | null
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
