// The live map of everything installed: one hub per category, one dot per tool around it. A tool
// that Claude just used lights up and fades. Pure: an index and a list of recent uses in, a picture
// out. SVG for desktop, editor and phone (it animates by itself, so a redraw costs nothing between
// uses); a grid of colored cells for the terminal.

import type { Entry } from '../types'

export const W = 640
export const H = 400
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
export function svg(lay: Layout, used: Record<string, number>, now: number): string {
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`]
  out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="7" fill="#e6e9ef"/>`)
  for (const e of lay.edges) out.push(`<line x1="${e.from[0].toFixed(1)}" y1="${e.from[1].toFixed(1)}" x2="${e.to[0].toFixed(1)}" y2="${e.to[1].toFixed(1)}" stroke="${hex(color(e.cat))}" stroke-opacity="0.25"/>`)
  for (const n of lay.nodes) {
    const c = hex(color(n.cat))
    const x = n.x.toFixed(1)
    const y = n.y.toFixed(1)
    if (n.hub) {
      out.push(`<circle cx="${x}" cy="${y}" r="9" fill="${c}"/><text x="${x}" y="${(n.y + (n.reach ?? 24) + 16).toFixed(1)}" fill="${c}" font-size="12" text-anchor="middle" font-family="sans-serif">${esc(n.label)}</text>`)
      continue
    }
    const lit = glow(used, n.key, now)
    const base = n.on ? 0.75 : 0.25
    if (lit > 0) {
      const left = Math.round(lit * GLOW_MS)
      out.push(
        `<circle cx="${x}" cy="${y}" r="5" fill="${c}" fill-opacity="${base}"><title>${esc(n.label)}</title>` +
          `<animate attributeName="r" values="11;5" dur="${left}ms" fill="freeze"/>` +
          `<animate attributeName="fill-opacity" values="1;${base}" dur="${left}ms" fill="freeze"/></circle>`,
      )
    } else {
      out.push(`<circle cx="${x}" cy="${y}" r="4" fill="${c}" fill-opacity="${base}"><title>${esc(n.label)}</title></circle>`)
    }
  }
  out.push('</svg>')
  return out.join('')
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(bytes: Uint8Array): string {
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
export function cells(lay: Layout, used: Record<string, number>, now: number, columns: number, rows: number): string {
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
      const px = Math.round((n.x / W) * (columns - 1)) - Math.floor(n.label.length / 2)
      const py = Math.round(((n.y + (n.reach ?? 24) + 8) / H) * (rows - 1))
      for (let i = 0; i < n.label.length; i++) {
        const cx = px + i
        if (cx >= 0 && cx < columns && py >= 0 && py < rows) grid[py * columns + cx] = { ch: n.label.charCodeAt(i), fg: mix(color(n.cat), 0.8) }
      }
      continue
    }
    const lit = glow(used, n.key, now)
    put(n.x, n.y, lit > 0 ? 0x25cf : n.on ? 0x25cf : 0x25cb, mix(color(n.cat), lit > 0 ? 0.6 + 0.4 * lit : n.on ? 0.6 : 0.3))
  }
  const words = new Uint32Array(columns * rows * 3)
  grid.forEach((c, i) => {
    words[i * 3] = c.ch
    words[i * 3 + 1] = c.fg
    words[i * 3 + 2] = 0x01000000
  })
  return base64(new Uint8Array(words.buffer))
}
