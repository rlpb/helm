// What the Map and the resting row share: one color per category, how long a used tool stays lit, and the base64 the meters' character grid needs.

/** How long a used tool glows, in milliseconds. */
export const GLOW_MS = 6000

// One color per category, bright enough for a dark background.
export const COLOR: Record<string, number> = {
  build: 0x5aa9ff,
  write: 0xf2b84b,
  research: 0x6fd08c,
  science: 0xf08f5a,
  design: 0xe879b9,
  web: 0x4fd1d9,
  data: 0xb28cff,
  security: 0xff7a6b,
  business: 0x6fb7a8,
  docs: 0xc9a66b,
  setup: 0x9aa7b8,
  other: 0x8a8f98,
}

/** How lit a tool is, 0 (dark) to 1 (just used). */
export const glow = (used: Record<string, number>, key: string, now: number): number => {
  const at = used[key]
  return at === undefined ? 0 : Math.max(0, 1 - (now - at) / GLOW_MS)
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
