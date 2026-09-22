// Data → animation semantics. This module is the deliberate boundary between
// "what happened onchain" (bigint amounts) and "how heavy it should feel"
// (particle counts). Concentrating the mapping here keeps the renderer honest:
// it draws exactly what it is given, and every magic number has one home.

// Log scale, capped: 0.5 ETH ≈ 2 particles, 2 ETH ≈ 6, 100 ETH ≈ 24, 10k ETH = 48
export function visualMassForEth(value: bigint): number {
  const eth = Number(value) / 1e18
  return Math.min(64, Math.max(1, Math.round(12 * Math.log10(1 + eth))))
}

// Same scale in human token units (post-decimals): 1 unit ≈ 4, 1k ≈ 36.
export function visualMassForToken(value: bigint, decimals: number): number {
  const units = Number(value) / 10 ** decimals
  if (!Number.isFinite(units)) return 64
  return Math.min(64, Math.max(1, Math.round(12 * Math.log10(1 + units))))
}

// How brightly the liquidity corridor glows, from real active liquidity.
// V3 pools sit anywhere from ~1e16 (thin) to ~1e24+ (deep); log-normalize.
export function liquidityGlow(liquidity: bigint): number {
  const l = Number(liquidity)
  if (!Number.isFinite(l) || l <= 0) return 0.15
  const norm = Math.min(1, Math.max(0, Math.log10(l) / 24))
  return 0.2 + norm * 0.7
}

// Stylized needle sweep: how many ticks the pointer visually travels. The
// terminal tick is real; the start is derived — larger trades sweep further.
export function tickSpanFor(amountIn: bigint, decimalsIn: number): number {
  const units = Number(amountIn) / 10 ** decimalsIn
  if (!Number.isFinite(units)) return 12
  return Math.min(60, Math.max(4, Math.round(3 * Math.log10(1 + units) + 2)))
}

// Reserve tank level for V2 pairs. Token units vary wildly, so logarithmic
// normalization conveys depth without pretending unlike assets are directly
// comparable. The exact reserves remain printed beside the tanks.
export function reserveLevelFor(reserve: bigint, decimals: number): number {
  const units = Number(reserve) / 10 ** decimals
  if (!Number.isFinite(units) || units <= 0) return 0.25
  return Math.min(0.92, Math.max(0.25, 0.25 + Math.log10(1 + units) * 0.08))
}
