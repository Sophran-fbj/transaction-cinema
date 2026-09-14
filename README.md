# Transaction Cinema

**Turn any onchain transaction into a short animated story.**

Paste a mainnet transaction hash, press play, and watch an 11–15 second film:
value flies between wallets, liquidity tunnels swallow and return it, failed
transactions rewind while the gas is still paid. No wallet connection, no
backend, no API keys — every number on screen is decoded by this app from raw
JSON-RPC data.

## Now showing (all real mainnet transactions)

| Film | Kind | What happens |
|---|---|---|
| Through the liquidity tunnel | Uniswap V3 swap | 383.54 USDC enters a V3 pool; the price needle settles on the real terminal tick; 0.1534 WETH exits |
| Ten trillion UNI, rejected | Failed tx | a huge approval is attempted; the world says no; everything rewinds — except the gas |
| An infinite key to a USDC vault | Approval | `approve(spender, max uint256)` — the signed blank check, visualized as a vault key |
| Fifteen hundred USDT | ERC20 transfer | tokens move, ETH does not; one Transfer event tells the whole story |
| Two ETH, pocket to pocket | ETH transfer | the smallest complete story |

## Architecture

A pure-function pipeline. Every stage after the RPC calls is deterministic and
tested against frozen fixtures of real transactions.

```
raw JSON-RPC  ──►  decode      ──►  classify        ──►  story builder    ──►  renderer
(getTransaction,   (events +        (rule engine →         (kind → Scene[]    (React + Framer
 receipt, block)    calldata         discriminated          IR + cast +        Motion, knows
                    intent)          union TxKind)          captions)          only Scene types)
```

Key properties:

- **Event-driven classification.** An ERC20 Transfer event matches any emitter,
  a V3 Swap event carries the full terminal state — so stories can be told
  without traces, archive nodes, or router whitelists (the demo swap is routed
  through the Universal Router; the detector never needed to know).
- **The Story IR separates data from theatre.** `Scene[]` is the only thing the
  renderer understands. Animation parameters (particle counts, liquid levels,
  needle sweeps) are computed in the story layer from real amounts, so every
  animation has a semantic reason to exist.
- **Reverted txs have no logs** — events are discarded on revert. Their story
  is built from calldata intent (`decodeFunctionData` + an honest `unknown`
  fallback that shows the raw 4-byte selector instead of pretending).
- **Honest attribution.** V3 pools are identical bytecode across forks, so
  "Uniswap V3" is only claimed after asking the pool for its `factory()`.

## What is real vs. what is theatre

A core discipline of this project: if an animation does not map to data, it is
decoration, and it gets cut.

| Real (from RPC) | Theatre (deliberately stylized) |
|---|---|
| amounts, addresses, gas × price, block, timestamp | particle flight paths |
| V3 terminal tick / sqrtPriceX96 / active liquidity | needle sweep path (destination is real, start is derived) |
| execution price from actual amounts | corridor glow intensity (log of real liquidity) |
| pool fee tier + factory attribution | tank/tunnel/void visual language |
| "attempted" wording on failed txs | rewind choreography |

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · viem · Tailwind CSS v4 ·
Framer Motion · vitest (35 tests, fixture-driven, fully offline)

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 35 tests against frozen real-tx fixtures
npm run build
```

Optionally set `NEXT_PUBLIC_RPC_URL` (e.g. a free Alchemy endpoint) to
prioritize your own RPC quota; public endpoints are used otherwise.

## Scripts

```
scripts/find-*.mjs          scan mainnet for demo transactions of each kind
scripts/capture-fixture.mjs freeze a tx's raw RPC responses as a test fixture
```

## Why no Etherscan

RPC-first architecture: no indexing APIs (Etherscan/Covalent/Moralis), no
metadata APIs (token logos are deterministically generated from addresses),
no USD prices (raw amounts only). The app talks to plain public JSON-RPC
endpoints and decodes everything itself.
