# PAY-01: x402 Payment Integration (Provider Sidecar)

**Module**: Provider-side payment gateway
**Time estimate**: 30 min
**Priority**: Must-Have
**Dependencies**: None (standalone with mock mode)

---

## Scope

A standalone Express server that wraps any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM) with GOAT x402 payment gating. This runs on the **provider's machine**, not the marketplace. The provider registers their own ERC-8004 identity via `@goathackbot` (see ID-01) and uses the resulting x402 merchant credentials here. It acts as a sidecar proxy:

```
Client → Provider Sidecar (x402 gate) → Ollama/LLM endpoint
```

When a client sends an inference request:
1. No payment → return 402 with order details
2. Valid payment → proxy request to LLM → stream response back

## Directory Structure

```
provider-sidecar/
  server.ts               # Main Express server
  x402-client.ts          # GoatX402 SDK wrapper
  proxy.ts                # Ollama proxy with streaming
  package.json
  tsconfig.json
  .env.example
```

## Dependencies

```json
{
  "dependencies": {
    "express": "^4.21",
    "cors": "^2.8",
    "dotenv": "^16",
    "goatx402-sdk-server": "latest"
  },
  "devDependencies": {
    "typescript": "^5",
    "tsx": "^4",
    "@types/express": "^5",
    "@types/cors": "^2"
  }
}
```

**Risk**: `goatx402-sdk-server` may not be published on npm. Fallback options:
1. Install from GitHub: `npm install GOATNetwork/x402#main`
2. Copy the SDK source into `provider-sidecar/vendor/`
3. Implement x402 flow manually using the API directly (REST calls to `GOATX402_API_URL`)

## Environment Variables

```env
# .env.example

# GOAT x402 credentials — the provider's own creds from @goathackbot (see ID-01)
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_MERCHANT_ID=your_project
GOATX402_API_KEY=your_api_key
GOATX402_API_SECRET=your_api_secret

# Local LLM endpoint
OLLAMA_ENDPOINT=http://localhost:11434

# Sidecar config
PROVIDER_PORT=4021
PRICE_AMOUNT=0.01
PRICE_SYMBOL=USDC

# Development
MOCK_PAYMENTS=false
```

## Endpoints

### `POST /v1/chat/completions`

The main payment-gated inference endpoint. Mimics the OpenAI API format.

**Flow**:

```
Client sends POST /v1/chat/completions
  ├── Has X-GOAT-ORDER-ID header?
  │   ├── NO → Create x402 order → Return 402 with order details
  │   └── YES → Verify order status
  │       ├── Order PAID → Proxy to Ollama → Stream response
  │       └── Order NOT PAID → Return 402 "payment pending"
```

**402 Response** (no payment):
```json
{
  "error": "payment_required",
  "message": "x402 payment required for inference",
  "order": {
    "orderId": "ord_abc123",
    "amount": "0.01",
    "symbol": "USDC",
    "chainId": 48816,
    "merchantId": "your_project",
    "paymentUrl": "https://x402-api.../pay/ord_abc123"
  }
}
```

**200 Response** (paid): Streamed SSE from Ollama, proxied through.

### `GET /api/orders/:orderId/status`

Poll order payment status.

**Response**:
```json
{
  "orderId": "ord_abc123",
  "status": "paid" | "pending" | "expired",
  "paidAt": "2026-02-28T...",
  "txHash": "0x..."
}
```

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "provider": "ollama",
  "ollamaEndpoint": "http://localhost:11434",
  "ollamaStatus": "reachable" | "unreachable",
  "mockPayments": false
}
```

## x402 SDK Integration

**File**: `x402-client.ts`

```typescript
import { GoatX402 } from 'goatx402-sdk-server'

const x402 = new GoatX402({
  apiUrl: process.env.GOATX402_API_URL,
  apiKey: process.env.GOATX402_API_KEY,
  apiSecret: process.env.GOATX402_API_SECRET,
  merchantId: process.env.GOATX402_MERCHANT_ID,
})

// Create a new payment order
async function createOrder(amount: string, symbol: string): Promise<Order>

// Check if an order has been paid
async function verifyOrder(orderId: string): Promise<OrderStatus>
```

If the SDK is unavailable, implement these as direct REST calls:
- `POST ${GOATX402_API_URL}/orders` — create order
- `GET ${GOATX402_API_URL}/orders/${orderId}` — check status

## Ollama Proxy

**File**: `proxy.ts`

Proxies the chat completions request to the local Ollama instance:

```typescript
async function proxyToOllama(
  body: ChatCompletionRequest,
  res: express.Response
): Promise<void> {
  const ollamaUrl = `${process.env.OLLAMA_ENDPOINT}/v1/chat/completions`
  const upstream = await fetch(ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  })
  // Pipe SSE stream from Ollama to client
  upstream.body.pipeTo(/* res writable stream */)
}
```

## Mock Mode

When `MOCK_PAYMENTS=true`:
- Skip x402 order creation and verification
- Proxy all requests directly to Ollama
- Log "MOCK MODE: bypassing payment" to console
- Useful for development and as a demo fallback

## Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Init `provider-sidecar/` project: `package.json`, `tsconfig.json`, `.env.example` | 3 min |
| 2 | Create `x402-client.ts` — GoatX402 SDK wrapper (or REST fallback) | 8 min |
| 3 | Create `proxy.ts` — Ollama proxy with SSE streaming | 5 min |
| 4 | Create `server.ts` — Express server with payment-gated `/v1/chat/completions` | 8 min |
| 5 | Add `GET /api/orders/:orderId/status` endpoint | 3 min |
| 6 | Add `GET /health` endpoint with Ollama reachability check | 2 min |
| 7 | Add mock payment mode (`MOCK_PAYMENTS=true`) | 3 min |
| 8 | Test: `curl` to sidecar → expect 402 → verify order flow | 3 min |

**Total: ~35 min** (includes buffer)

## Stub Strategy

This module works **fully standalone**:
- Requires only a running Ollama instance (or any OpenAI-compatible endpoint)
- `MOCK_PAYMENTS=true` bypasses all x402 logic for development
- Does NOT depend on the marketplace — can be tested with raw `curl`
- x402 credentials are only needed for real payment testing

## Interface Contract

**Exposes**:
- `POST /v1/chat/completions` — payment-gated inference (consumed by marketplace InferencePanel, SKILL-02 client)
- `GET /api/orders/:orderId/status` — order polling (consumed by marketplace, SKILL-02 client)
- `GET /health` — health check

**Consumes**:
- Local Ollama/LLM endpoint (`OLLAMA_ENDPOINT`)
- GOAT x402 API (`GOATX402_API_URL` + provider's own merchant credentials from ID-01)

## Integration Points

When connecting with other modules:

1. **+ MKT-01**: Provider registers their sidecar URL (`http://<ip>:4021/v1/chat/completions`) via `POST /api/providers` on the marketplace. The marketplace's `InferencePanel` then calls this sidecar directly.

2. **+ SKILL-01**: The contributor skill teaches agents how to install, configure, and run this sidecar.

3. **+ SKILL-02**: The client skill teaches agents how to handle the 402 → pay → retry flow when calling this sidecar.

## Shared Constants

```
SIDECAR_PORT=4021
SIDECAR_INFERENCE_PATH=/v1/chat/completions
SIDECAR_ORDER_STATUS_PATH=/api/orders/:orderId/status
GOAT_CHAIN_ID=48816
PAYMENT_SYMBOL=USDC
```
