#!/usr/bin/env npx tsx
/**
 * Automated inference client for the Decentralized Inference Marketplace.
 *
 * Usage:
 *   MARKETPLACE_URL=http://localhost:3000 EVM_PRIVATE_KEY=0x... npx tsx infer.ts "your prompt"
 *
 * Flags:
 *   --model <name>   Filter providers by model (default: any)
 *   --dry-run        Skip payment step; print order details and exit
 */

// ---------------------------------------------------------------------------
// Types (mirrors src/lib/types.ts and provider-sidecar/x402-client.ts)
// ---------------------------------------------------------------------------

interface Pricing {
  amount: string
  symbol: string
}

interface Provider {
  id: string
  name: string
  model: string
  endpoint: string
  pricing: Pricing
  walletAddress: string
  agentId?: string
  status: 'online' | 'offline'
  registeredAt: string
}

interface Order {
  orderId: string
  amount: string
  symbol: string
  chainId: number
  merchantId: string
  paymentUrl: string
}

interface OrderStatus {
  orderId: string
  status: 'paid' | 'pending' | 'expired'
  paidAt?: string
  txHash?: string
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
let modelFilter: string | undefined
let dryRun = false
const positional: string[] = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' && args[i + 1]) {
    modelFilter = args[++i]
  } else if (args[i] === '--dry-run') {
    dryRun = true
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i])
  }
}

const prompt = positional.join(' ')
if (!prompt) {
  console.error('Usage: npx tsx infer.ts [--model <name>] [--dry-run] "your prompt"')
  process.exit(1)
}

const MARKETPLACE_URL = process.env.MARKETPLACE_URL ?? 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Step 1: Discover providers
// ---------------------------------------------------------------------------

console.log(`\n[1/6] Discovering providers on ${MARKETPLACE_URL} ...`)

const providerUrl = modelFilter
  ? `${MARKETPLACE_URL}/api/providers?model=${encodeURIComponent(modelFilter)}`
  : `${MARKETPLACE_URL}/api/providers`

const providersRes = await fetch(providerUrl)
if (!providersRes.ok) {
  console.error(`Failed to fetch providers: ${providersRes.status} ${await providersRes.text()}`)
  process.exit(1)
}

const providers: Provider[] = await providersRes.json() as Provider[]
console.log(`  Found ${providers.length} provider(s)`)

if (providers.length === 0) {
  console.error('No providers available. Register one first (see contributor skill).')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Step 2: Select best provider
// ---------------------------------------------------------------------------

console.log('[2/6] Selecting best provider ...')

const online = providers.filter((p) => p.status === 'online')
if (online.length === 0) {
  console.error('No online providers found. All providers are offline.')
  process.exit(1)
}

// Sort by price ascending, prefer verified (has agentId)
const sorted = online.sort((a, b) => {
  const priceDiff = parseFloat(a.pricing.amount) - parseFloat(b.pricing.amount)
  if (priceDiff !== 0) return priceDiff
  // Prefer verified providers
  if (a.agentId && !b.agentId) return -1
  if (!a.agentId && b.agentId) return 1
  return 0
})

const provider = sorted[0]
console.log(`  Selected: ${provider.name} (${provider.model}) @ ${provider.pricing.amount} ${provider.pricing.symbol}`)
console.log(`  Endpoint: ${provider.endpoint}`)
if (provider.agentId) {
  console.log(`  Verified: yes (agentId: ${provider.agentId})`)
}

// ---------------------------------------------------------------------------
// Step 3: Send inference request → get 402
// ---------------------------------------------------------------------------

console.log('[3/6] Sending inference request ...')

const inferBody = {
  model: provider.model,
  messages: [{ role: 'user', content: prompt }],
  stream: true,
}

const firstRes = await fetch(provider.endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(inferBody),
})

if (firstRes.status === 200) {
  // Provider is in mock mode or payment not required — stream directly
  console.log('  Provider returned 200 (no payment required). Streaming response ...\n')
  await streamResponse(firstRes)
  process.exit(0)
}

if (firstRes.status !== 402) {
  console.error(`Unexpected status ${firstRes.status}: ${await firstRes.text()}`)
  process.exit(1)
}

