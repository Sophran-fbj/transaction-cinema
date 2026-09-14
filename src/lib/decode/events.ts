import {
  erc20Abi,
  getAddress,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
} from 'viem'

// Event decode is per-standard, not per-contract: the ERC20 Transfer signature
// matches any emitter, which is why classification can lean on logs even for
// contracts we hold no ABI for (calldata decode, by contrast, needs an ABI).

export interface Erc20TransferEvent {
  token: Address
  from: Address
  to: Address
  value: bigint
}

export interface Erc20ApprovalEvent {
  token: Address
  owner: Address
  spender: Address
  value: bigint
}

// ERC721 Transfer has the same name but 3 indexed params → different topic0,
// so it never matches the erc20Abi signature. No false positives here.
export function parseErc20Transfers(
  receipt: TransactionReceipt,
): Erc20TransferEvent[] {
  const logs = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Transfer',
    logs: receipt.logs,
    strict: false,
  })

  // strict:false types every arg as optional; a matched ERC20 Transfer always
  // carries from/to/value, so narrowing here is a type-level formality.
  return logs.flatMap((log) => {
    const { from, to, value } = log.args
    if (from === undefined || to === undefined || value === undefined) return []
    return [
      {
        // normalize at the decode boundary: topics arrive lowercase, tx fields
        // arrive checksummed — one convention downstream from here on
        token: getAddress(log.address),
        from: getAddress(from),
        to: getAddress(to),
        value,
      },
    ]
  })
}

export function parseErc20Approvals(
  receipt: TransactionReceipt,
): Erc20ApprovalEvent[] {
  const logs = parseEventLogs({
    abi: erc20Abi,
    eventName: 'Approval',
    logs: receipt.logs,
    strict: false,
  })

  // same optional-args formality as parseErc20Transfers above
  return logs.flatMap((log) => {
    const { owner, spender, value } = log.args
    if (owner === undefined || spender === undefined || value === undefined) return []
    return [
      {
        token: getAddress(log.address),
        owner: getAddress(owner),
        spender: getAddress(spender),
        value,
      },
    ]
  })
}
