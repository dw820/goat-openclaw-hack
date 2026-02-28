# Integration Guide: Connecting All MVP Modules

**Time estimate**: 30-45 min (after all modules are individually working)

---

## Module Dependency Graph

```
ID-01 (provider identity + credentials)
  ├──► PAY-01 (sidecar uses provider's x402 creds)
  ├──► SKILL-01 (skill teaches provider to register identity first)
  ├──► MKT-01 (provider's agentId stored on Provider object, shown as "Verified" badge)
  └──► SKILL-02 (client wallet has test tokens)

PAY-01 (sidecar)
  ├──► MKT-01 (InferencePanel handles 402)
  ├──► SKILL-01 (skill references sidecar setup)
  └──► SKILL-02 (skill references 402 flow)

MKT-01 (marketplace)
  ├──► SKILL-01 (skill references registration API)
  ├──► SKILL-02 (skill references discovery API)
  └──► DEMO-01 (demo shows marketplace UI)
```

**Identity flow**: Provider registers ERC-8004 identity (ID-01) → receives `agentId` → includes `agentId` when registering on marketplace (SKILL-01 / MKT-01) → `ProviderCard` shows "Verified" badge linking to GOAT dashboard.

**No circular dependencies.** Each module can be developed independently with stubs.

## Shared Constants (All Modules)

These values must be consistent across every module:

| Constant | Value | Used By |
|----------|-------|---------|
| `MARKETPLACE_URL` | `http://localhost:3000` | All |
| `MARKETPLACE_API` | `/api/providers` | MKT-01, SKILL-01, SKILL-02 |
| `SIDECAR_PORT` | `4021` | PAY-01, SKILL-01, DEMO-01 |
| `SIDECAR_INFERENCE` | `/v1/chat/completions` | PAY-01, SKILL-02, MKT-01 |
| `SIDECAR_ORDER_STATUS` | `/api/orders/:orderId/status` | PAY-01, SKILL-02, MKT-01 |
| `X402_HEADER` | `X-GOAT-ORDER-ID` | PAY-01, SKILL-02, MKT-01 |
| `GOAT_CHAIN_ID` | `48816` | All |
| `GOAT_DASHBOARD` | `https://goat-dashboard.vercel.app` | ID-01, MKT-01, DEMO-01 |
| `GOAT_EXPLORER` | `https://explorer.testnet3.goat.network` | SKILL-02, DEMO-01 |
| `GOATX402_API_URL` | `https://x402-api-lx58aabp0r.testnet3.goat.network` | ID-01, PAY-01 |

---

## Integration Order

### Phase 1: MKT-01 + PAY-01 (15 min)

Connect the marketplace InferencePanel to handle x402 payment flows from the provider sidecar.

**Changes to MKT-01** (`src/components/InferencePanel.tsx`):

1. **Detect 402 response**: When `fetch()` to provider endpoint returns HTTP 402, parse the order details from the response body

2. **Show payment UI**: Display:
   - Amount + token (e.g., "0.01 USDC")
   - Order ID
   - "Pay & Run Inference" button
   - Payment status indicator

3. **Payment flow**: On button click:
   - Call x402 payment (via SDK or manual wallet tx)
   - Poll order status: `GET /api/orders/:orderId/status`
   - Show spinner with "Waiting for payment confirmation..."

4. **Retry with order ID**: Once order status = `paid`:
   - Re-send original inference request
   - Add header: `X-GOAT-ORDER-ID: <orderId>`
   - Stream the response as before

5. **Show receipt**: After inference completes:
   - Display `txHash` from order status
   - Link to GOAT explorer: `https://explorer.testnet3.goat.network/tx/<txHash>`

**No changes to PAY-01** — the sidecar already exposes the correct 402 format and order status endpoint.

### Phase 2: Provider Identity Integration (5 min)

Provider identity flows through registration → stored on Provider object → displayed on ProviderCard:

1. Provider registers ERC-8004 identity via `@goathackbot` (ID-01) and receives `agentId`
2. Provider includes `agentId` when calling `POST /api/providers` (SKILL-01, Section 6)
3. Verify `ProviderCard` shows "Verified" badge for providers with `agentId`
4. Click the "Verified" badge — confirm it opens the correct GOAT dashboard profile

### Phase 3: Full Flow Test (10-15 min)

Run through the entire flow end-to-end:

```
1. Start Ollama           → ollama serve
2. Start sidecar          → cd provider-sidecar && npx tsx server.ts
3. Start marketplace      → npm run dev
4. Register provider      → curl -X POST localhost:3000/api/providers ...
5. Open marketplace UI    → http://localhost:3000
6. Click "Try it"         → InferencePanel opens
7. Type prompt + send     → Gets 402 from sidecar
8. Pay via x402           → Payment on GOAT Testnet3
9. Inference streams      → Response appears in panel
10. Check explorer        → tx visible on GOAT explorer
11. Check dashboard       → Agent identity visible
```