const paymentResponse = (await firstRes.json()) as { error: string; order: Order }
const order = paymentResponse.order
console.log(`  Got 402 — payment required`)
console.log(`  Order ID:    ${order.orderId}`)
console.log(`  Amount:      ${order.amount} ${order.symbol}`)
console.log(`  Chain ID:    ${order.chainId}`)
console.log(`  Payment URL: ${order.paymentUrl}`)

// ---------------------------------------------------------------------------
// Step 4: Pay via x402
// ---------------------------------------------------------------------------

if (dryRun) {
  console.log('\n[dry-run] Skipping payment. To pay manually, open the payment URL above.')
  console.log('[dry-run] After paying, retry with:')
  console.log(`  curl -N -X POST ${provider.endpoint} \\`)
  console.log(`    -H "Content-Type: application/json" \\`)
  console.log(`    -H "X-GOAT-ORDER-ID: ${order.orderId}" \\`)
  console.log(`    -d '${JSON.stringify(inferBody)}'`)
  process.exit(0)
}

console.log('[4/6] Completing x402 payment ...')

const privateKey = process.env.EVM_PRIVATE_KEY
if (!privateKey) {
  console.error('EVM_PRIVATE_KEY not set. Set it or use --dry-run.')
  process.exit(1)
}

// Try SDK payment
let paymentSuccess = false
try {
  const sdk = await import('goatx402-sdk')
  const GoatX402Client = (sdk as any).GoatX402Client ?? (sdk as any).default
  if (GoatX402Client) {
    const client = new GoatX402Client({ privateKey })
    const receipt = await client.payOrder(order.orderId)
    console.log(`  Payment submitted: tx ${receipt.txHash ?? receipt.hash ?? 'pending'}`)
    paymentSuccess = true
  }
} catch {
  // SDK not available — fall back to payment URL guidance
}

if (!paymentSuccess) {
  console.log('  goatx402-sdk not available. Pay manually using the payment URL:')
  console.log(`  ${order.paymentUrl}`)
  console.log('  Waiting for payment confirmation ...')
}

// ---------------------------------------------------------------------------
// Step 5: Poll order status
// ---------------------------------------------------------------------------

console.log('[5/6] Waiting for payment confirmation ...')

// Derive the sidecar base URL from the provider endpoint
const endpointUrl = new URL(provider.endpoint)
const sidecarBase = `${endpointUrl.protocol}//${endpointUrl.host}`

const maxAttempts = 60
const pollInterval = 3000

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const statusRes = await fetch(`${sidecarBase}/api/orders/${order.orderId}/status`)
  if (statusRes.ok) {
    const status = (await statusRes.json()) as OrderStatus
    if (status.status === 'paid') {
      console.log(`  Payment confirmed! tx: ${status.txHash ?? 'n/a'}`)
      if (status.txHash) {
        console.log(`  Explorer: https://explorer.testnet3.goat.network/tx/${status.txHash}`)
      }
      break
    }
    if (status.status === 'expired') {
      console.error('  Order expired. Please try again.')
      process.exit(1)
    }
  }
  if (attempt === maxAttempts) {
    console.error(`  Payment not confirmed after ${maxAttempts} attempts. Giving up.`)
    process.exit(1)
  }
  process.stdout.write(`  Polling ... (${attempt}/${maxAttempts})\r`)
  await sleep(pollInterval)
}

// ---------------------------------------------------------------------------
// Step 6: Retry with payment proof → stream response
// ---------------------------------------------------------------------------

console.log('[6/6] Sending paid inference request ...\n')

const paidRes = await fetch(provider.endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-GOAT-ORDER-ID': order.orderId,
  },
  body: JSON.stringify(inferBody),
})

if (!paidRes.ok) {
  const errText = await paidRes.text()
  console.error(`Inference failed (${paidRes.status}): ${errText}`)
  process.exit(1)
}

await streamResponse(paidRes)
console.log('\n\nDone.')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function streamResponse(res: Response): Promise<void> {
  if (!res.body) {
    console.error('No response body')
    return
  }

  const reader = (res.body as any).getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            process.stdout.write(content)
          }
        } catch {
          // Non-JSON SSE line, skip
        }
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
