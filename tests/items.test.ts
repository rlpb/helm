import { describe, expect, test } from 'claude-code/testing'

import { parseItems } from '../src/research'

describe('a whole text instead of one link', () => {
  test('links, owner/name and plain names are all found, once each, in a list', () => {
    const text = [
      '# Tools to try',
      '- https://github.com/anthropics/skills',
      '- obra/superpowers (the process skills)',
      '* Caveman',
      '3. frontend design, ponytail',
      'see also https://example.com/some/page and github.com/foo/bar.git',
      'https://github.com/anthropics/skills/tree/main/docs',
    ].join('\n')
    const items = parseItems(text)
    expect(items).toContainEqual({ kind: 'repo', repo: 'anthropics/skills' })
    expect(items).toContainEqual({ kind: 'repo', repo: 'obra/superpowers' })
    expect(items).toContainEqual({ kind: 'repo', repo: 'foo/bar' })
    expect(items).toContainEqual({ kind: 'other', url: 'https://example.com/some/page' })
    expect(items).toContainEqual({ kind: 'search', query: 'Caveman' })
    expect(items).toContainEqual({ kind: 'search', query: 'frontend design' })
    expect(items).toContainEqual({ kind: 'search', query: 'ponytail' })
    // The same repository twice (a link and a deeper link) is one row.
    expect(items.filter(i => i.kind === 'repo' && i.repo === 'anthropics/skills')).toHaveLength(1)
  })

  test('ordinary words and file paths are not repositories, and long prose is not a list of names', () => {
    const items = parseItems('Use this and/or that, read/write access, docs/README.md and src/index.ts. This is a long sentence that explains why I want these tools and what I hope to do with them every day.')
    expect(items.filter(i => i.kind === 'repo')).toEqual([])
    expect(items.filter(i => i.kind === 'search')).toEqual([])
  })

  test('a single link still gives one item, and the count is capped', () => {
    expect(parseItems('https://github.com/a/b')).toEqual([{ kind: 'repo', repo: 'a/b' }])
    const many = Array.from({ length: 80 }, (_, i) => `- tool${i} x`).join('\n')
    expect(parseItems(many).length).toBe(40)
  })
})
