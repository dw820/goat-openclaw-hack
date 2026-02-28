# MKT-01: Next.js Marketplace App

**Module**: Marketplace UI + API
**Time estimate**: 75 min
**Priority**: Must-Have
**Dependencies**: None (standalone with mocks)

---

## Scope

A single Next.js (App Router) project that serves as the decentralized inference marketplace. Includes:
- REST API routes for provider registration, listing, and deletion
- React frontend with provider grid, filter bar, and live inference panel
- In-memory data store (no database)
- Dark mode styling with shadcn/ui components + Tailwind CSS

## Directory Structure

```
src/
  app/
    layout.tsx                          # Root layout, fonts, global providers
    page.tsx                            # Home page — marketplace grid
    globals.css                         # Tailwind directives + shadcn CSS variables
    api/
      providers/
        route.ts                        # POST (register) + GET (list/filter)
        [id]/
          route.ts                      # DELETE (deregister)
  lib/
    types.ts                            # Shared interfaces: Provider, Pricing, etc.
    store.ts                            # In-memory Map<string, Provider> + seed data
    utils.ts                            # cn() helper — clsx + tailwind-merge (added by shadcn init)
  components/
    ui/                                 # shadcn/ui primitives (auto-generated)
      button.tsx
      card.tsx
      badge.tsx
      input.tsx
      dialog.tsx                        # For InferencePanel modal
      textarea.tsx                      # For prompt input
    Header.tsx                          # App header
    FilterBar.tsx                       # Model name filter input
    ProviderGrid.tsx                    # Responsive grid of ProviderCards
    ProviderCard.tsx                    # Single provider card (model, price, status, verified badge)
    InferencePanel.tsx                  # Modal/side panel: prompt input + streamed response
```

## Dependencies

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^3",
    "lucide-react": "^0.468"
  },
  "devDependencies": {
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19"
  }
}
```

The `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react` packages are peer dependencies of shadcn/ui. After project init, run `npx shadcn@latest init` (New York style, dark theme, zinc palette) to scaffold the shadcn config and `cn()` utility.

No wallet/x402/ethers dependencies — those belong in PAY-01 and SKILL-02.

## Data Store

**File**: `src/lib/store.ts`

In-memory `Map<string, Provider>` wrapped in a `ProviderStore` singleton class.

```typescript
class ProviderStore {
  private providers: Map<string, Provider>

  getAll(modelFilter?: string): Provider[]
  getById(id: string): Provider | undefined
  add(req: RegisterProviderRequest): Provider
  remove(id: string): boolean
}
```

**Seed data**: 2-3 mock providers pre-loaded for standalone development:
- `mock-llama3` — llama3 model, localhost:11434, 0.01 USDC, `agentId: undefined` (unverified)
- `mock-mistral` — mistral model, localhost:11434, 0.005 USDC, `agentId: undefined` (unverified)

This ensures the UI has content to display before any real registration. Seed providers have no `agentId`, so they appear without a "Verified" badge.

## Shared Types

**File**: `src/lib/types.ts`

```typescript
interface Pricing {
  amount: string        // e.g. "0.01"
  symbol: string        // "USDC" | "USDT"
}

interface Provider {
  id: string            // UUID
  name: string          // e.g. "alice-llama3"
  model: string         // e.g. "llama3"
  endpoint: string      // Full URL to OpenAI-compatible /v1/chat/completions
  pricing: Pricing
  walletAddress: string // Provider's 0x address
  agentId?: string      // ERC-8004 agent ID (from @goathackbot) — providers with this get a "Verified" badge
  status: "online" | "offline"
  registeredAt: string  // ISO timestamp
}

interface RegisterProviderRequest {
  name: string
  model: string
  endpoint: string
  pricing: Pricing
  walletAddress: string
  agentId?: string      // Optional — provider's ERC-8004 identity
}
```

## API Routes

### `POST /api/providers`

- **Input**: `RegisterProviderRequest` JSON body
- **Validation**: All fields required, endpoint must be a valid URL
- **Action**: Generate UUID, set `status: "online"`, set `registeredAt: new Date().toISOString()`
- **Response**: `201` with created `Provider` object

### `GET /api/providers`

- **Query params**: `?model=llama3` (optional filter)
- **Response**: `200` with `Provider[]`

### `DELETE /api/providers/[id]`

- **Response**: `204` on success, `404` if not found

## Components

### Header
- App title "Decentralized Inference Marketplace"
- Uses `Badge` for any status indicators

### FilterBar
- Uses shadcn `Input` for model name filter
- Debounced — triggers re-fetch of `/api/providers?model=<value>`

### ProviderGrid
- Responsive CSS grid (1 col mobile, 2 col tablet, 3 col desktop)
- Maps `Provider[]` to `ProviderCard` components

### ProviderCard
- Uses shadcn `Card` (`CardHeader`, `CardContent`, `CardFooter`), `Badge`, `Button`
- Displays: model name, provider name, pricing, status badge, wallet (truncated)
- If provider has an `agentId`: show a "Verified" `Badge` linking to `https://goat-dashboard.vercel.app/agent/<agentId>`
- If no `agentId`: no badge (unverified provider)
- `Button` ("Try it") opens `InferencePanel` for this provider

