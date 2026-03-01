# SKILL-01: Contributor OpenClaw Skill

**Module**: Agent skill for providers
**Time estimate**: 30 min
**Priority**: Must-Have
**Dependencies**: PAY-01 (sidecar code), MKT-01 (marketplace API)

---

## Scope

A markdown skill file (`skills/contributor/SKILL.md`) that teaches any OpenClaw agent how to:
1. Set up the x402 provider sidecar to wrap their LLM endpoint
2. Configure pricing and credentials
3. Register their endpoint on the marketplace
4. Verify everything works

The skill is a **standalone markdown document** with frontmatter — it's the "instructions" that turn any agent into a provider onboarding assistant.

## Output File

```
skills/contributor/SKILL.md
```

## Skill Frontmatter

```yaml
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
  env:
    - GOATX402_API_URL
    - GOATX402_MERCHANT_ID
    - GOATX402_API_KEY
    - GOATX402_API_SECRET
---
```

## Skill Content Outline

The skill body teaches the following steps in order:

### Section 0: Register Provider Identity (ERC-8004)

Before setting up the sidecar, the provider registers their on-chain identity:

1. **Prepare info**: Choose a project name (e.g., `alice-llama3-provider`), have your wallet address (`0x...`), and write a short description
2. **DM `@goathackbot`**: Send your project name, wallet address, and description on the hackathon Discord/Telegram
3. **Receive credentials**: The bot returns:
   - `agentId` — your ERC-8004 identity (NFT on chain 48816)
   - x402 merchant credentials (`GOATX402_API_KEY`, `GOATX402_API_SECRET`, `GOATX402_MERCHANT_ID`)
   - Test USDC, USDT, and gas tokens in your wallet
4. **Save `agentId`**: You'll include this when registering on the marketplace (Section 6)
5. **Save x402 creds**: These go into `provider-sidecar/.env` (Section 3)
6. **Verify on-chain**: Visit [goat-dashboard.vercel.app](https://goat-dashboard.vercel.app) and search for your agent ID to confirm your profile

### Section 1: Prerequisites

- Verify Ollama is installed and running: `ollama --version`
- Pull a model: `ollama pull llama3`
- Verify endpoint: `curl http://localhost:11434/v1/chat/completions -d '{"model":"llama3","messages":[{"role":"user","content":"hi"}]}'`
- Confirm: model name, endpoint URL, working response

### Section 2: Install Provider Sidecar

- Navigate to `provider-sidecar/` directory
- Run `npm install`
- Verify installation: `npx tsx --version`

### Section 3: Configure Environment

- Copy `.env.example` to `.env`
- Set GOAT x402 credentials (from `@goathackbot`):
  ```env
  GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
  GOATX402_MERCHANT_ID=<your_merchant_id>
  GOATX402_API_KEY=<your_api_key>
  GOATX402_API_SECRET=<your_api_secret>
  ```
- Set Ollama endpoint: `OLLAMA_ENDPOINT=http://localhost:11434`
- Set pricing: `PRICE_AMOUNT=0.01` and `PRICE_SYMBOL=USDC`
- Set port: `PROVIDER_PORT=4021`

### Section 4: Start the Sidecar

- Run: `npx tsx server.ts`
- Expected output: `Provider sidecar running on port 4021`
- Verify health: `curl http://localhost:4021/health`
- Expected: `{"status":"ok","ollamaStatus":"reachable"}`

### Section 5: Test Payment Gate

- Send inference request without payment:
  ```bash
  curl -X POST http://localhost:4021/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"llama3","messages":[{"role":"user","content":"Hello"}]}'
  ```
- Expected: HTTP 402 with order details (orderId, amount, symbol)
- This confirms the payment gate is working

### Section 6: Register on Marketplace

- Register provider (include `agentId` from Section 0 for a "Verified" badge):
  ```bash
  curl -X POST http://localhost:3000/api/providers \
    -H "Content-Type: application/json" \
    -d '{
      "name": "<your-provider-name>",
      "model": "llama3",
      "endpoint": "http://<your-ip>:4021/v1/chat/completions",
      "pricing": {"amount": "0.01", "symbol": "USDC"},
      "walletAddress": "<your-0x-address>",
      "agentId": "<your-agent-id>"
    }'
  ```
- Expected: 201 with provider object including `id` and `agentId`
- Providers with a valid `agentId` show a "Verified" badge on the marketplace UI
- Note: Use your LAN IP (not localhost) if marketplace runs on a different machine

### Section 7: Verify Registration

- Check listing:
  ```bash
  curl http://localhost:3000/api/providers
  ```
- Confirm your provider appears in the response
- Open `http://localhost:3000` in browser — your provider should show in the grid

### Section 8: Troubleshooting

Common issues and fixes:
- **Ollama not reachable**: Check `ollama serve` is running, verify port
- **402 not returned**: Check x402 credentials in `.env`, verify `MOCK_PAYMENTS=false`
- **Registration fails**: Check marketplace is running, verify endpoint URL is reachable
- **Streaming not working**: Ensure Ollama supports `/v1/chat/completions` (Ollama 0.1.29+)

## Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Create `skills/contributor/` directory | 1 min |
| 2 | Write frontmatter (name, description, requires) | 3 min |
| 3 | Write Sections 1-2: Prerequisites + Install | 5 min |
| 4 | Write Sections 3-4: Configure + Start | 5 min |
| 5 | Write Sections 5-6: Test payment gate + Register | 8 min |
| 6 | Write Sections 7-8: Verify + Troubleshooting | 5 min |
| 7 | Test skill end-to-end: follow it manually once | 5 min |

**Total: ~32 min** (includes testing)

## Stub Strategy

The skill can be **written before PAY-01 and MKT-01 are complete**:
- Reference the expected directory structure and commands
- Use placeholder IPs and credentials
- Test with `MOCK_PAYMENTS=true` mode
- Update concrete details (exact CLI output, error messages) once sidecar is built

## Interface Contract

**Exposes**:
- `skills/contributor/SKILL.md` — installable OpenClaw skill

**Consumes**:
- PAY-01: `provider-sidecar/` directory, `server.ts` entrypoint, `.env.example`
- MKT-01: `POST /api/providers` endpoint, marketplace URL

## Integration Points

1. **+ PAY-01**: Skill references sidecar's install process, .env vars, and server startup
2. **+ MKT-01**: Skill references marketplace API for provider registration
3. **+ ID-01**: Skill teaches providers to register identity with `@goathackbot`, receive `agentId` and x402 creds

## Shared Constants

```
MARKETPLACE_URL=http://localhost:3000
MARKETPLACE_API=POST /api/providers
SIDECAR_PORT=4021
SIDECAR_HEALTH=GET /health
GOAT_CHAIN_ID=48816
```
