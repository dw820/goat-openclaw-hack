# Product Requirements Document: Decentralized Inference Marketplace

**Project Name:** Decentralized Inference Marketplace
**Version:** 3.0 (MVP for 4-Hour Hackathon)
**Date:** February 28, 2026

---

## 1. Vision & Opportunity

### 1.1. Problem Statement

Powerful LLMs are controlled by a few large companies. Many individuals run open-source models locally (Ollama, LM Studio, vLLM), but there's no decentralized way to monetize idle compute or discover available inference providers.

### 1.2. Vision

A **decentralized marketplace for AI inference** where:
- Anyone running an LLM can register as a provider and get paid per request
- Any AI agent can discover providers, pay, and consume inference — all programmatically
- Identity and reputation are anchored on-chain via ERC-8004
- Payments are trustless via x402 micropayments
- No central broker proxies traffic — providers serve clients directly

### 1.3. Hackathon Goal

Build and demo a functional MVP: a **provider** registers their Ollama endpoint on the marketplace, a **client** discovers it, pays via x402, and gets inference — all with on-chain identity and a visual marketplace UI.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────┐
│               Marketplace (Next.js App)                   │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  API Routes          │  React Frontend              │ │
│  │  POST /api/providers │  - Provider listing          │ │
│  │  GET  /api/providers │  - Live inference UI         │ │
│  │  DEL  /api/providers │  - Payment flow              │ │
│  └─────────────────────────────────────────────────────┘ │
│  ERC-8004 identity on GOAT Testnet3                       │
├──────────────────────────────────────────────────────────┤
│  Published OpenClaw Skills:                               │
│  • contributor-skill.md  (setup x402 + register)          │
│  • client-skill.md       (discover + pay + infer)         │
└──────────────────────────────────────────────────────────┘

