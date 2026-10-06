// The live map of everything installed: one hub per category, one dot per tool around it. A tool
// that Claude just used lights up and fades. Pure: an index and a list of recent uses in, a picture
// out. SVG for desktop, editor and phone (it animates by itself, so a redraw costs nothing between
// uses); a grid of colored cells for the terminal.

import type { Entry } from '../types'

// The size the terminal grid and a first drawing use; the SVG is laid out for the width the panel really has.
export const W = 760
export const H = 456
/** How long a used tool glows, in milliseconds. */
export const GLOW_MS = 6000

export type Node = { key: string; cat: string; x: number; y: number; hub: boolean; label: string; on: boolean; /** What the tool does, for the card on hover. */ desc?: string; /** How far its dots reach, so the label can sit clear of them. */ reach?: number }
export type Edge = { from: [number, number]; to: [number, number]; cat: string }
export type Layout = { nodes: Node[]; edges: Edge[]; w: number; h: number }

// One color per category, bright enough for a dark background.
export const COLOR: Record<string, number> = {
  build: 0x5aa9ff,
  write: 0xf2b84b,
  research: 0x6fd08c,
  design: 0xe879b9,
  web: 0x4fd1d9,
  data: 0xb28cff,
  security: 0xff7a6b,
  docs: 0xc9a66b,
  setup: 0x9aa7b8,
  other: 0x8a8f98,
}
const color = (cat: string) => COLOR[cat] ?? COLOR.other
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

/** Hubs on an ellipse around the middle; each category's tools in a ring (or a spiral) around its hub. */
export function layout(index: Entry[], w = W, h = H): Layout {
  const groups = new Map<string, Entry[]>()
  for (const e of index) groups.set(e.category, [...(groups.get(e.category) ?? []), e])
  const bySize = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || a.localeCompare(b))
  // Big and small groups alternate around the wheel, so two large clusters never sit side by side.
  const cats: string[] = []
  for (let lo = 0, hi = bySize.length - 1; lo <= hi; lo++, hi--) {
    cats.push(bySize[lo])
    if (hi !== lo) cats.push(bySize[hi])
  }
  const nodes: Node[] = []
  const edges: Edge[] = []
  const cx = w / 2
  const cy = h / 2
  // Sizes are real pixels: the picture is drawn 1:1 in the space the panel has, so type and dots keep their size.
  // On a small canvas the dots and rings shrink a little so the clusters still fit side by side.
  const k = Math.max(0.6, Math.min(1, Math.min(w, h * 1.4) / 720))
  const reachOf = (cat: string) => (20 + Math.floor(Math.sqrt((groups.get(cat)!.length - 1) / 4)) * 17) * k
  const room = cats.map(cat => Math.max(2 * reachOf(cat), 80 * k) + 22 * k)
  const sum = room.reduce((x, y) => x + y, 0)
  let used = 0
  cats.forEach((cat, i) => {
    const angle = ((used + room[i] / 2) / sum) * Math.PI * 2 - Math.PI / 2
    used += room[i]
    const hx = cx + Math.cos(angle) * (w * 0.37)
    const hy = cy + Math.sin(angle) * (h * 0.36)
    const rings = Math.floor(Math.sqrt((groups.get(cat)!.length - 1) / 4))
    nodes.push({ key: `hub:${cat}`, cat, x: hx, y: hy, hub: true, label: cat, on: true, reach: (20 + rings * 17) * k })
    edges.push({ from: [cx, cy], to: [hx, hy], cat })
    const list = groups.get(cat)!
    list.forEach((e, j) => {
      // Ring 0 holds 8, then each ring one more and a bit wider: dots never touch.
      const ring = Math.floor(Math.sqrt(j / 4))
      const first = 4 * ring * ring
      const inRing = 4 * (ring + 1) * (ring + 1) - first
      const a = ((j - first) / inRing) * Math.PI * 2 + angle
      const r = (20 + ring * 17) * k
      nodes.push({ key: e.key, cat, x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r, hub: false, label: e.name, on: e.on, desc: e.description })
    })
  })
  return { nodes, edges, w, h }
}

/** How lit a tool is, 0 (dark) to 1 (just used). */
export const glow = (used: Record<string, number>, key: string, now: number): number => {
  const at = used[key]
  return at === undefined ? 0 : Math.max(0, 1 - (now - at) / GLOW_MS)
}

