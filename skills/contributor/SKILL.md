---
name: inference-provider-setup
description: >
  Set up an x402 payment-gated inference endpoint and register it on the
  Decentralized Inference Marketplace. Guides through Ollama setup, provider
  sidecar installation, x402 configuration, and marketplace registration.
requires:
  bins:
    - node
    - npm
    - curl
    # - tailscale  # recommended for internet exposure (Section 6)
  env:
    - GOATX402_API_URL
    - GOATX402_MERCHANT_ID
    - GOATX402_API_KEY
    - GOATX402_API_SECRET
---

# Become an Inference Provider

This skill walks you through setting up a payment-gated LLM inference endpoint
using the x402 provider sidecar and registering it on the Decentralized
Inference Marketplace.

## 0. Register Provider Identity (ERC-8004)

Before setting up the sidecar, register your on-chain identity to get x402
credentials and an optional verified badge.

1. **Prepare your info**:
   - Choose a project name (e.g. `alice-llama3-provider`)
   - Have your wallet address (`0x...`) ready
   - Write a short description of your provider

2. **DM `@goathackbot`** on the hackathon Discord/Telegram with:
   - Project name
   - Wallet address
   - Description

3. **Receive credentials** — the bot returns:
   - `agentId` — your ERC-8004 identity (NFT on chain 48816)
   - `GOATX402_API_KEY` — x402 API key
   - `GOATX402_API_SECRET` — x402 API secret
   - `GOATX402_MERCHANT_ID` — your merchant identifier
   - Test USDC, USDT, and gas tokens airdropped to your wallet

4. **Save your `agentId`** — you'll use it in Section 7 to get a "Verified"
   badge on the marketplace.

5. **Save x402 credentials** — these go into `provider-sidecar/.env` in
   Section 3.

