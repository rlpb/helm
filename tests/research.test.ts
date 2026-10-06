import { describe, expect, test } from 'claude-code/testing'

import { installPlan, judge, parseTarget, wrapperFile } from '../src/research'
import type { Meta } from '../src/research'

const NOW = Date.parse('2026-10-06T00:00:00Z')
const meta = (over: Partial<Meta> = {}): Meta => ({
  repo: 'demo/tool',
  description: '',
  license: 'Apache-2.0',
  archived: false,
  pushedAt: '2026-09-01T00:00:00Z',
  stars: 500,
  marketplace: { name: 'demo', plugins: ['tool'] },
  isSkill: false,
  ...over,
})

describe('what was typed', () => {
  test('links, owner/name and plain names are told apart', () => {
    expect(parseTarget('https://github.com/demo/tool')).toEqual({ kind: 'repo', repo: 'demo/tool' })
    expect(parseTarget('github.com/demo/tool.git')).toEqual({ kind: 'repo', repo: 'demo/tool' })
    expect(parseTarget('https://github.com/demo/tool/tree/main/docs')).toEqual({ kind: 'repo', repo: 'demo/tool' })
    expect(parseTarget('demo/tool')).toEqual({ kind: 'repo', repo: 'demo/tool' })
    expect(parseTarget('seo audit')).toEqual({ kind: 'search', query: 'seo audit' })
    expect(parseTarget('  ')).toEqual({ kind: 'none' })
    expect(parseTarget('a; rm -rf /')).toEqual({ kind: 'none' })
  })
})

describe('the verdict', () => {
  test('a healthy repo is ok, a stale one asks, an archived one is refused', () => {
    expect(judge(meta(), NOW).level).toBe('ok')
    expect(judge(meta({ pushedAt: '2024-01-01T00:00:00Z', license: null }), NOW)).toEqual({ level: 'caution', reasons: [{ k: 'nolicense' }, { k: 'idle', n: 34 }] })
    expect(judge(meta({ archived: true }), NOW).level).toBe('no')
    expect(judge(meta({ marketplace: null }), NOW).level).toBe('no')
  })
})

describe('the install plan', () => {
  test('a plugin catalog adds the marketplace then installs in the scope asked', () => {
    expect(installPlan(meta(), 'local', '/c/skills')).toEqual([
      ['claude', 'plugin', 'marketplace', 'add', 'demo/tool'],
      ['claude', 'plugin', 'install', 'tool@demo', '--scope', 'local'],
    ])
  })

  test('a single skill is cloned, and odd names are refused', () => {
    expect(installPlan(meta({ marketplace: null, isSkill: true }), 'user', '/c/skills')).toEqual([['git', 'clone', '--depth', '1', 'https://github.com/demo/tool.git', '/c/skills/tool']])
    expect(installPlan(meta({ marketplace: { name: 'x;y', plugins: ['a'] } }), 'user', '/c/skills')).toBeNull()
  })
})

describe('a repository Helm wraps in a catalog of its own', () => {
  test('skills in subfolders become a one-plugin catalog, a bare plugin keeps its manifest', () => {
    const skills = meta({ marketplace: null, isSkill: false, wrap: { plugin: false, skills: ['skills/a', 'skills/b', '../evil'] } })
    expect(judge(skills, Date.parse('2026-10-01')).level).not.toBe('no')
    const file = wrapperFile(skills, '/c/helm-markets')!
    expect(JSON.parse(file.text).plugins[0]).toMatchObject({ name: 'tool', strict: false, skills: ['./skills/a', './skills/b'] })
    expect(installPlan(skills, 'user', '/c/skills', '/c/helm-markets')).toEqual([
      ['claude', 'plugin', 'marketplace', 'add', '/c/helm-markets/demo-tool'],
      ['claude', 'plugin', 'install', 'tool@helm-tool', '--scope', 'user'],
    ])
    const plugin = wrapperFile(meta({ marketplace: null, isSkill: false, wrap: { plugin: true, skills: [] } }), '/c/helm-markets')!
    expect(JSON.parse(plugin.text).plugins[0].strict).toBeUndefined()
    expect(wrapperFile(meta({ marketplace: null, isSkill: false, wrap: { plugin: false, skills: [] } }), '/c/helm-markets')).toBeNull()
  })
})