### InferencePanel
- Uses shadcn `Dialog` (modal) or `Sheet` (slide-out), `Textarea` for prompt, `Button` for Send/Pay
- Prompt textarea + Send button
- Uses `fetch()` to provider's endpoint with SSE streaming
- Displays streamed tokens in real-time
- **Standalone mode**: No payment logic — directly calls provider endpoint
- **Integrated mode** (after PAY-01 connection): Handles 402 response, shows payment details, re-sends with order ID header

## Styling

- shadcn/ui with dark mode — components use CSS variables (zinc palette), automatically respecting dark mode
- Tailwind CSS for layout (grid, spacing, responsive breakpoints)
- Color palette: zinc-based dark theme (set by shadcn init), accent green or blue
- Monospace font for streaming output
- Responsive: mobile-first grid layout
- Custom styling is only needed for layout — shadcn components handle theming and accessibility out of the box

## Environment Variables

```env
# .env.local
NEXT_PUBLIC_GOAT_DASHBOARD=https://goat-dashboard.vercel.app
```

Note: There is no marketplace-level agent ID. Identity belongs to individual providers via the `agentId` field on the `Provider` type.

## Stub Strategy

This module works **fully standalone**:
- In-memory store with seed data provides immediate UI content
- `InferencePanel` can call any OpenAI-compatible endpoint (e.g. local Ollama at `http://localhost:11434/v1/chat/completions`)
- No x402 or wallet dependencies — payment logic is added during integration
- `ProviderCard` verified badge only shows when a provider has an `agentId`

## Implementation Steps

| Step | Task | Est. |
|------|------|------|
| 1 | Init Next.js project: `npx create-next-app@latest . --typescript --tailwind --app --src-dir` | 5 min |
| 1b | Init shadcn/ui: `npx shadcn@latest init` + install components: `npx shadcn@latest add card button badge input dialog textarea` | 3 min |
| 2 | Create `src/lib/types.ts` with all shared interfaces | 5 min |
| 3 | Create `src/lib/store.ts` with ProviderStore class + seed data | 10 min |
| 4 | Create `POST /api/providers` and `GET /api/providers` route | 10 min |
| 5 | Create `DELETE /api/providers/[id]` route | 5 min |
| 6 | Create `Header`, `FilterBar` components | 10 min |
| 7 | Create `ProviderCard` and `ProviderGrid` components | 10 min |
| 8 | Create `InferencePanel` with SSE streaming | 15 min |
| 9 | Compose `page.tsx` — wire components together | 5 min |
| 10 | Dark mode styling pass + responsive polish | 10 min |

**Total: ~88 min** (includes buffer)

## Interface Contract

**Exposes**:
- `POST /api/providers` — register a provider (consumed by SKILL-01, PAY-01 sidecar setup)
- `GET /api/providers` — list providers (consumed by SKILL-02, InferencePanel)
- `DELETE /api/providers/:id` — deregister (consumed by providers)
- Web UI at `http://localhost:3000`

**Consumes**:
- Provider endpoints (any OpenAI-compatible `/v1/chat/completions`)
- `NEXT_PUBLIC_GOAT_DASHBOARD` env var (used to build per-provider dashboard links)

## Integration Points

When connecting with other modules:

1. **+ PAY-01**: Update `InferencePanel` to:
   - Detect 402 responses from provider sidecar
   - Display payment amount/token from 402 body
   - Show "Pay & Run" button
   - Re-send request with `X-GOAT-ORDER-ID` header after payment
   - Display order status polling

2. **+ ID-01**: Providers who registered their ERC-8004 identity include `agentId` in `POST /api/providers`. `ProviderCard` shows "Verified" badge with link to GOAT dashboard.

3. **+ SKILL-01**: Skills will call `POST /api/providers` to register (with optional `agentId`) — no marketplace changes needed

## Shared Constants

```
MARKETPLACE_URL=http://localhost:3000
MARKETPLACE_API=/api/providers
GOAT_CHAIN_ID=48816
```