6. **Verify on-chain**: Visit
   [goat-dashboard.vercel.app](https://goat-dashboard.vercel.app) and search
   for your agent ID to confirm your profile.

## 1. Prerequisites

Install and verify Ollama is running with a model available.

```bash
# Check Ollama is installed
ollama --version
```

```bash
# Pull a model (llama3 recommended)
ollama pull llama3
```

```bash
# Verify the OpenAI-compatible endpoint works
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "hi"}]
  }'
```

You should get a JSON response with a `choices` array. Note your:
- **Model name**: `llama3` (or whichever model you pulled)
- **Endpoint URL**: `http://localhost:11434`

> **Tip**: If Ollama isn't running, start it with `ollama serve`.

## 2. Install Provider Sidecar

```bash
cd provider-sidecar
npm install
```

This installs dependencies: `express`, `cors`, `dotenv`, and
`goatx402-sdk-server`.

Verify the TypeScript runner is available:

```bash
npx tsx --version
```

## 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials from Section 0:

```env
# GOAT x402 credentials (from @goathackbot)
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_MERCHANT_ID=<your_merchant_id>
GOATX402_API_KEY=<your_api_key>
GOATX402_API_SECRET=<your_api_secret>

# Local LLM endpoint
OLLAMA_ENDPOINT=http://localhost:11434

# Sidecar config
PROVIDER_PORT=4021
PRICE_AMOUNT=0.01
PRICE_SYMBOL=USDC

# Set to true to bypass payments during development
MOCK_PAYMENTS=false
```

| Variable | Description | Default |
|----------|-------------|---------|
| `GOATX402_API_URL` | x402 API gateway URL | (required) |
| `GOATX402_MERCHANT_ID` | Your merchant ID from `@goathackbot` | (required) |
| `GOATX402_API_KEY` | x402 API key | (required) |
| `GOATX402_API_SECRET` | x402 API secret | (required) |
| `OLLAMA_ENDPOINT` | Ollama server URL | `http://localhost:11434` |
| `PROVIDER_PORT` | Port the sidecar listens on | `4021` |
| `PRICE_AMOUNT` | Price per inference request | `0.01` |
| `PRICE_SYMBOL` | Payment token symbol | `USDC` |
| `MOCK_PAYMENTS` | Bypass x402 payments for testing | `false` |

## 4. Start the Sidecar

```bash
npx tsx server.ts
```

Expected output:

```
[sidecar] Provider sidecar running on http://localhost:4021
[sidecar] Mock payments: false
[sidecar] Ollama endpoint: http://localhost:11434
```

Verify health:

```bash
curl http://localhost:4021/health
```

Expected response:

```json
{
  "status": "ok",
  "provider": "ollama",
  "ollamaEndpoint": "http://localhost:11434",
  "ollamaStatus": "reachable",
  "mockPayments": false
}
```

> If `ollamaStatus` is `"unreachable"`, check that Ollama is running
> (`ollama serve`) and the `OLLAMA_ENDPOINT` in `.env` is correct.

## 5. Test Payment Gate

Send an inference request **without** a payment header:

```bash
curl -s -X POST http://localhost:4021/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Expected: **HTTP 402** with order details:

```json
{
  "error": "payment_required",
  "message": "x402 payment required for inference",
  "order": {
    "orderId": "ord_abc123",
    "amount": "0.01",
    "symbol": "USDC",
    "chainId": 48816,
    "merchantId": "<your_merchant_id>",
    "paymentUrl": "https://x402-api-lx58aabp0r.testnet3.goat.network/pay/ord_abc123"
  }
}
```

This confirms:
- The sidecar is proxying requests correctly
- The x402 payment gate is active
- Orders are being created on GOAT Testnet3

## 6. Expose Sidecar to the Internet

If the marketplace frontend is deployed to the internet (e.g. Vercel), it
cannot reach `localhost:4021` on your machine. You need to expose your sidecar
with a public HTTPS URL. **Tailscale Funnel** is the simplest option — zero
config, free, and gives you a stable HTTPS URL.

> **Skip this section** if you're running the marketplace locally
> (`localhost:3000`) and only testing on the same machine.

### Install Tailscale

```bash
# macOS
brew install tailscale

# Ubuntu / Debian
curl -fsSL https://tailscale.com/install.sh | sh
```

### Enable Funnel

1. Start Tailscale and log in:

```bash
tailscale up
```

2. Enable HTTPS and Funnel in the
   [Tailscale admin console](https://login.tailscale.com/admin/dns):
   - **DNS → HTTPS Certificates** — toggle on
   - **DNS → Funnel** — toggle on

### Expose Your Sidecar Port

```bash
tailscale funnel 4021
```

Example output:

```
https://alice-laptop.tail1234.ts.net/
|-- proxy http://127.0.0.1:4021
```

Your public URL is `https://alice-laptop.tail1234.ts.net` (yours will differ).

### Verify Reachability

```bash
curl https://<your-tailscale-url>/health
```

You should get the same health JSON as in Section 4. If it works, use this URL
as your `endpoint` when registering in Section 7.

### Alternatives

| Tool | Command | Notes |
|------|---------|-------|
| **ngrok** | `ngrok http 4021` | Free tier, random URL changes on restart |
| **cloudflared** | `cloudflared tunnel --url http://localhost:4021` | Cloudflare account required |

## 7. Register on Marketplace

Register your provider on the Decentralized Inference Marketplace. Include your
`agentId` from Section 0 to receive a "Verified" badge.

```bash
curl -X POST http://localhost:3000/api/providers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<your-provider-name>",
    "model": "llama3",
    "endpoint": "https://<your-tailscale-url>/v1/chat/completions",
    "pricing": {
      "amount": "0.01",
      "symbol": "USDC"
    },
    "walletAddress": "<your-0x-address>",
    "agentId": "<your-agent-id>"
  }'
```

Expected: **HTTP 201** with your provider object:

```json
{
  "id": "p_1234567890",
  "name": "<your-provider-name>",
  "model": "llama3",
  "endpoint": "https://<your-tailscale-url>/v1/chat/completions",
  "pricing": { "amount": "0.01", "symbol": "USDC" },
  "walletAddress": "0x...",
  "agentId": "<your-agent-id>",
  "status": "online",
  "registeredAt": "2026-02-28T..."
}
```

**Important notes**:
- Use your **Tailscale Funnel URL** (from Section 6) as the endpoint so the
  marketplace and its users can reach your sidecar over the internet.
- If running everything locally, you can use `http://localhost:4021/...` instead.
- Replace `localhost:3000` with your Vercel URL if the marketplace is deployed
  (e.g. `https://your-marketplace.vercel.app/api/providers`).
- The `agentId` field is optional but recommended — providers with a valid
  `agentId` display a "Verified" badge in the marketplace UI.
- Required fields: `name`, `model`, `endpoint`, `pricing`, `walletAddress`.

## 8. Verify Registration

Check that your provider appears in the marketplace:

```bash
curl http://localhost:3000/api/providers
```

Your provider should appear in the returned array. You can also filter by model:

```bash
curl "http://localhost:3000/api/providers?model=llama3"
```

Open [http://localhost:3000](http://localhost:3000) in your browser — your
provider should appear in the provider grid with its model, pricing, and status.

## 9. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ollamaStatus: "unreachable"` in health check | Ollama not running | Run `ollama serve` and verify with `curl http://localhost:11434` |
| 402 not returned (request goes straight through) | `MOCK_PAYMENTS=true` in `.env` | Set `MOCK_PAYMENTS=false` and restart the sidecar |
| `order_creation_failed` error | Invalid x402 credentials | Double-check `GOATX402_API_KEY`, `GOATX402_API_SECRET`, and `GOATX402_MERCHANT_ID` in `.env` |
| Registration returns 400 | Missing required fields | Ensure `name`, `model`, `endpoint`, `pricing`, and `walletAddress` are all provided |
| Registration returns `Invalid endpoint URL` | Malformed endpoint URL | Use a full URL including protocol (e.g. `https://alice-laptop.tail1234.ts.net/v1/chat/completions`) |
| Provider shows but status is `"offline"` | Sidecar not reachable from marketplace | Ensure Tailscale Funnel is running (Section 6) and the endpoint URL is your public Funnel URL |
| Streaming produces garbled output | Ollama version too old | Upgrade to Ollama 0.1.29+ which supports `/v1/chat/completions` |
| `upstream_unreachable` on inference | Ollama crashed or wrong endpoint | Restart Ollama, verify `OLLAMA_ENDPOINT` in `.env` |
| `npm install` fails in sidecar | Node.js version too old | Use Node.js 18+ (`node --version`) |
| Funnel URL returns connection refused | Tailscale Funnel not running | Run `tailscale funnel 4021` and keep the terminal open |
| Funnel URL returns 502 | Sidecar not running behind Funnel | Start the sidecar (`npx tsx server.ts`) then retry |
| `tailscale funnel` says "not available" | Funnel not enabled in admin console | Enable HTTPS certificates and Funnel in [Tailscale admin DNS settings](https://login.tailscale.com/admin/dns) |
| Model detection fails during registration | Funnel URL not reachable from marketplace | Verify with `curl https://<your-tailscale-url>/health` from another device |
