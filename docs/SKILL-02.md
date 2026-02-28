# SKILL-02: Client OpenClaw Skill

**Module**: Agent skill for clients/consumers
**Time estimate**: 30 min
**Priority**: Must-Have
**Dependencies**: MKT-01 (marketplace API), PAY-01 (402 response format)

---

## Scope

A markdown skill file (`skills/client/SKILL.md`) that teaches any OpenClaw agent how to:
1. Discover available inference providers on the marketplace
2. Select a provider based on model and pricing
3. Send an inference request and handle the x402 payment flow
4. Get streamed inference results
5. Verify payment on-chain

The skill includes a complete Node.js automation script that an agent can use to perform the full flow programmatically.

## Output File

```
skills/client/SKILL.md
```

## Skill Frontmatter

```yaml
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
```

## Skill Content Outline

### Section 1: Discover Providers

- List all providers:
  ```bash
  curl http://localhost:3000/api/providers
  ```
- Filter by model:
  ```bash
  curl "http://localhost:3000/api/providers?model=llama3"
  ```
- Response format: array of `Provider` objects with `endpoint`, `pricing`, `model`
- Selection criteria: model match, lowest price, online status

### Section 2: Select a Provider

- Parse the provider list
- Choose based on:
  1. Desired model name (e.g., `llama3`)
  2. Pricing comparison
  3. Status = `"online"`
- Extract: `endpoint`, `pricing.amount`, `pricing.symbol`

### Section 3: Send Inference Request

- Send request to provider's endpoint:
  ```bash
  curl -X POST <provider-endpoint> \
    -H "Content-Type: application/json" \
    -d '{
      "model": "llama3",
      "messages": [{"role": "user", "content": "Explain x402 in one sentence"}],
      "stream": true
    }'
  ```
- Expected response: **HTTP 402** with payment order details:
  ```json
  {
    "error": "payment_required",
    "order": {
      "orderId": "ord_abc123",
      "amount": "0.01",
      "symbol": "USDC",
      "chainId": 48816,
      "paymentUrl": "https://x402-api.../pay/ord_abc123"
    }
  }
  ```

### Section 4: Complete x402 Payment

- Use `goatx402-sdk` client library or manual on-chain payment:
  ```typescript
  // Option A: SDK
  import { GoatX402Client } from 'goatx402-sdk'
  const client = new GoatX402Client({ privateKey: process.env.EVM_PRIVATE_KEY })
  const receipt = await client.payOrder(order.orderId)
  ```
  ```typescript
  // Option B: Direct with ethers/viem
  // 1. Approve USDC spend to x402 contract
  // 2. Call pay() on x402 contract with orderId
  ```
- Wait for payment confirmation
- Poll order status:
  ```bash
  curl http://<provider-endpoint-host>:4021/api/orders/ord_abc123/status
  ```
- Expected: `{"status": "paid", "txHash": "0x..."}`

### Section 5: Retry with Payment Proof

- Re-send inference request with order ID:
  ```bash
  curl -X POST <provider-endpoint> \
    -H "Content-Type: application/json" \
    -H "X-GOAT-ORDER-ID: ord_abc123" \
    -d '{
      "model": "llama3",
      "messages": [{"role": "user", "content": "Explain x402 in one sentence"}],
      "stream": true
    }'
  ```
- Expected: **HTTP 200** with SSE streamed tokens
- Read the streamed response until `[DONE]`

### Section 6: Verify On-Chain

- View transaction on GOAT Testnet3 explorer:
  ```
  https://explorer.testnet3.goat.network/tx/<txHash>
  ```
- Confirm: correct amount, correct token (USDC), correct chain (48816)

### Section 7: Complete Automation Script

A standalone Node.js script (`skills/client/infer.ts`) that automates the full flow:

```typescript
#!/usr/bin/env npx tsx
/**
 * Automated inference client
 * Usage: MARKETPLACE_URL=http://localhost:3000 EVM_PRIVATE_KEY=0x... npx tsx infer.ts "your prompt"
 */

// 1. Discover providers
// 2. Select best match
// 3. Send request → get 402
// 4. Pay via x402
// 5. Retry with order ID → get inference
// 6. Print result
```

This script should be included alongside the skill for agents that want a turnkey solution.

### Section 8: Troubleshooting

Common issues:
- **No providers found**: Check marketplace is running, providers are registered
- **402 but payment fails**: Check `EVM_PRIVATE_KEY` has test USDC (from `@goathackbot`)
- **Payment succeeds but inference fails**: Check provider sidecar is running, Ollama is up
- **Streaming not working**: Ensure `stream: true` in request body
- **Insufficient funds**: DM `@goathackbot` for more test tokens

## Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Create `skills/client/` directory | 1 min |
| 2 | Write frontmatter (name, description, requires) | 3 min |
| 3 | Write Sections 1-2: Discover + Select | 5 min |
| 4 | Write Sections 3-4: Request + Pay | 8 min |
| 5 | Write Section 5: Retry with payment | 5 min |
| 6 | Write Section 6: Verify on-chain | 3 min |
| 7 | Write Section 7: Complete automation script (`infer.ts`) | 8 min |
| 8 | Write Section 8: Troubleshooting | 3 min |
| 9 | Test: walk through the skill flow manually | 5 min |

**Total: ~41 min** (includes buffer; could be less if PAY-01 is done first)

## Stub Strategy

The skill can be **written before PAY-01 is complete**:
- Document the expected 402 response format
- Use placeholder payment commands
- The automation script can have a `--dry-run` flag that skips payment
- Update with real SDK calls once `goatx402-sdk` usage is confirmed

## Interface Contract

**Exposes**:
- `skills/client/SKILL.md` — installable OpenClaw skill
- `skills/client/infer.ts` — automation script (optional)

**Consumes**:
- MKT-01: `GET /api/providers` endpoint
- PAY-01: Provider sidecar's 402 response format, `X-GOAT-ORDER-ID` header, order status endpoint
- ID-01: `EVM_PRIVATE_KEY` wallet with test tokens

## Integration Points

1. **+ MKT-01**: Skill calls `GET /api/providers` to discover providers
2. **+ PAY-01**: Skill handles 402 responses from provider sidecar, sends payment, retries with order ID
3. **+ ID-01**: Client wallet needs test USDC from `@goathackbot` to make payments
4. **+ DEMO-01**: The client skill flow is demonstrated in Acts 2-3 of the demo

## Shared Constants

```
MARKETPLACE_URL=http://localhost:3000
MARKETPLACE_API=GET /api/providers
SIDECAR_ORDER_STATUS_PATH=/api/orders/:orderId/status
X402_HEADER=X-GOAT-ORDER-ID
GOAT_CHAIN_ID=48816
GOAT_EXPLORER=https://explorer.testnet3.goat.network
```
