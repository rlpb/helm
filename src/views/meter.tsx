// A small bar for a limit: how full it is, in a color that warns as it fills. The terminal gets
// colored cells (crisp in any font); everything else gets a tiny SVG, because a text bar breaks in a
// proportional font.

import { base64 } from '../graph'

export const levelColor = (pct: number): number => (pct < 60 ? 0x6fd08c : pct < 85 ? 0xf2b84b : 0xff7a6b)
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const clamp = (pct: number) => Math.max(0, Math.min(100, Math.round(pct)))

/** `columns x 1` cells: filled blocks in the level color, the rest a dim track. */
export function meterCells(pct: number, columns: number): string {
  const filled = Math.round((clamp(pct) / 100) * columns)
  const words = new Uint32Array(columns * 3)
  for (let i = 0; i < columns; i++) {
    const on = i < filled
    words[i * 3] = on ? 0x2588 : 0x2591
    words[i * 3 + 1] = on ? levelColor(pct) : 0x5b6578
    words[i * 3 + 2] = 0x01000000
  }
  return base64(new Uint8Array(words.buffer))
}

export function meterSvg(pct: number, width = 64): string {
  const filled = Math.max(pct > 0 ? 4 : 0, Math.round((clamp(pct) / 100) * width))
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 8" width="${width}" height="8">` +
    `<rect width="${width}" height="8" rx="4" fill="#8a94a8" fill-opacity="0.28"/>` +
    `<rect width="${filled}" height="8" rx="4" fill="${hex(levelColor(pct))}"/></svg>`
  )
}

type Props = { ui: any; terminal: boolean; id: string; label: string; pct: number }

/** `label  ████░░░░  41%` */
export function Meter({ ui, terminal, id, label, pct }: Props) {
  const { Box, Raster, Svg, Text } = ui
  return (
    <Box key={id} columnGap={1}>
      <Text dimColor>{label}</Text>
      {terminal ? <Raster key={`m-${label}`} columns={8} rows={1} cells={meterCells(pct, 8)} /> : <Svg source={meterSvg(pct)} alt={`${label} ${clamp(pct)}%`} width={64} height={8} />}
      <Text bold>{`${clamp(pct)}%`}</Text>
    </Box>
  )
}