**Test each transition**:
- [ ] Provider appears in grid after registration
- [ ] "Try it" opens InferencePanel with correct provider
- [ ] 402 response is parsed and displayed correctly
- [ ] Payment completes and order status updates
- [ ] Inference streams after payment
- [ ] Receipt link works

### Phase 4: DEMO-01 Finalization (10 min)

1. Update `demo/seed-providers.sh` with real wallet address
2. Run through `demo/setup-checklist.md` completely
3. Rehearse the demo script 2-3 times
4. Time each run — target 60-90 seconds
5. Test each fallback scenario once

---

## Troubleshooting Integration Issues

### 402 response not parsed correctly
- Check: PAY-01 sidecar returns JSON body with `error: "payment_required"` and `order` object
- Check: MKT-01 InferencePanel reads response body on 402 status

### Payment succeeds but inference still returns 402
- Check: `X-GOAT-ORDER-ID` header is being sent on retry
- Check: Order status is actually `"paid"` (poll status endpoint)
- Check: Sidecar is verifying the correct order ID

### Streaming works in standalone but not after payment
- Check: The retry request includes `stream: true`
- Check: The response content-type is `text/event-stream`
- Check: InferencePanel handles the SSE stream correctly on retry

### Provider card doesn't show "Verified" badge
- Check: Provider was registered with a valid `agentId` field in `POST /api/providers`
- Check: `NEXT_PUBLIC_GOAT_DASHBOARD` is set in `.env.local`
- Check: The `agentId` resolves on `https://goat-dashboard.vercel.app/agent/<agentId>`

### Provider registration works but "Try it" fails
- Check: Provider's `endpoint` URL is reachable from the browser (not just server)
- Check: CORS is enabled on the provider sidecar (`cors` middleware)
- Check: Provider is running on the correct port

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Marketplace UI (MKT-01) — localhost:3000              │ │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────────────┐  │ │
│  │  │ Provider  │ │ Filter   │ │ InferencePanel        │  │ │
│  │  │ Grid      │ │ Bar      │ │ (handles 402 + pay)   │  │ │
│  │  │ (verified │ │          │ │                       │  │ │
│  │  │  badges)  │ │          │ │                       │  │ │
│  │  └──────────┘ └──────────┘ └───────────┬───────────┘  │ │
│  └────────────────────────────────────────┼──────────────┘ │
└───────────────────────────────────────────┼────────────────┘
                                            │
                    ┌───────────────────────▼────────────────┐
                    │  Provider Sidecar (PAY-01) — :4021     │
                    │  ┌─────────┐  ┌───────────────────┐   │
                    │  │ x402    │  │ Ollama Proxy      │   │
                    │  │ Gate    │──│ (SSE streaming)   │   │
                    │  └─────────┘  └────────┬──────────┘   │
                    └────────────────────────┼──────────────┘
                                             │
                    ┌────────────────────────▼──────────────┐
                    │  Ollama — localhost:11434              │
                    │  (llama3, mistral, etc.)               │
                    └───────────────────────────────────────┘

On-chain (GOAT Testnet3, chain 48816):
  ├── ERC-8004 provider identity (ID-01) → goat-dashboard.vercel.app
  └── x402 payments (PAY-01)             → explorer.testnet3.goat.network
```

---

## File Tree (Complete Project)

```
/
├── src/                          # MKT-01: Next.js marketplace
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/providers/
│   │       ├── route.ts
│   │       └── [id]/route.ts
│   ├── lib/
│   │   ├── types.ts
│   │   └── store.ts
│   └── components/
│       ├── Header.tsx
│       ├── FilterBar.tsx
│       ├── ProviderGrid.tsx
│       ├── ProviderCard.tsx          # includes per-provider "Verified" badge
│       └── InferencePanel.tsx
├── provider-sidecar/             # PAY-01: x402 payment sidecar
│   ├── server.ts
│   ├── x402-client.ts
│   ├── proxy.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── skills/                       # SKILL-01 + SKILL-02
│   ├── contributor/
│   │   └── SKILL.md
│   └── client/
│       ├── SKILL.md
│       └── infer.ts
├── demo/                         # DEMO-01
│   ├── demo-script.md
│   ├── setup-checklist.md
│   └── seed-providers.sh
├── docs/                         # Planning docs
│   ├── PRD_v3.md
│   ├── goat-hack-guide.md
│   ├── MKT-01.md
│   ├── PAY-01.md
│   ├── ID-01.md
│   ├── SKILL-01.md
│   ├── SKILL-02.md
│   ├── DEMO-01.md
│   └── INTEGRATION.md
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── .env.local
└── .gitignore
```
