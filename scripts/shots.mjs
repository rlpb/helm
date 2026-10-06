#!/usr/bin/env node
// Builds docs/screenshot-*.png.
//
//   node scripts/shots.mjs            screenshots of the real views, drawn from made-up data
//
// Nothing here captures a screen. The views draw a fake setup inside the mod
// test runner (scripts/shots/shots.scene.tsx), the runner prints the element
// tree, and this file lays that tree out on a character grid and paints it as
// SVG. Chrome only turns the finished SVG into a PNG: it never sees a desktop,
// so an image cannot contain a real account, path or window.
//
// Needs: a Claude Code build with mod support (CLAUDE_BIN, default "claude"),
// and Chrome, Chromium or Edge for the PNG step (CHROME, or found on PATH).

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = join(root, 'docs')

// ---- layout: element tree -> lines of styled spans -------------------------

// Soft tones on white: the picture is meant to feel light, like the panel it shows.
const COLORS = {
  claude: '#d9774f',
  success: '#3f9b53',
  warning: '#b8862b',
  error: '#c8465a',
  inactive: '#a3acb5',
  suggestion: '#4f6bed',
  permission: '#4f6bed',
  subtle: '#c9d0d7',
  inverseText: '#ffffff',
}
const INK = '#2b3138'
const DIM = '#8a949e'
const PILL = '#fbe8df'
const PILL_INK = '#b5502a'

const len = s => [...s].length
const lineWidth = line => line.reduce((n, s) => n + len(s.t), 0)
const kids = node => (node.children ?? []).flat(Infinity).filter(c => c !== null && c !== undefined && c !== false)

function inline(node, base = {}) {
  if (typeof node === 'string' || typeof node === 'number') return [{ ...base, t: String(node) }]
  const p = node.props ?? {}
  const style = { ...base }
  if (p.color) style.fg = COLORS[p.color] ?? p.color
  if (p.backgroundColor) style.bg = COLORS[p.backgroundColor] ?? p.backgroundColor
  if (p.bold) style.bold = true
  if (p.dimColor) style.fg = DIM
  // A rule is only a hairline: draw it lighter than text.
  if (kids(node).length === 1 && /^─+$/.test(String(kids(node)[0]))) style.fg = '#e3e7eb'
  return kids(node).flatMap(c => inline(c, style))
}

function splitLines(spans) {
  const lines = [[]]
  for (const s of spans) {
    const parts = s.t.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) lines.push([])
      if (part) lines.at(-1).push({ ...s, t: part })
    })
  }
  return lines
}

function wrapLine(line, cols) {
  if (lineWidth(line) <= cols) return [line]
  const out = []
  let cur = []
  let used = 0
  for (const s of line) {
    for (const word of s.t.split(/(?<= )/)) {
      const w = len(word)
      if (used + w > cols && used > 0) {
        out.push(cur)
        cur = []
        used = 0
      }
      cur.push({ ...s, t: word })
      used += w
    }
  }
  if (cur.length) out.push(cur)
  return out
}

function clip(line, cols) {
  if (lineWidth(line) <= cols) return line
  const out = []
  let left = cols - 1
  for (const s of line) {
    const chars = [...s.t]
    if (chars.length <= left) {
      out.push(s)
      left -= chars.length
    } else {
      out.push({ ...s, t: chars.slice(0, left).join('') + '…' })
      return out
    }
  }
  return out
}

function markdown(text, cols) {
  const out = []
  for (const raw of text.split('\n')) {
    const bullet = raw.startsWith('- ')
    const body = bullet ? raw.slice(2) : raw
    const spans = bullet ? [{ t: '• ', fg: DIM }] : []
    body.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach(part => {
      if (!part) return
      if (part.startsWith('**')) spans.push({ t: part.slice(2, -2), bold: true })
      else if (part.startsWith('`')) spans.push({ t: part.slice(1, -1), fg: COLORS.suggestion })
      else spans.push({ t: part })
    })
    out.push(...wrapLine(spans, cols))
  }
  return out
}

