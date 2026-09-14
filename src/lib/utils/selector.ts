export type Selector = `0x${string}`

// 4-byte function selector = first 10 hex chars of calldata. Empty calldata
// has none. Kept in its own module: both classification and intent decoding
// need it, and neither should import the other for it.
export function calldataSelector(input: string): Selector | null {
  return input.length >= 10 ? (input.slice(0, 10) as Selector) : null
}
