import { expect, test, type Page, type Route } from '@playwright/test'
import nativeFixture from '../src/fixtures/native-transfer/0x83a429974a3270dd66c7a79cadbcfb4f1e3778978556b52c4de9c87eb871f653.json'
import v2Fixture from '../src/fixtures/uniswap-v2-swap/0xf573e1e394f1100359b6c3efbaa1bbbeed2a50cd29ed077c2cbf9c077d19c072.json'

type RpcRequest = {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: unknown[]
}

type RawFixture = {
  transaction: unknown
  receipt: unknown
  block: unknown
}

function answerRpc(request: RpcRequest, fixture: RawFixture) {
  const rpcResults: Record<string, unknown> = {
    eth_chainId: '0x1',
    eth_getTransactionByHash: fixture.transaction,
    eth_getTransactionReceipt: fixture.receipt,
    eth_getBlockByNumber: fixture.block,
    // Deliberately make optional enrichment undecodable. The player must keep
    // going with raw amounts and a generic pool label instead of using public
    // RPC fallbacks or failing the film.
    eth_call: '0x',
  }
  if (!(request.method in rpcResults)) {
    return {
      jsonrpc: '2.0' as const,
      id: request.id,
      error: { code: -32601, message: `Unexpected test RPC method: ${request.method}` },
    }
  }
  return { jsonrpc: '2.0' as const, id: request.id, result: rpcResults[request.method] }
}

async function fulfillRpc(route: Route, fixture: RawFixture) {
  const body = route.request().postDataJSON() as RpcRequest | RpcRequest[]
  const response = Array.isArray(body)
    ? body.map((request) => answerRpc(request, fixture))
    : answerRpc(body, fixture)
  await route.fulfill({ status: 200, contentType: 'application/json', json: response })
}

async function mockFixtureRpc(page: Page, fixture: RawFixture = nativeFixture) {
  await page.route('**/api/rpc', (route) => fulfillRpc(route, fixture))
  // The same-origin transport should satisfy every request. Abort any direct
  // fallback so a regression cannot make this suite depend on public RPCs.
  await page.route(/^https:\/\/(eth\.drpc\.org|1rpc\.io|ethereum-rpc\.publicnode\.com)\//, (route) =>
    route.abort(),
  )
}

test('the lobby validates input and exposes the curated program', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Turn any onchain transaction/i })).toBeVisible()
  await expect(page.getByText('real mainnet films')).toBeVisible()
  await expect(page.getByRole('link', { name: /Through the liquidity tunnel/i })).toBeVisible()

  await page.getByLabel('Transaction hash').fill('not-a-transaction')
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(
    page.getByText('A transaction hash is 0x followed by 64 hex characters.'),
  ).toBeVisible()
  await expect(page).toHaveURL('/')
})

test('a fixture-backed transaction plays and its controls remain interactive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockFixtureRpc(page)

  await page.goto(`/play/eth/${nativeFixture.hash}`)

  await expect(page.getByRole('heading', { name: 'ETH Transfer' })).toBeVisible()
  await expect(page.getByText(/2 ETH from/)).toBeVisible()
  await expect(page.getByText('Scene 1/4 · Opening')).toBeVisible()

  await page.getByRole('button', { name: 'Scene 2 of 4: Transfer' }).click()
  await expect(page.getByText('Scene 2/4 · Transfer')).toBeVisible()
  await expect(page.getByText('2 ETH leaves the wallet')).toBeVisible()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByRole('button', { name: 'Play', exact: true }).last()).toBeVisible()
  await page.getByRole('button', { name: 'Replay', exact: true }).click()
  await expect(page.getByText('Scene 1/4 · Opening')).toBeVisible()
})

test('the V2 film renders from raw logs even when enrichment degrades', async ({ page }) => {
  await mockFixtureRpc(page, v2Fixture)
  await page.goto(`/play/eth/${v2Fixture.hash}`)

  await expect(page.getByText('Scene 1/4 · Opening')).toBeVisible()
  await expect(page.getByRole('status')).toContainText(
    'Pool attribution unavailable — shown as a generic AMM pool.',
  )

  await page.getByRole('button', { name: 'Scene 2 of 4: Swap' }).click()
  await expect(page.getByText('Scene 2/4 · Swap')).toBeVisible()
  await expect(page.getByText('x × y = k')).toBeVisible()
  await expect(page.getByText('V2 Pool', { exact: true })).toBeVisible()
})
