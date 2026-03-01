# DEMO-01: End-to-End Demo Script

**Module**: Demo preparation and execution
**Time estimate**: 30 min
**Priority**: Must-Have
**Dependencies**: All other modules (MKT-01, PAY-01, ID-01, SKILL-01, SKILL-02)

---

## Scope

Three deliverables:
1. `demo/demo-script.md` — Narrated 60-90 second demo flow
2. `demo/setup-checklist.md` — Pre-demo setup steps
3. `demo/seed-providers.sh` — Shell script to seed marketplace data

## Output Files

```
demo/
  demo-script.md        # Narrated demo with timing
  setup-checklist.md    # Pre-demo checklist
  seed-providers.sh     # Seed data script
```

---

## Pre-Demo Setup Checklist

### Environment

- [ ] Ollama installed and running (`ollama serve`)
- [ ] Model pulled (`ollama pull llama3`)
- [ ] Ollama responds: `curl http://localhost:11434/v1/models`
- [ ] Node.js 20+ installed

### Services

- [ ] Provider sidecar running on port 4021
  ```bash
  cd provider-sidecar && npx tsx server.ts
  ```
- [ ] Sidecar health check passes:
  ```bash
  curl http://localhost:4021/health
  ```
- [ ] Marketplace running on port 3000
  ```bash
  npm run dev
  ```
- [ ] Marketplace loads in browser: `http://localhost:3000`

### Data

- [ ] Provider registered on marketplace:
  ```bash
  bash demo/seed-providers.sh
  ```
- [ ] Provider visible in marketplace UI grid with "Verified" badge
- [ ] Provider's `agentId` resolves on GOAT dashboard

### Browser Tabs (pre-opened)

1. `http://localhost:3000` — Marketplace UI
2. `https://goat-dashboard.vercel.app` — ERC-8004 identity
3. `https://explorer.testnet3.goat.network` — GOAT explorer (for tx verification)

### Quick Verify

- [ ] Send a test inference through the full flow (402 → pay → response)
- [ ] Confirm the tx appears on GOAT explorer
- [ ] Time a practice run — should be under 90 seconds

---

## Seed Providers Script

**File**: `demo/seed-providers.sh`

```bash
#!/bin/bash
# Seed the marketplace with demo providers

MARKETPLACE_URL=${MARKETPLACE_URL:-http://localhost:3000}

echo "Seeding providers on $MARKETPLACE_URL..."

# Provider 1: Local Ollama with llama3 (includes agentId for "Verified" badge)
curl -s -X POST "$MARKETPLACE_URL/api/providers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "demo-llama3-provider",
    "model": "llama3",
    "endpoint": "http://localhost:4021/v1/chat/completions",
    "pricing": {"amount": "0.01", "symbol": "USDC"},
    "walletAddress": "0xDEMO_WALLET_ADDRESS",
    "agentId": "DEMO_AGENT_ID"
  }' | jq .

echo ""
echo "Done. Check: curl $MARKETPLACE_URL/api/providers"
```

---

## Demo Script (60-90 Seconds)

### Act 1 — Provider Registers (0-20s)

**Narration**: "This is a decentralized inference marketplace. Anyone running an LLM can register as a paid provider. This provider has an ERC-8004 on-chain identity — you can verify who they are before paying."

**Actions**:
1. Show terminal: run `curl` to register a provider with `agentId` (or use the seed script)
2. Switch to browser: marketplace UI refreshes showing the new provider card
3. Point out: model name, pricing (0.01 USDC), online status, **"Verified" badge** (linked to GOAT dashboard)

**Key visual**: Provider card appearing in the marketplace grid with "Verified" badge

### Act 2 — Client Discovers & Requests (20-40s)

**Narration**: "AI agents or humans can browse available models and try them. Let's run some inference."

**Actions**:
1. In marketplace UI: point out the provider listing
2. Click "Try it" on the provider card
3. InferencePanel opens — type a prompt: "Explain decentralized AI in two sentences"
4. Click Send

**Key visual**: InferencePanel open with prompt typed

### Act 3 — Payment & Inference (40-70s)

**Narration**: "The provider requires x402 payment. The client pays on GOAT Testnet3 — trustless, on-chain. Then inference streams back directly from the provider's machine."

**Actions**:
1. Show the 402 payment required response/UI element
2. Payment completes (x402 on GOAT Testnet3)
3. Inference tokens start streaming in real-time
4. Full response appears in the panel

**Key visual**: Streaming tokens appearing word-by-word

### Act 4 — Show the Receipts (70-90s)

**Narration**: "Everything is verifiable on-chain. Here's the **provider's** ERC-8004 identity — you can verify who you just paid — and here's the x402 payment transaction."

**Actions**:
1. Switch to GOAT Dashboard tab → show the **provider's** ERC-8004 identity (the same `agentId` shown on their "Verified" badge)
2. Switch to GOAT Explorer tab → show the x402 payment transaction
3. Switch back to marketplace → provider is still active, ready for more requests

**Key visual**: Provider's on-chain identity + payment receipt proving the transaction

---

## Fallback Plans

### If x402 payments are slow or failing

- **Fallback A**: Use `MOCK_PAYMENTS=true` on the sidecar — payments are skipped, inference works directly
- **Narration adjustment**: "In production, this uses x402 payments. For demo speed, we're showing the inference flow directly."

### If Ollama is slow

- **Fallback B**: Use a smaller model (`tinyllama` or `phi`)
- **Fallback C**: Pre-record a response and show it as if streaming

### If marketplace UI has issues

- **Fallback D**: Demo entirely via `curl` commands in terminal
- Show: registration, discovery, 402, payment, inference — all in terminal

### If network issues

- **Fallback E**: Everything runs on localhost — no external network needed except for GOAT Testnet3 verification (skip Act 4 if network is down)

---

## Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Create `demo/` directory | 1 min |
| 2 | Write `setup-checklist.md` | 5 min |
| 3 | Write `seed-providers.sh` | 3 min |
| 4 | Write `demo-script.md` with all 4 acts | 10 min |
| 5 | Rehearse run #1: walk through setup checklist | 5 min |
| 6 | Rehearse run #2: time the full demo | 5 min |
| 7 | Rehearse run #3: practice with fallbacks | 5 min |

**Total: ~34 min** (includes 3 rehearsals)

## Interface Contract

**Exposes**:
- `demo/demo-script.md` — demo narration guide
- `demo/setup-checklist.md` — pre-demo preparation
- `demo/seed-providers.sh` — data seeding automation

**Consumes**:
- MKT-01: Marketplace UI + API (port 3000)
- PAY-01: Provider sidecar (port 4021)
- ID-01: ERC-8004 identity on GOAT dashboard
- SKILL-01: Provider registration flow
- SKILL-02: Client payment + inference flow

## Shared Constants

```
MARKETPLACE_URL=http://localhost:3000
SIDECAR_URL=http://localhost:4021
GOAT_DASHBOARD=https://goat-dashboard.vercel.app
GOAT_EXPLORER=https://explorer.testnet3.goat.network
GOAT_CHAIN_ID=48816
```