Provider A (independent)              Client (agent or human via UI)
┌──────────────────────┐             ┌──────────────────────┐
│ Ollama/LLM endpoint  │◄── x402 ───│ Discovers via        │
│ + x402 payment gate  │    pay     │ marketplace API/UI    │
│ (goatx402-sdk-server)│─── result─►│                      │
│ On THEIR machine     │             │                      │
└──────────────────────┘             └──────────────────────┘
```

### Key Flows

1. **Provider registers**: Calls `POST /api/providers` with model, x402-gated endpoint URL, pricing
2. **Client discovers**: Calls `GET /api/providers?model=llama3` or browses the Next.js UI
3. **Client pays + infers**: Hits provider's endpoint directly → gets 402 → pays on GOAT Testnet3 → gets inference result

## 3. Tech Stack

| Layer | Technology | Details |
|:---|:---|:---|
| **Marketplace (API + UI)** | Next.js (App Router) | API routes for registry, React frontend for UI — single project |
| **Identity** | ERC-8004 on GOAT Testnet3 | Marketplace agent identity (chain 48816) |
| **Payments** | x402 on GOAT Testnet3 | goatx402-sdk-server, USDC/USDT |
| **Agent Platform** | OpenClaw (local) | Runs the marketplace agent locally |
| **Provider Compute** | Any OpenAI-compatible endpoint | Ollama, LM Studio, vLLM, etc. |

## 4. MVP Features

| ID | Feature | Time Est. | Priority |
|:---|:---|:---|:---|
| **MKT-01** | **Next.js Marketplace App**: API routes (POST/GET/DELETE /api/providers) + Provider listing page + "Try it" live inference panel with streaming. Single Next.js project. | 75 min | Must-Have |
| **PAY-01** | **x402 Payment Integration**: Provider-side x402 gating using goatx402-sdk-server on GOAT Testnet3 | 30 min | Must-Have |
| **ID-01** | **ERC-8004 Identity**: Marketplace agent identity on GOAT Testnet3 (via @goathackbot) | 10 min | Must-Have |
| **SKILL-01** | **Contributor Skill**: SKILL.md teaching agents how to setup x402, wrap their LLM endpoint, and register on marketplace | 30 min | Must-Have |
| **SKILL-02** | **Client Skill**: SKILL.md teaching agents how to discover providers, pay via x402, and get inference | 30 min | Must-Have |
| **DEMO-01** | **Demo Script & Rehearsal**: End-to-end demo rehearsal | 30 min | Must-Have |

**Total estimated: ~3.5 hours** (30 min buffer)

## 5. API Specification

### Next.js API Routes (`app/api/providers/`)

**POST /api/providers** — Register a provider
```json
{
  "name": "alice-llama3",
  "model": "llama3",
  "endpoint": "http://192.168.1.10:11434/v1/chat/completions",
  "pricing": { "amount": "0.01", "symbol": "USDC" },
  "walletAddress": "0x..."
}
```

**GET /api/providers** — List all providers
**GET /api/providers?model=llama3** — Filter by model

Response:
```json
[
  {
    "id": "uuid",
    "name": "alice-llama3",
    "model": "llama3",
    "endpoint": "http://192.168.1.10:11434/v1/chat/completions",
    "pricing": { "amount": "0.01", "symbol": "USDC" },
    "walletAddress": "0x...",
    "status": "online",
    "registeredAt": "2026-02-28T..."
  }
]
```

**DELETE /api/providers/:id** — Deregister a provider

## 6. Next.js Marketplace UI

### Pages

**/ (Home)** — Provider Marketplace
- Grid/list of registered providers
- Each card shows: model name, provider name, pricing, status (online/offline)
- Filter by model name
- "Try it" button on each provider card

**Live Inference Panel** (modal or side panel)
- Text input for prompt
- Shows x402 payment flow (402 → pay → streaming response)
- Displays the streamed inference result in real-time

### Styling
- Minimal, clean UI (Tailwind CSS)
- Dark mode preferred for hackathon demo appeal

## 7. OpenClaw Skills

### contributor-skill.md
Teaches an OpenClaw agent how to:
1. Install `goatx402-sdk-server` and set up x402 payment gating
2. Configure their Ollama/LLM endpoint with x402 middleware
3. Set pricing (amount + token)
4. Register their endpoint on the marketplace via `POST /api/providers`
5. Verify their registration

### client-skill.md
Teaches an OpenClaw agent how to:
1. Query the marketplace for available models (`GET /api/providers`)
2. Select a provider based on model/pricing
3. Make an x402 payment to the provider's endpoint
4. Send an inference request and handle streaming response
5. Return the result to the user

## 8. Demo Flow (60-90 Seconds)

**Pre-Demo**: Marketplace running, OpenClaw agent running, Ollama running on contributor machine

**Act 1 — Provider Registers (0-20s)**
- Contributor's OpenClaw agent (with contributor skill installed) registers their Ollama endpoint
- Show it appearing in the Next.js marketplace UI

**Act 2 — Client Discovers & Requests (20-40s)**
- Show the marketplace UI with the provider listed
- Click "Try it" → type a prompt → x402 payment is triggered

**Act 3 — Payment & Inference (40-70s)**
- Payment goes through on GOAT Testnet3
- Inference streams back from contributor's machine directly
- Result appears in the UI in real-time

**Act 4 — Show the Receipts (70-90s)**
- ERC-8004 identity on goat-dashboard.vercel.app
- x402 payment tx on GOAT Testnet3 explorer
- Marketplace showing the active provider

## 9. Success Criteria

- Provider registers via skill → appears in marketplace UI
- Client discovers provider via UI, pays via x402 on GOAT Testnet3
- Inference streams directly from provider's machine to client
- ERC-8004 identity is verifiable on GOAT dashboard
- Full flow demoed in 60-90 seconds
- Both skills are publishable and functional

## 10. Out of Scope (Post-Hackathon)

- Provider reputation scoring from payment history
- Dynamic pricing based on supply/demand
- On-chain provider registry (smart contract)
- Multi-provider load balancing
- Revenue splitting / marketplace fee
- Provider SLA enforcement
- Automated health checks with deregistration
