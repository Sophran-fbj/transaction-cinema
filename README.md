# Transaction Cinema

[![CI](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml/badge.svg)](https://github.com/Sophran-fbj/transaction-cinema/actions/workflows/ci.yml)

**Turn any onchain transaction into a short animated story.**

Paste a mainnet transaction hash, press play, and watch an 11–15 second film:
value flies between wallets, liquidity tunnels swallow and return it, failed
transactions rewind while the gas is still paid. No wallet connection, no
indexing APIs — every number on screen is decoded by this app from raw
JSON-RPC data.

<!-- TODO before sharing: deploy (Vercel one-click), then add:
- Live demo link here
- A hero screenshot: ![screenshot](docs/screenshot.png)
- A 10–20s GIF of the V3 swap film playing
-->

## Now showing (all real mainnet transactions)

| Film | Kind | What happens |
|---|---|---|
| Through the liquidity tunnel | Uniswap V3 swap | 383.54 USDC enters a V3 pool; the price needle settles on the real terminal tick; 0.1534 WETH exits |
| ETH through the wrapping gate | ETH-bridged V3 swap | the router wraps ETH as WETH, 400 USDC comes out, change refunded — detected through the relayed WETH leg |
| Ten trillion UNI, rejected | Failed tx | a huge approval is attempted; the world says no; everything rewinds — except the gas |
| An infinite key to a USDC vault | Approval | `approve(spender, max uint256)` — the signed blank check, visualized as a vault key |
| Fifteen hundred USDT | ERC20 transfer | tokens move, ETH does not; one Transfer event tells the whole story |
| Two ETH, pocket to pocket | ETH transfer | the smallest complete story |

## What is supported

| Transaction kind | Story | Status |
|---|---|---|
| ETH value transfer | full film | ✅ supported |
| ERC20 transfer | full film | ✅ supported |
| ERC20 approval (limited / unlimited / revoke) | full film | ✅ supported |
| Uniswap V3 swap (single pool, any router) | full film | ✅ supported |
| ETH-bridged V3 swap (router wraps/unwraps WETH) | full film | ✅ supported |
| Reverted tx with decodable calldata | attempt → no → rewind | ✅ supported |
| Uniswap V2 swaps, multi-hop V3, aggregators | — | 🚧 planned |
| ERC721 / ERC1155 transfers | — | 🚧 planned |
| Contract creation, arbitrary contract calls | generic receipt framing | 🚧 planned |
| Other chains (Base, Arbitrum, Optimism) | — | 🚧 planned |
| Anything the rules can't classify | honest "unknown" film with raw selector | ⛔ never faked |

The fallback is a feature: when the pipeline doesn't understand a
transaction, it says so with the raw 4-byte selector instead of inventing a
story.

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
  animation has a semantic reason to exist — the V3 needle's sweep length is
  derived from the real trade size (`tickSpanFor`), and its destination is the
  real terminal tick.
- **Reverted txs have no logs** — events are discarded on revert. Their story
  is built from calldata intent (`decodeFunctionData` + an honest `unknown`
  fallback that shows the raw 4-byte selector instead of pretending). The
  alternative — reading revert reasons from traces — needs archive-node
  methods most public endpoints rate-limit, and reverts on EVM mainnet carry
  no events to decode anyway; the intent is what the user actually signed.
- **Honest attribution.** V3 pools are identical bytecode across forks, so
  "Uniswap V3" is only claimed after asking the pool for its `factory()`.
- **Enrichment is optional.** Token metadata and pool attribution are best
  effort (`Promise.allSettled` in `enrichBundle`): if those calls fail after
  the base bundle exists, the film still plays — with raw amounts and generic
  labels — and the UI says so, with a retry.

### Where things live

```
src/lib/chain/         RPC clients + chains (browser proxy-aware)
src/lib/fetch/         getTxBundle (RPC → bundle), fixtures
src/lib/decode/        log/calldata decoding, token & pool enrichment
src/lib/classify/      rule engine → discriminated-union TxKind
src/lib/story/         Story IR types + one builder per TxKind
src/lib/story/semantics.ts   amount → animation-parameter mapping
src/components/scenes/ one dumb renderer component per Scene type
src/components/stage/  player chrome (Stage, timeline, subtitles)
src/app/api/rpc/       same-origin RPC proxy (optional, server-only key)
tests/                 vitest suites over frozen real-tx fixtures
scripts/               fixture capture + demo-tx finders
```

## What is real vs. what is theatre

A core discipline of this project: if an animation does not map to data, it is
decoration, and it gets cut.

| Real (from RPC) | Theatre (deliberately stylized) |
|---|---|
| amounts, addresses, gas × price, block, timestamp | particle flight paths |
| V3 terminal tick / sqrtPriceX96 / active liquidity | needle sweep length (derived from real trade size; destination is real) |
| execution price from actual amounts | corridor glow intensity (log of real liquidity) |
| pool fee tier + factory attribution | tank/tunnel/void visual language |
| "attempted" wording on failed txs | rewind choreography |

## Tech

Next.js 16 (App Router) · React 19 · TypeScript · viem · Tailwind CSS v4 ·
Framer Motion · vitest (52 tests, fixture-driven, fully offline)

## Run it

```bash
npm ci             # Node >= 20.9 (see .nvmrc)
npm run dev        # http://localhost:3000
npm test           # 52 tests against frozen real-tx fixtures
npm run build      # fully offline — fonts are self-hosted
```

### RPC configuration

Works with zero configuration: the browser falls back through a list of
public endpoints. Two optional knobs (see `.env.example`):

- `NEXT_PUBLIC_RPC_URL` — a direct-from-browser endpoint tried before the
  public fallbacks (after the proxy). **It is inlined into the client bundle
  and visible to every visitor. Never put a key here that must stay secret.**
- `RPC_URL` — **server-only**. When set, browser requests route through the
  same-origin proxy at `src/app/api/rpc/route.ts`, which keeps the key off the
  client, times out upstream calls (15s), and caches immutable reads (mined
  txs, receipts, historical blocks) in a small LRU. This is the recommended
  setup for anything key-bearing.

## Scripts

```
scripts/find-*.mjs          scan mainnet for demo transactions of each kind
scripts/capture-fixture.mjs freeze a tx's raw RPC responses as a test fixture
```

## Why no Etherscan

RPC-first architecture: no indexing APIs (Etherscan/Covalent/Moralis), no
metadata APIs (token logos are deterministically generated from addresses),
no USD prices (raw amounts only). The app talks to plain JSON-RPC endpoints
and decodes everything itself. That keeps the dependency surface to one
primitive, makes every on-screen value auditable back to `eth_getTransaction*`
responses, and means the decode pipeline runs identically offline (fixtures)
and online — there is no second data source to drift.

## Known limitations

- **Single chain.** Ethereum mainnet only; the route validates `/play/eth/…`
  and everything else is rejected up front.
- **Rich multi-log txs get simplified.** A swap that touches several pools is
  told through its largest leg, not every hop; aggregators are not yet
  attributed.
- **Public RPC rate limits.** Without `RPC_URL`, a burst of plays can hit
  public-endpoint quotas; the UI offers retry, and enrichment failures
  degrade instead of failing.
- **Metadata assumptions.** ERC20 `name/symbol/decimals` are whatever the
  contract returns; a lying contract is shown as-is. When the multicall
  fails, amounts are shown raw (18-decimal assumption flagged on screen).
- **No receipts before the block.** Pending txs have no story yet — the
  player explains and offers retry.

## Adding a new transaction kind

1. **Decode** — extend `src/lib/decode/` if you need new event/Calldata
   parsing (pure functions: raw shapes → typed signals).
2. **Classify** — add a rule in `src/lib/classify/kinds.ts`; `TxKind` is a
   discriminated union, so the compiler tracks exhaustiveness for you.
3. **Story** — add a builder in `src/lib/story/builders/` and register it in
   the registry (`src/lib/story/build.ts`). Emit `Scene[]` + cast + captions;
   derive animation parameters via `src/lib/story/semantics.ts`, never inline
   magic numbers in the renderer.
4. **Render** — if the existing scene components don't cover it, add one
   scene variant to the `Scene` union in `src/lib/story/types.ts` and a case
   in `SceneRenderer` (the switch is exhaustive — it won't compile without
   the case).
5. **Freeze a fixture** — `scripts/capture-fixture.mjs <hash>` drops the raw
   RPC responses into `src/fixtures/`, then add a test in `tests/`.

## Deployment & CI

- GitHub Actions (`.github/workflows/ci.yml`): `npm ci → lint → test → build`
  on every push/PR, pinned to the Node version in `.nvmrc`.
- Security headers (nosniff, strict referrer, frame-deny, permissions lock)
  are set in `next.config.ts`.
- Deploys as a standard Next.js app (e.g. Vercel); the RPC proxy route needs
  a Node/serverless runtime, not a static export.