function block(node, cols) {
  if (typeof node === 'string' || typeof node === 'number') return splitLines(inline(node))
  const p = node.props ?? {}
  switch (node.type) {
    case 'Text': {
      const lines = splitLines(inline(node))
      return String(p.wrap ?? 'wrap').startsWith('truncate') ? lines.map(l => clip(l, cols)) : lines.flatMap(l => wrapLine(l, cols))
    }
    case 'Button': {
      const label = `  ${p.label}  `
      if (p.plain) return [[{ t: p.label, fg: p.dimColor ? DIM : INK }]]
      if (p.variant === 'primary') return [[{ t: label, bg: PILL, fg: PILL_INK, bold: true }]]
      return [[{ t: label, bg: '#f2f4f6', fg: INK }]]
    }
    case 'Input':
      return [[{ t: '› ', fg: COLORS.claude, bold: true }, { t: p.placeholder ?? '', fg: DIM }, { t: `   ${p.submitLabel ?? 'send'} ↵`, fg: DIM }]]
    case 'Select': {
      const option = (p.options ?? []).find(o => o.value === p.value)
      return [[...(p.label ? [{ t: p.label, fg: DIM }] : []), { t: `${option?.label ?? p.value} ▾`, fg: COLORS.suggestion }]]
    }
    case 'Raster': {
      // The terminal's picture: a grid of colored characters, three numbers per cell.
      const bytes = Uint8Array.from(Buffer.from(p.cells, 'base64'))
      const words = new Uint32Array(bytes.buffer)
      const lines = []
      for (let y = 0; y < p.rows; y++) {
        const line = []
        for (let x = 0; x < p.columns; x++) {
          const i = (y * p.columns + x) * 3
          const rgb = words[i + 1]
          line.push({ t: String.fromCodePoint(words[i] || 0x20), fg: rgb >= 0x01000000 ? DIM : `#${rgb.toString(16).padStart(6, '0')}` })
        }
        lines.push(line)
      }
      return lines
    }
    case 'Markdown':
      return markdown(p.text ?? '', cols)
    case 'Link':
      return [[{ t: p.label ?? p.href ?? '', fg: COLORS.suggestion, ul: true }]]
    case 'Code':
      return [inline(node)]
    case 'Box': {
      const outer = cols
      const padX = p.borderStyle ? (p.paddingX ?? 0) : 0
      const frame = p.borderStyle ? 2 + padX * 2 : 0
      const fixed = typeof p.width === 'number' ? p.width : null
      cols = (fixed ?? cols) - (p.marginLeft ?? 0) - frame
      const column = p.flexDirection === 'column'
      const children = kids(node)
      const gap = p.columnGap ?? p.gap ?? 0
      const spaces = n => ({ t: ' '.repeat(Math.max(0, n)) })
      const widthOf = list => list.reduce((n, it) => n + lineWidth(it.line), 0) + gap * Math.max(0, list.length - 1)
      // Items side by side on one line: space-between spreads them, a growing item takes what is left.
      const join = (list, fillTo) => {
        const parts = list.map(it => it.line)
        const gapped = ls => ls.flatMap((l, i) => [...(i > 0 && gap ? [spaces(gap)] : []), ...l])
        if (fillTo && p.justifyContent === 'space-between' && list.length > 1) {
          const rest = gapped(parts.slice(1))
          return [...parts[0], spaces(Math.max(1, fillTo - lineWidth(parts[0]) - lineWidth(rest))), ...rest]
        }
        const grow = list.findIndex(it => it.grow)
        const left = fillTo ? fillTo - widthOf(list) : 0
        return parts.flatMap((l, i) => [...(i > 0 && gap ? [spaces(gap)] : []), ...l, ...(i === grow && left > 0 ? [spaces(left)] : [])])
      }
      let lines
      if (column) {
        const rowGap = p.rowGap ?? p.gap ?? 0
        lines = children.flatMap((c, i) => [...(i > 0 && rowGap ? Array(rowGap).fill([]) : []), ...block(c, cols)])
      } else {
        const blocks = children.map(c => block(c, cols))
        if (blocks.every(b => b.length <= 1)) {
          const items = blocks.map((b, i) => ({ line: b[0] ?? [], grow: (children[i]?.props?.flexGrow ?? 0) > 0 }))
          if (p.flexWrap === 'wrap' && items.length > 1 && widthOf(items) > cols) {
            lines = []
            let cur = []
            for (const it of items) {
              if (cur.length && widthOf([...cur, it]) > cols) {
                lines.push(join(cur, 0))
                cur = []
              }
              cur.push(it)
            }
            if (cur.length) lines.push(join(cur, 0))
          } else {
            lines = [join(items, cols)]
          }
        } else {
          // Blocks side by side; with flexWrap they fill a row, then the next row starts below.
          const sizeOf = b => Math.max(0, ...b.map(lineWidth))
          const rows = []
          let cur = []
          let used = 0
          for (const b of blocks) {
            const w = sizeOf(b)
            if (p.flexWrap === 'wrap' && cur.length && used + gap + w > cols) {
              rows.push(cur)
              cur = []
              used = 0
            }
            used += (cur.length ? gap : 0) + w
            cur.push(b)
          }
          rows.push(cur)
          const rowGap = p.rowGap ?? 0
          lines = rows.flatMap((group, r) => {
            const widths = group.map(sizeOf)
            if (p.justifyContent === 'space-between' && group.length === 2) widths[0] = Math.max(widths[0], cols - widths[1] - gap)
            const merged = Array.from({ length: Math.max(...group.map(b => b.length)) }, (_, i) =>
              group.flatMap((b, j) => {
                const l = b[i] ?? []
                return [...(j > 0 && gap ? [spaces(gap)] : []), ...l, spaces(widths[j] - lineWidth(l))]
              }),
            )
            return [...(r > 0 && rowGap ? Array(rowGap).fill([]) : []), ...merged]
          })
        }
      }
      const inner = cols
      if (fixed != null) {
        lines = lines.map(l => {
          const l2 = lineWidth(l) > inner ? clip(l, inner) : l
          const room = Math.max(0, inner - lineWidth(l2))
          return p.justifyContent === 'flex-end' ? [spaces(room), ...l2] : [...l2, spaces(room)]
        })
      } else if (typeof p.minWidth === 'number') {
        lines = lines.map(l => [...l, spaces(p.minWidth - lineWidth(l))])
      }
      cols = outer
      if (p.borderStyle) {
        const bc = COLORS[p.borderColor] ?? p.borderColor ?? COLORS.subtle
        const edge = { t: '│', fg: bc }
        lines = [
          [{ t: `╭${'─'.repeat(inner + padX * 2)}╮`, fg: bc }],
          ...lines.map(l => [edge, spaces(padX), ...l, spaces(inner - lineWidth(l) + padX), edge]),
          [{ t: `╰${'─'.repeat(inner + padX * 2)}╯`, fg: bc }],
        ]
      }
      const indent = p.marginLeft ?? 0
      const shifted = indent ? lines.map(l => (l.length ? [{ t: ' '.repeat(indent) }, ...l] : l)) : lines
      return [...Array(p.marginTop ?? 0).fill([]), ...shifted, ...Array(p.marginBottom ?? 0).fill([])]
    }
    default:
      return kids(node).flatMap(c => block(c, cols))
  }
}

