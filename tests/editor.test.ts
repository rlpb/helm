import { expect, test } from 'claude-code/testing'

import Editor from '../hooks/editor'
import { blocks, parseScan } from '../src/skillspector'

// The surface module draws with the engine's `h`; here a plain stand-in is enough to read what it keeps.
;(globalThis as any).h = (tag: any, props: any, ...children: any[]) => (typeof tag === 'function' ? tag({ ...props, children }) : { tag, props, children })

const surface = () => {
  const posts: any[] = []
  let key: ((k: any) => void) | null = null
  const s: any = {
    elements: { Box: (p: any) => p, Text: (p: any) => p },
    state: undefined,
    setState: (next: any) => (s.state = next),
    post: (d: any) => posts.push(d),
    onKey: (fn: any) => (key = fn),
  }
  return { s, posts, press: (k: any) => key!(k) }
}

test('the text area keeps line breaks, takes pasted chunks, and Ctrl+Enter submits', () => {
  const { s, posts, press } = surface()
  const props = { placeholder: 'x', start: '', reset: 0 }
  Editor(props, s)
  press({ key: 'a' })
  press({ key: 'return' })
  press({ key: 'demo/tool\r\nother' })
  press({ key: 'up' })
  press({ key: 'x', ctrl: true })
  expect(posts.at(-1)).toEqual({ text: 'a\ndemo/tool\nother' })
  press({ key: 'backspace' })
  expect(posts.at(-1)).toEqual({ text: 'a\ndemo/tool\nothe' })
  press({ key: 'return', ctrl: true })
  expect(posts.at(-1)).toEqual({ text: 'a\ndemo/tool\nothe', submit: true })
  // "Clear" bumps `reset`, which empties it; a new instance starts from the kept draft.
  Editor({ ...props, reset: 1 }, s)
  press({ key: 'b' })
  expect(posts.at(-1)).toEqual({ text: 'b' })
  const fresh = surface()
  Editor({ ...props, start: 'kept' }, fresh.s)
  fresh.press({ key: '!' })
  expect(fresh.posts.at(-1)).toEqual({ text: 'kept!' })
})

test('findings in CI config, evaluation scripts and install notes do not make a tool risky', () => {
  const issue = (severity: string, file: string) => ({ severity, pattern: 'p', location: { file, start_line: 1 } })
  const scan = parseScan(
    JSON.stringify({
      risk_assessment: { score: 100, severity: 'CRITICAL', recommendation: 'DO_NOT_INSTALL' },
      issues: [...['.github/workflows/a.yml', 'INSTALL.md', 'evals/run.py', '.opencode/x.ts', 'README.md'].map(f => issue('HIGH', f)), issue('MEDIUM', 'scripts/run.py')],
    }),
  )!
  expect(scan.flagged).toBe(1)
  expect(blocks(scan)).toBe(false)
})
