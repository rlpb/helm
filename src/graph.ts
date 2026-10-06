// The live map of everything installed: one hub per category, one dot per tool around it. A tool
// that Claude just used lights up and fades. Pure: an index and a list of recent uses in, a picture
// out. SVG for desktop, editor and phone (it animates by itself, so a redraw costs nothing between
// uses); a grid of colored cells for the terminal.

import type { Entry } from '../types'

export const W = 760
export const H = 460
/** How long a used tool glows, in milliseconds. */
export const GLOW_MS = 6000

export type Node = { key: string; cat: string; x: number; y: number; hub: boolean; label: string; on: boolean; /** How far its dots reach, so the label can sit clear of them. */ reach?: number }
export type Edge = { from: [number, number]; to: [number, number]; cat: string }
export type Layout = { nodes: Node[]; edges: Edge[] }

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
export function layout(index: Entry[]): Layout {
  const groups = new Map<string, Entry[]>()
  for (const e of index) groups.set(e.category, [...(groups.get(e.category) ?? []), e])
  const cats = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length || a.localeCompare(b))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const cx = W / 2
  const cy = H / 2
  cats.forEach((cat, i) => {
    const angle = (i / Math.max(cats.length, 1)) * Math.PI * 2 - Math.PI / 2
    const hx = cx + Math.cos(angle) * (W * 0.32)
    const hy = cy + Math.sin(angle) * (H * 0.32)
    const rings = Math.floor(Math.sqrt((groups.get(cat)!.length - 1) / 4))
    nodes.push({ key: `hub:${cat}`, cat, x: hx, y: hy, hub: true, label: cat, on: true, reach: 24 + rings * 16 })
    edges.push({ from: [cx, cy], to: [hx, hy], cat })
    const list = groups.get(cat)!
    list.forEach((e, j) => {
      // Ring 0 holds 8, then each ring one more and a bit wider: dots never touch.
      const ring = Math.floor(Math.sqrt(j / 4))
      const first = 4 * ring * ring
      const inRing = 4 * (ring + 1) * (ring + 1) - first
      const a = ((j - first) / inRing) * Math.PI * 2 + angle
      const r = 24 + ring * 16
      nodes.push({ key: e.key, cat, x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r, hub: false, label: e.name, on: e.on })
    })
  })
  return { nodes, edges }
}

/** How lit a tool is, 0 (dark) to 1 (just used). */
export const glow = (used: Record<string, number>, key: string, now: number): number => {
  const at = used[key]
  return at === undefined ? 0 : Math.max(0, 1 - (now - at) / GLOW_MS)
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/** The map as SVG. A used tool's glow fades by itself over what is left of GLOW_MS. */
export type Opts = {
  /** A category id in the language shown. */
  label?: (cat: string) => string
  /** Tools used at least once, by key: they get a name on the map. */
  uses?: Record<string, number>
}

export function svg(lay: Layout, used: Record<string, number>, now: number, opts: Opts = {}): string {
  const BG = '#12141a'
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`]
  out.push(`<rect width="${W}" height="${H}" rx="18" fill="${BG}"/>`)
  for (const r of [90, 170, 250]) out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity="0.045"/>`)
  const total = new Map<string, { n: number; on: number }>()
  for (const n of lay.nodes) if (!n.hub) total.set(n.cat, { n: (total.get(n.cat)?.n ?? 0) + 1, on: (total.get(n.cat)?.on ?? 0) + (n.on ? 1 : 0) })
  for (const e of lay.edges) {
    const mx = (e.from[0] + e.to[0]) / 2
    const my = (e.from[1] + e.to[1]) / 2
    // A gentle bend, always to the same side, so the spokes read as a wheel.
    const bx = mx - (e.to[1] - e.from[1]) * 0.12
    const by = my + (e.to[0] - e.from[0]) * 0.12
    out.push(`<path d="M${e.from[0].toFixed(1)} ${e.from[1].toFixed(1)} Q${bx.toFixed(1)} ${by.toFixed(1)} ${e.to[0].toFixed(1)} ${e.to[1].toFixed(1)}" fill="none" stroke="${hex(color(e.cat))}" stroke-opacity="0.32" stroke-width="1.5"/>`)
  }
  out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="16" fill="#1d2028" stroke="#e6e9ef" stroke-opacity="0.8" stroke-width="2"/><circle cx="${W / 2}" cy="${H / 2}" r="5" fill="#e6e9ef"/>`)
  for (const n of lay.nodes) {
    const c = hex(color(n.cat))
    const x = n.x.toFixed(1)
    const y = n.y.toFixed(1)
    if (n.hub) {
      const reach = n.reach ?? 24
      const count = total.get(n.cat)
      out.push(
        `<circle cx="${x}" cy="${y}" r="${reach + 8}" fill="${c}" fill-opacity="0.07"/>` +
          `<circle cx="${x}" cy="${y}" r="12" fill="${c}"/><circle cx="${x}" cy="${y}" r="4" fill="${BG}"/>` +
          `<text x="${x}" y="${(n.y + reach + 24).toFixed(1)}" fill="${c}" font-size="13" font-weight="bold" text-anchor="middle" font-family="sans-serif">${esc(opts.label ? opts.label(n.cat) : n.label)}</text>` +
          `<text x="${x}" y="${(n.y + reach + 40).toFixed(1)}" fill="#9aa3b2" font-size="11" text-anchor="middle" font-family="sans-serif">${count ? `${count.on}/${count.n}` : ''}</text>`,
      )
      continue
    }
    const lit = glow(used, n.key, now)
    const named = lit > 0 || (opts.uses?.[n.key] ?? 0) > 0
    // A tool that is on is a filled dot, one that is off a hollow ring.
    const dot = (r: number, inner: string) =>
      n.on
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="0.9">${inner}</circle>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-opacity="0.5" stroke-width="1.3">${inner}</circle>`
    if (named) out.push(`<text x="${(n.x + 10).toFixed(1)}" y="${(n.y + 4).toFixed(1)}" fill="#e6e9ef" font-size="11" font-family="sans-serif" stroke="${BG}" stroke-width="3" paint-order="stroke">${esc(n.label)}</text>`)
    if (lit > 0) {
      const left = Math.round(lit * GLOW_MS)
      out.push(
        `<circle cx="${x}" cy="${y}" r="9" fill="${c}" fill-opacity="0.22"><animate attributeName="r" values="22;9" dur="${left}ms" fill="freeze"/><animate attributeName="fill-opacity" values="0.5;0" dur="${left}ms" fill="freeze"/></circle>` +
          dot(5.5, `<title>${esc(n.label)}</title>`),
      )
    } else {
      out.push(dot(named ? 5 : 4, `<title>${esc(n.label)}</title>`))
    }
  }
  out.push('</svg>')
  return out.join('')
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