// ---- paint: lines -> SVG ---------------------------------------------------

const CW = 9
const LH = 24
const FS = 15
const PADX = 28
const PADY = 22
const BAR = 40
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const FONT = "'Cascadia Mono','Cascadia Code',Consolas,'SF Mono',Menlo,'DejaVu Sans Mono',monospace"

const LINE_GLYPHS = '─━│╭╮╰╯'

// Box-drawing characters are drawn as strokes: a font leaves gaps between rows and its corners
// are square. The same characters are what the terminal itself prints.
function glyph(ch, x, y, fg) {
  const cx = x + CW / 2
  const cy = y + LH / 2
  const r = CW / 2
  const x1 = x + CW
  const y1 = y + LH
  const path = (d, w = 1.3) => `<path d="${d}" fill="none" stroke="${fg}" stroke-width="${w}" stroke-linecap="round"/>`
  switch (ch) {
    case '─':
      return path(`M${x} ${cy}H${x1}`)
    case '━':
      return path(`M${x} ${cy}H${x1}`, 3.2)
    case '│':
      return path(`M${cx} ${y}V${y1}`)
    case '╭':
      return path(`M${x1} ${cy}Q${cx} ${cy} ${cx} ${cy + r}V${y1}`)
    case '╮':
      return path(`M${x} ${cy}Q${cx} ${cy} ${cx} ${cy + r}V${y1}`)
    case '╰':
      return path(`M${x1} ${cy}Q${cx} ${cy} ${cx} ${cy - r}V${y}`)
    default:
      return path(`M${x} ${cy}Q${cx} ${cy} ${cx} ${cy - r}V${y}`)
  }
}

function paintLine(line, y) {
  let col = 0
  let out = ''
  for (const s of line) {
    const fg = s.fg ?? INK
    const x0 = PADX + col * CW
    if (s.bg) out += `<rect x="${x0}" y="${y + 2}" width="${len(s.t) * CW}" height="${LH - 4}" rx="${(LH - 4) / 2}" fill="${s.bg}"/>`
    let run = ''
    let runStart = col
    const flush = () => {
      if (!run) return
      const weight = s.bold ? ' font-weight="700"' : ''
      const deco = s.ul ? ' text-decoration="underline"' : ''
      out += `<text x="${PADX + runStart * CW}" y="${y + 17}" fill="${fg}"${weight}${deco} style="white-space:pre">${esc(run)}</text>`
      run = ''
    }
    for (const ch of s.t) {
      if (ch === '█' || ch === '░') {
        flush()
        out += `<rect x="${PADX + col * CW}" y="${y + 8}" width="${CW}" height="${LH - 16}" fill="${fg}" fill-opacity="${ch === '█' ? 1 : 0.16}"/>`
        col += 1
        runStart = col
      } else if (LINE_GLYPHS.includes(ch)) {
        flush()
        out += glyph(ch, PADX + col * CW, y, fg)
        col += 1
        runStart = col
      } else {
        if (!run) runStart = col
        run += ch
        col += 1
      }
    }
    flush()
  }
  return out
}

