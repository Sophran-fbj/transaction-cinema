// Curated demo transactions. Hashes are real mainnet txs; the list covers
// every story kind the pipeline can tell. durationLabel is the film's
// approximate runtime (scene durations, hand-summed).
export interface Preset {
  hash: `0x${string}`
  kindLabel: string
  title: string
  blurb: string
  durationLabel: string
}

export const DEMO_PRESETS: Preset[] = [
  {
    hash: '0xf573e1e394f1100359b6c3efbaa1bbbeed2a50cd29ed077c2cbf9c077d19c072',
    kindLabel: 'V2 swap',
    title: 'The constant-product balance',
    blurb: '197.01 UNI tips the reserve tanks — 0.6436 WETH flows out.',
    durationLabel: '13s',
  },
  {
    hash: '0xfc27562d1a9aa37c3a1a145d75f71908b3f1ee9bb1d54d5a0d3a8c2913bae0a6',
    kindLabel: 'V3 swap',
    title: 'Through the liquidity tunnel',
    blurb: '383.54 USDC enters a V3 pool — 0.1534 WETH comes out the far end.',
    durationLabel: '13s',
  },
  {
    hash: '0x4a5003ec93b14d06d27547f844f0008dae826b9076587d5de87b86be881706ee',
    kindLabel: 'ETH swap',
    title: 'ETH through the wrapping gate',
    blurb: 'The router wraps ETH as WETH, 400 USDC comes out, change refunded.',
    durationLabel: '13s',
  },
  {
    hash: '0xa5ac0a2aace0e5746f981adabc44913cf46aa3fedc2026caabd3a594a912a3d9',
    kindLabel: 'Failed tx',
    title: 'Ten trillion UNI, rejected',
    blurb: 'A huge approval is attempted. The chain says no. The gas is real.',
    durationLabel: '15s',
  },
  {
    hash: '0x668afe8af152c3e3275ce81ab9b245ff7ae603f007fa950a6e75bc88e13b8831',
    kindLabel: 'Approval',
    title: 'An infinite key to a USDC vault',
    blurb: 'approve(spender, max uint256) — the signed blank check.',
    durationLabel: '12s',
  },
  {
    hash: '0x3876a9b88de5054abd2925b0dc2503b36af3406aee70dbeda5067399b0f29825',
    kindLabel: 'ERC20 transfer',
    title: 'Fifteen hundred USDT, one Transfer event',
    blurb: 'Tokens move, ETH does not — the event log tells the story.',
    durationLabel: '11s',
  },
  {
    hash: '0x83a429974a3270dd66c7a79cadbcfb4f1e3778978556b52c4de9c87eb871f653',
    kindLabel: 'ETH transfer',
    title: 'Two ETH, pocket to pocket',
    blurb: 'A plain value move — the smallest complete story.',
    durationLabel: '11s',
  },
]