// Characters XML cannot hold are dropped, so a stray byte in a description cannot spoil the picture.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/\s+/g, ' ').trim()
const esc = (s: string) => clean(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** Up to `max` lines of about `width` characters, cut with an ellipsis. */
export function wrap(text: string, width: number, max: number): string[] {
  const words = clean(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    if (line && (line + ' ' + w).length > width) {
      lines.push(line)
      line = w
    } else line = line ? line + ' ' + w : w
  }
  if (line) lines.push(line)
  if (lines.length > max) {
    const kept = lines.slice(0, max)
    kept[max - 1] = kept[max - 1].slice(0, Math.max(0, width - 1)).replace(/\s+\S*$/, '') + '…'
    return kept
  }
  return lines
}

/** The map as SVG. A used tool's glow fades by itself over what is left of GLOW_MS. */
export type Opts = {
  /** A category id in the language shown. */
  label?: (cat: string) => string
  /** Tools used at least once, by key: they get a name on the map. */
  uses?: Record<string, number>
  /** The line about a tool's use ("3 uses · last 5m"), when there is one. */
  note?: (key: string) => string
  /** "on" and "off", in the language shown. */
  states?: { on: string; off: string }
  /** A category to zoom on: the picture frames its cluster and names every dot in it. */
  zoom?: string | null
}

export function svg(lay: Layout, used: Record<string, number>, now: number, opts: Opts = {}): string {
  const W = lay.w
  const H = lay.h
  const BG = '#0e1016'
  const total = new Map<string, { n: number; on: number }>()
  for (const n of lay.nodes) if (!n.hub) total.set(n.cat, { n: (total.get(n.cat)?.n ?? 0) + 1, on: (total.get(n.cat)?.on ?? 0) + (n.on ? 1 : 0) })
  const states = opts.states ?? { on: 'on', off: 'off' }
  const focus = opts.zoom ? lay.nodes.find(n => n.hub && n.cat === opts.zoom) : undefined
  const Z = focus ? 2.4 : 1
  const view = focus ? `${(focus.x - W / Z / 2).toFixed(0)} ${(focus.y - H / Z / 2).toFixed(0)} ${(W / Z).toFixed(0)} ${(H / Z).toFixed(0)}` : `0 0 ${W} ${H}`
  const dots = lay.nodes.filter(n => !n.hub)

  const build = (descLines: number, tips = true): string => {
    const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="${W}" height="${H}" style="background:${BG}">`]
    // Hover is plain CSS: the frame has no script. Each dot has a hit circle, and the card of dot i follows it.
    const ci = (cat: string) => Math.max(0, Object.keys(COLOR).indexOf(cat))
    const css = ['.h{cursor:pointer;fill:#000;fill-opacity:0.001}', '.t{opacity:0;pointer-events:none}', '.h:hover{stroke:#fff;stroke-opacity:0.9;stroke-width:1.5}', '.t rect{fill:#1a1f2e;stroke-opacity:0.8}', '.t text{fill:#9aa3b2;font:11px sans-serif}', '.t .a{fill:#fff;font:bold 13px sans-serif}', '.t .d{fill:#d4d9e4;font:11.5px sans-serif}']
    Object.keys(COLOR).forEach((cat, i) => css.push(`.f${i}{fill:${hex(color(cat))};fill-opacity:0.92}.s${i}{fill:none;stroke:${hex(color(cat))};stroke-opacity:0.55;stroke-width:1.4}.k${i} rect{stroke:${hex(color(cat))}}`))
    if (tips) dots.forEach((_, i) => css.push(`.h${i}:hover~.t${i}{opacity:1}`))
    out.push(`<style>${css.join('')}</style>`)
    out.push(`<rect x="-2000" y="-2000" width="${W + 4000}" height="${H + 4000}" fill="${BG}"/>`)
    out.push(
      '<defs><radialGradient id="bg" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#1c2236"/><stop offset="1" stop-color="#0e1016" stop-opacity="0"/></radialGradient></defs>' +
        `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
    )
    for (const r of [0.11, 0.21, 0.31].map(f => f * W)) out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.04"/>`)
    // A slow ripple from the middle, so the picture is never still.
    for (const begin of [0, 2.5, 5]) {
      out.push(
        `<circle cx="${W / 2}" cy="${H / 2}" r="20" fill="none" stroke="#8fb4ff" stroke-opacity="0"><animate attributeName="r" values="20;${(W * 0.33).toFixed(0)}" dur="7.5s" begin="${begin}s" repeatCount="indefinite"/><animate attributeName="stroke-opacity" values="0.22;0" dur="7.5s" begin="${begin}s" repeatCount="indefinite"/></circle>`,
      )
    }
    for (const e of lay.edges) {
      const mx = (e.from[0] + e.to[0]) / 2
      const my = (e.from[1] + e.to[1]) / 2
      const bx = mx - (e.to[1] - e.from[1]) * 0.16
      const by = my + (e.to[0] - e.from[0]) * 0.16
      out.push(`<path d="M${e.from[0].toFixed(1)} ${e.from[1].toFixed(1)} Q${bx.toFixed(1)} ${by.toFixed(1)} ${e.to[0].toFixed(1)} ${e.to[1].toFixed(1)}" fill="none" stroke="${hex(color(e.cat))}" stroke-opacity="0.3" stroke-width="1.6"/>`)
    }
    out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="20" fill="#171b27" stroke="#e6e9ef" stroke-opacity="0.85" stroke-width="2"/><circle cx="${W / 2}" cy="${H / 2}" r="6" fill="#e6e9ef"/>`)

    for (const n of lay.nodes) {
      if (!n.hub) continue
      const c = hex(color(n.cat))
      const x = n.x.toFixed(1)
      const y = n.y.toFixed(1)
      const reach = n.reach ?? 24
      const count = total.get(n.cat)
      // The name sits on the line to the middle, clear of the neighbours, which are all further out.
      const dx = W / 2 - n.x
      const dy = H / 2 - n.y
      const len = Math.hypot(dx, dy) || 1
      const lx = (n.x + (dx / len) * (reach + 30)).toFixed(1)
      const ly = (n.y + (dy / len) * (reach + 30) + 4).toFixed(1)
      out.push(
        `<circle cx="${x}" cy="${y}" r="${(reach + 10).toFixed(1)}" fill="${c}" fill-opacity="0.07"><animate attributeName="r" values="${(reach + 10).toFixed(1)};${(reach + 18).toFixed(1)};${(reach + 10).toFixed(1)}" dur="6s" repeatCount="indefinite"/></circle>` +
          `<circle cx="${x}" cy="${y}" r="14" fill="${c}"/><circle cx="${x}" cy="${y}" r="5" fill="${BG}"/>` +
          `<text x="${lx}" y="${ly}" fill="${c}" font-size="15" font-weight="bold" text-anchor="middle" font-family="sans-serif">${esc(opts.label ? opts.label(n.cat) : n.label)}</text>` +
          `<text x="${lx}" y="${(+ly + 17).toFixed(1)}" fill="#9aa3b2" font-size="12" text-anchor="middle" font-family="sans-serif">${count ? `${count.on}/${count.n}` : ''}</text>`,
      )
    }

    dots.forEach((n, i) => {
      const x = n.x.toFixed(0)
      const y = n.y.toFixed(0)
      const lit = glow(used, n.key, now)
      const inFocus = false
      const named = lit > 0 || (opts.uses?.[n.key] ?? 0) > 0 || inFocus
      const r = named ? 5.5 : 4.4
      // Names face outward from the hub, so neighbours on a ring do not write over each other.
      const left = inFocus && !!focus && n.x < focus.x
      if (named) out.push(`<text x="${(n.x + (left ? -9 : 9)).toFixed(0)}" y="${(n.y + 3).toFixed(0)}"${left ? ' text-anchor="end"' : ''} fill="#e6e9ef" font-size="${inFocus ? 5.5 : 12}" font-family="sans-serif" stroke="${BG}" stroke-width="3" paint-order="stroke">${esc(n.label)}</text>`)
      if (lit > 0) {
        const left = Math.round(lit * GLOW_MS)
        out.push(
          `<circle cx="${x}" cy="${y}" r="10" fill="${hex(color(n.cat))}" fill-opacity="0.22"><animate attributeName="r" values="26;10" dur="${left}ms" fill="freeze"/><animate attributeName="fill-opacity" values="0.5;0" dur="${left}ms" fill="freeze"/></circle>`,
        )
      }
      out.push(`<circle class="${n.on ? 'f' : 's'}${ci(n.cat)}" cx="${x}" cy="${y}" r="${r}"/><circle class="h h${i}" cx="${x}" cy="${y}" r="9"/>`)
    })

    // The cards come last, so nothing paints over them.
    dots.forEach((n, i) => {
      if (!tips) return
      const meta = `${opts.label ? opts.label(n.cat) : n.cat} · ${n.on ? states.on : states.off}`
      const note = opts.note?.(n.key) ?? ''
      const line2 = note ? `${meta} · ${note}` : meta
      const desc = descLines > 0 ? wrap(n.desc ?? '', 50, descLines) : []
      const widest = Math.max(clean(n.label).length * 1.15, clean(line2).length, ...desc.map(l => l.length))
      const w = Math.round(Math.min(340, Math.max(170, widest * 6.4 + 28)))
      const h = 50 + desc.length * 15 + (desc.length ? 4 : 0)
      let tx = n.x + 18
      if (tx + w > W - 8) tx = n.x - 18 - w
      const ty = Math.min(H - 8 - h, Math.max(8, n.y - 16))
      const X = (tx + 14).toFixed(0)
      const tspans = desc.map((l, j) => `<tspan x="${X}" y="${(ty + 56 + j * 15).toFixed(0)}">${esc(l)}</tspan>`).join('')
      out.push(
        `<g class="t t${i} k${ci(n.cat)}"${Z > 1 ? ` transform="translate(${n.x.toFixed(0)} ${n.y.toFixed(0)}) scale(${(1 / Z).toFixed(3)}) translate(${(-n.x).toFixed(0)} ${(-n.y).toFixed(0)})"` : ''}><rect x="${tx.toFixed(0)}" y="${ty.toFixed(0)}" width="${w}" height="${h}" rx="10"/>` +
          `<text class="a" x="${X}" y="${(ty + 22).toFixed(0)}">${esc(n.label)}</text>` +
          `<text x="${X}" y="${(ty + 39).toFixed(0)}">${esc(line2)}</text>` +
          (desc.length ? `<text class="d">${tspans}</text>` : '') +
          '</g>',
      )
    })

    if (!focus) out.push(`<text x="26" y="${H - 22}" fill="#9aa3b2" font-size="12" font-family="sans-serif">● ${esc(states.on)}   ○ ${esc(states.off)}</text>`)
    out.push('</svg>')
    return out.join('')
  }

  // The engine takes at most 131072 characters of markup: with many tools, the cards give up their descriptions first.
  for (const lines of [3, 2, 1, 0]) {
    const text = build(lines)
    if (text.length < 120000) return text
  }
  return build(0, false)
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=')
  }
  return out
}

const mix = (rgb: number, k: number): number => {
  const ch = (shift: number) => Math.round(((rgb >> shift) & 255) * k)
  return (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

/** The map as terminal cells: `columns x rows`, packed as `RasterProps.cells` wants. */
export function cells(lay: Layout, used: Record<string, number>, now: number, columns: number, rows: number, opts: Opts = {}): string {
  const W = lay.w
  const H = lay.h
  const grid = Array.from({ length: columns * rows }, () => ({ ch: 0x20, fg: 0x01000000 }))
  const put = (x: number, y: number, ch: number, fg: number) => {
    const cx = Math.round((x / W) * (columns - 1))
    const cy = Math.round((y / H) * (rows - 1))
    if (cx >= 0 && cx < columns && cy >= 0 && cy < rows) grid[cy * columns + cx] = { ch, fg }
  }
  for (const e of lay.edges) {
    for (let t = 0.05; t < 1; t += 0.03) put(e.from[0] + (e.to[0] - e.from[0]) * t, e.from[1] + (e.to[1] - e.from[1]) * t, 0xb7, mix(color(e.cat), 0.35))
  }
  put(W / 2, H / 2, 0x25cf, 0xe6e9ef)
  for (const n of lay.nodes) {
    if (n.hub) {
      put(n.x, n.y, 0x25c9, color(n.cat))
      // A cell holds one narrow character: a name in another script falls back to the English id.
      const label = opts.label && /^[\x20-\u024f]+$/.test(opts.label(n.cat)) ? opts.label(n.cat) : n.label
      const px = Math.round((n.x / W) * (columns - 1)) - Math.floor(label.length / 2)
      const py = Math.round(((n.y + (n.reach ?? 24) + 8) / H) * (rows - 1))
      for (let i = 0; i < label.length; i++) {
        const cx = px + i
        if (cx >= 0 && cx < columns && py >= 0 && py < rows) grid[py * columns + cx] = { ch: label.charCodeAt(i), fg: mix(color(n.cat), 0.8) }
      }
      continue
    }
    const lit = glow(used, n.key, now)
    put(n.x, n.y, lit > 0 ? 0x25cf : n.on ? 0x25cf : 0x25cb, mix(color(n.cat), lit > 0 ? 0.6 + 0.4 * lit : n.on ? 0.6 : 0.3))
    if (lit > 0 || (opts.uses?.[n.key] ?? 0) > 0) {
      const px = Math.round((n.x / W) * (columns - 1)) + 2
      const py = Math.round((n.y / H) * (rows - 1))
      const name = n.label.replace(/[^\x20-\u024f]/g, '').slice(0, 14)
      for (let i = 0; i < name.length; i++) {
        const cx = px + i
        if (cx < columns && py >= 0 && py < rows) grid[py * columns + cx] = { ch: name.charCodeAt(i), fg: mix(color(n.cat), 0.85) }
      }
    }
  }
  const words = new Uint32Array(columns * rows * 3)
  grid.forEach((c, i) => {
    words[i * 3] = c.ch
    words[i * 3 + 1] = c.fg
    words[i * 3 + 2] = 0x01000000
  })
  return base64(new Uint8Array(words.buffer))
}
