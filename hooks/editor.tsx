// The text area of the "Find a new tool" box: it wraps, grows with what is in it and keeps line breaks,
// which the one-line Input cannot. Runs on the drawing thread; the hooks module hears it through `post`.
// ponytail: editing happens at the end of the text (type, paste, backspace); cursor movement when asked.

type Props = { placeholder: string; start: string; reset: number }
type State = { text: string; reset: number }

const SHOWN = 16
const LIMIT = 20_000
// Keys with a name are commands, never text.
const NAMED = new Set(['up', 'down', 'left', 'right', 'tab', 'pageup', 'pagedown', 'home', 'end', 'escape', 'insert', 'return', 'enter', 'backspace', 'delete'])

// The one live text lives here, not in `state`: several keys can arrive before the next draw.
let live = ''
let seen = 0

export default function Editor(props: Props, s: any) {
  const { Box, Text } = s.elements
  // A new instance starts from the draft the hooks module kept; "Clear" bumps `reset` and empties it.
  if (s.state === undefined) live = props.start
  else if (props.reset !== seen) live = ''
  seen = props.reset
  const change = (next: string, submit = false) => {
    live = next.slice(0, LIMIT)
    s.setState({ text: live, reset: seen } as State)
    s.post({ text: live, ...(submit ? { submit: true } : {}) })
  }
  s.onKey((k: { key: string; ctrl?: true; meta?: true }) => {
    if (k.key === 'return' || k.key === 'enter') return k.ctrl || k.meta ? change(live, true) : change(`${live}\n`)
    if (k.key === 'backspace') return change(k.ctrl ? live.replace(/\S*\s*$/, '') : live.slice(0, -1))
    if (k.ctrl && k.key === 'u') return change('')
    if (k.ctrl || k.meta || NAMED.has(k.key)) return
    // One character, or a whole pasted chunk; a line break in it stays a line break.
    const text = k.key.replace(/\r\n?/g, '\n').replace(/[^\n\t\P{Cc}]/gu, '')
    if (text !== '') change(live + text)
  })

  const lines = live.split('\n')
  const hidden = Math.max(0, lines.length - SHOWN)
  const visible = lines.slice(hidden)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1}>
      {live === '' ? (
        <Text dimColor>{`▏${props.placeholder}`}</Text>
      ) : (
        <Box flexDirection="column">
          {hidden > 0 && <Text dimColor>{`… ${hidden}`}</Text>}
          {visible.map((line, i) => (
            <Text key={`l${hidden + i}`}>{`${line === '' ? ' ' : line}${i === visible.length - 1 ? '▏' : ''}`}</Text>
          ))}
        </Box>
      )}
    </Box>
  )
}
