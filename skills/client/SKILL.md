---
name: inference-client
description: >
  Discover inference providers on the Decentralized Inference Marketplace,
  pay via x402 on GOAT Testnet3, and receive streamed LLM inference results.
  Automates the full discover → pay → infer flow.
requires:
  bins:
    - node
    - curl
  env:
    - EVM_PRIVATE_KEY
---

# Use the Inference Marketplace as a Client

This skill walks you through discovering providers, paying for inference via
x402, and receiving streamed LLM results from the Decentralized Inference
Marketplace.

## 1. Discover Providers

List all registered providers:

```bash
curl http://localhost:3000/api/providers
```

Filter by model name:

```bash
curl "http://localhost:3000/api/providers?model=llama3"
```

Response: an array of `Provider` objects:

```json
[
  {
    "id": "p_1234567890",
    "name": "alice-llama3",
    "model": "llama3",
    "endpoint": "http://192.168.1.10:4021/v1/chat/completions",
    "pricing": { "amount": "0.01", "symbol": "USDC" },
    "walletAddress": "0xAlice...",
    "agentId": "agent_abc",
    "status": "online",
    "registeredAt": "2026-02-28T12:00:00.000Z"
  }
]
```

Key fields per provider:
- `endpoint` — the URL to send inference requests to
- `pricing.amount` / `pricing.symbol` — cost per request
- `model` — the LLM model served
- `status` — `"online"` or `"offline"`
- `agentId` — present if the provider has a verified ERC-8004 identity

## 2. Select a Provider

Choose a provider based on:

1. **Model match** — filter for the model you need (e.g. `llama3`)
2. **Status** — only use providers with `status: "online"`
3. **Price** — compare `pricing.amount` across providers
4. **Verified** — prefer providers with an `agentId` (verified badge)

From your chosen provider, extract:
- `endpoint` — where to send the inference request
- `pricing.amount` — how much you'll pay
- `pricing.symbol` — which token (e.g. `USDC`)

## 3. Send Inference Request

Send an OpenAI-compatible chat completion request to the provider's endpoint:

```bash
curl -s -X POST http://192.168.1.10:4021/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Explain x402 in one sentence"}],
    "stream": true
  }'
```

Expected response: **HTTP 402** with payment order details:

```json
{
  "error": "payment_required",
  "message": "x402 payment required for inference",
  "order": {
    "orderId": "ord_abc123",
    "amount": "0.01",
    "symbol": "USDC",
    "chainId": 48816,
    "merchantId": "alice-provider",
    "paymentUrl": "https://x402-api-lx58aabp0r.testnet3.goat.network/pay/ord_abc123"
  }
}
```

Save the entire `order` object — you'll need `orderId` and `paymentUrl`.

## 4. Complete x402 Payment

Pay for the inference using the order details from the 402 response.

### Option A: Using the automation script

The easiest approach — use the bundled `infer.ts` script (see Section 7) which
handles payment automatically.

### Option B: Using goatx402-sdk

```typescript
import { GoatX402Client } from 'goatx402-sdk'

const client = new GoatX402Client({
  privateKey: process.env.EVM_PRIVATE_KEY,
})

const receipt = await client.payOrder(order.orderId)
console.log('Payment tx:', receipt.txHash)
```

### Option C: Manual payment via paymentUrl

Open the `paymentUrl` from the order in a browser or use a wallet to pay
directly. The payment page handles the on-chain transaction for you.

### Poll for payment confirmation

After paying, poll the order status endpoint on the provider's sidecar:

```bash
curl http://192.168.1.10:4021/api/orders/ord_abc123/status
```

Pending response:

```json
{
  "orderId": "ord_abc123",
  "status": "pending"
}
```

Paid response:

```json
{
  "orderId": "ord_abc123",
  "status": "paid",
  "paidAt": "2026-02-28T12:05:00.000Z",
  "txHash": "0xabc123..."
}
```

Wait until `status` is `"paid"` before proceeding.

## 5. Retry with Payment Proof

Re-send the inference request with the `X-GOAT-ORDER-ID` header:

```bash
curl -N -X POST http://192.168.1.10:4021/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-GOAT-ORDER-ID: ord_abc123" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Explain x402 in one sentence"}],
    "stream": true
  }'
```

Expected: **HTTP 200** with `Content-Type: text/event-stream`.

The response streams SSE chunks:

```
data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":"x402"},"index":0}]}

data: {"id":"chatcmpl-123","object":"chat.completion.chunk","choices":[{"delta":{"content":" is"},"index":0}]}

...

data: [DONE]
```

Read the stream until you receive `data: [DONE]`.

> **Note**: If you get another 402 with `"error": "payment_pending"`, the
> payment hasn't been confirmed yet. Wait and retry.

## 6. Verify On-Chain

After receiving inference, verify your payment on the GOAT Testnet3 explorer:

```
https://explorer.testnet3.goat.network/tx/<txHash>
```

Replace `<txHash>` with the `txHash` from the order status response (Section 4).

Confirm:
- **Amount**: matches `pricing.amount` (e.g. 0.01)
- **Token**: matches `pricing.symbol` (e.g. USDC)
- **Chain**: GOAT Testnet3 (chain ID 48816)

## 7. Automation Script

A complete automation script is provided at `skills/client/infer.ts`. It
performs the full discover → select → pay → infer flow in a single command.

### Usage

```bash
# Set environment variables
export MARKETPLACE_URL=http://localhost:3000
export EVM_PRIVATE_KEY=0x<your-private-key>

# Run with a prompt
npx tsx skills/client/infer.ts "Explain x402 in one sentence"

# Filter by model
npx tsx skills/client/infer.ts --model llama3 "Explain x402"

# Dry run (skips payment, shows what would happen)
npx tsx skills/client/infer.ts --dry-run "Explain x402"
```

### What it does

1. Fetches providers from the marketplace API
2. Selects the best provider (by model match, online status, lowest price)
3. Sends inference request → receives 402 with order details
4. Pays via x402 SDK (or logs the payment URL in `--dry-run` mode)
5. Polls order status until `"paid"`
6. Retries with `X-GOAT-ORDER-ID` header → streams inference result
7. Prints the streamed response to stdout

## 8. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| No providers returned | Marketplace not running or empty | Start marketplace (`npm run dev`) and register a provider (see contributor skill) |
| All providers `"offline"` | Sidecar not reachable | Ask the provider to check their sidecar is running |
| 402 but payment fails | Wallet has no test USDC | DM `@goathackbot` for test tokens |
| `payment_pending` after paying | Transaction not yet confirmed | Wait 5-10 seconds and poll `/api/orders/:orderId/status` again |
| `order_verification_failed` | Invalid order ID | Ensure the `X-GOAT-ORDER-ID` value matches the `orderId` from the 402 response exactly |
| Inference returns `upstream_unreachable` | Provider's Ollama is down | Try a different provider |
| Stream ends without `[DONE]` | Network interruption | Retry the request with the same `X-GOAT-ORDER-ID` (paid orders can be reused) |
| `Insufficient funds` on payment | Not enough USDC in wallet | DM `@goathackbot` for more test tokens |
| Script fails with `MODULE_NOT_FOUND` | Missing dependencies | Run `npm install` in the project root |
