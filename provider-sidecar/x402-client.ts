import crypto from 'node:crypto'
import { GoatX402Client } from 'goatx402-sdk-server'
import type { Order, OrderProof } from 'goatx402-sdk-server'
import { createLogger } from './logger.js'

const log = createLogger('x402')

// Re-export SDK types for server.ts
export type { Order, OrderProof }

// ---------------------------------------------------------------------------
// Token decimals lookup
// ---------------------------------------------------------------------------

const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
}

function toWei(amount: string, symbol: string): string {
  const decimals = TOKEN_DECIMALS[symbol.toUpperCase()] ?? 18
  const [whole = '0', frac = ''] = amount.split('.')
  const padded = frac.padEnd(decimals, '0').slice(0, decimals)
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(padded)).toString()
}

// ---------------------------------------------------------------------------
// SDK client singleton
// ---------------------------------------------------------------------------

let _client: GoatX402Client | undefined

function getClient(): GoatX402Client {
  if (!_client) {
    _client = new GoatX402Client({
      baseUrl: process.env.GOATX402_API_URL ?? '',
      apiKey: process.env.GOATX402_API_KEY ?? '',
      apiSecret: process.env.GOATX402_API_SECRET ?? '',
    })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isMockMode(): boolean {
  return process.env.MOCK_PAYMENTS === 'true'
}

export async function createOrder(amount: string, symbol: string, fromAddress: string): Promise<Order> {
  const chainId = parseInt(process.env.CHAIN_ID ?? '48816', 10)

  log.info('Creating x402 order', { amount, symbol, fromAddress })

  const client = getClient()
  const order = await client.createOrder({
    dappOrderId: crypto.randomUUID(),
    chainId,
    tokenSymbol: symbol,
    fromAddress,
    amountWei: toWei(amount, symbol),
  })

  log.info('x402 order created', { orderId: order.orderId, flow: order.flow, payToAddress: order.payToAddress })
  return order
}

export async function verifyOrder(orderId: string): Promise<OrderProof> {
  log.debug('Verifying x402 order', { orderId })

  const client = getClient()
  const proof = await client.getOrderStatus(orderId)

  log.debug('x402 order status', { orderId: proof.orderId, status: proof.status })
  return proof
}