function paint(lines, cols, title, footer = []) {
  const all = [...lines, ...footer]
  const w = cols * CW + PADX * 2
  const h = all.length * LH + PADY * 2 + BAR + 14
  const body = all.map((l, i) => paintLine(l, BAR + PADY + i * LH)).join('')
  return {
    w,
    h,
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}" font-size="${FS}">` +
      `<defs><filter id="soft" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#1f2933" flood-opacity="0.10"/></filter></defs>` +
      `<rect width="${w}" height="${h}" fill="#f3f5f8"/>` +
      `<rect x="10" y="8" width="${w - 20}" height="${h - 22}" rx="14" fill="#ffffff" filter="url(#soft)"/>` +
      `<circle cx="34" cy="${BAR / 2 + 8}" r="5" fill="#e8ebef"/><circle cx="52" cy="${BAR / 2 + 8}" r="5" fill="#e8ebef"/><circle cx="70" cy="${BAR / 2 + 8}" r="5" fill="#e8ebef"/>` +
      `<text x="${w / 2}" y="${BAR / 2 + 13}" text-anchor="middle" fill="${DIM}" font-size="13">${esc(title)}</text>` +
      body +
      `</svg>`,
  }
}

// ---- Chrome: SVG -> PNG ----------------------------------------------------

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean)
  return candidates.find(c => existsSync(c) || spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0)
}

function toPng(chrome, svgPath, pngPath, w, h, scale) {
  const profile = mkdtempSync(join(tmpdir(), 'helm-chrome-'))
  const r = spawnSync(
    chrome,
    ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, `--screenshot=${pngPath}`, pathToFileURL(svgPath).href],
    { stdio: 'ignore' },
  )
  rmSync(profile, { recursive: true, force: true })
  if (r.status !== 0 || !existsSync(pngPath)) throw new Error(`Chrome did not write ${pngPath}`)
}

// ---- main ------------------------------------------------------------------

const work = mkdtempSync(join(tmpdir(), 'helm-shots-'))
try {
  // A scratch copy of the mod with the screenshot test added to its tests.
  for (const item of ['.claude-plugin', 'hooks', 'src', 'types']) cpSync(join(root, item), join(work, item), { recursive: true })
  mkdirSync(join(work, 'tests'))
  cpSync(join(root, 'tests', 'world.ts'), join(work, 'tests', 'world.ts'))
  cpSync(join(root, 'scripts', 'shots', 'shots.scene.tsx'), join(work, 'tests', 'shots.test.tsx'))

  const claude = process.env.CLAUDE_BIN ?? 'claude'
  const run = spawnSync(claude, ['plugin', 'test', work], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (run.status !== 0) throw new Error(`"${claude} plugin test" failed:\n${run.stdout}\n${run.stderr}`)

  const shots = [...(run.stdout + run.stderr).matchAll(/^HELM-SHOT ([\w-]+) (\{.*\})\r?$/gm)].map(m => [m[1], JSON.parse(m[2])])
  if (shots.length === 0) throw new Error('The test run printed no screenshots.')

  const chrome = findChrome()
  if (!chrome) throw new Error('No Chrome, Chromium or Edge found. Set CHROME to its path.')
  mkdirSync(docs, { recursive: true })

  for (const [name, { columns, tree }] of shots) {
    const isBand = name === 'band' || name === 'rest'
    const lines = block(tree, columns)
    // The band sits above the prompt, so the picture shows a prompt under it.
    const footer = isBand
      ? [[], [{ t: '─'.repeat(columns), fg: '#e3e7eb' }], [{ t: '> ', fg: COLORS.claude, bold: true }, { t: 'start on the checkout page', fg: INK }], [{ t: '─'.repeat(columns), fg: '#e3e7eb' }]]
      : []
    const { svg, w, h } = paint(lines, columns, isBand ? 'Claude Code' : 'Helm', footer)
    const svgPath = join(work, `${name}.svg`)
    writeFileSync(svgPath, svg)
    toPng(chrome, svgPath, join(docs, `screenshot-${name}.png`), w, h, 2)
    console.log(`docs/screenshot-${name}.png  ${w}x${h}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
