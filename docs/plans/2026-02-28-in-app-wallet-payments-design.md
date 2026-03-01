# In-App Wallet Payments via goatx402-sdk

## Problem

The current payment flow opens an external URL in a new browser tab when a user needs to pay for inference. This is clunky — the user leaves the app, pays elsewhere, then the frontend polls hoping the payment eventually lands.

## Solution

Use the `goatx402-sdk` (frontend) and `goatx402-sdk-server` (backend) to handle payments entirely in-app via MetaMask / injected wallet.

## Architecture

```
User clicks "Send" (wallet address passed in X-Wallet-Address header)
  → Provider Sidecar creates order via GoatX402Client.createOrder()
  → Returns 402 + full SDK Order { orderId, flow, tokenContract, payToAddress, amountWei, ... }
  → InferencePanel shows payment card
  → User clicks "Pay with Wallet"
  → ethers BrowserProvider → getSigner → PaymentHelper.pay(order)
  → MetaMask popup → user confirms ERC20 transfer
  → TX on-chain → frontend polls sidecar for PAYMENT_CONFIRMED
  → Retry inference with X-Goat-Order-Id header
  → Inference streams back
```

## Changes

### 1. Sidecar (`provider-sidecar/x402-client.ts`)

Replace raw `fetch()` calls with `GoatX402Client` from the server SDK:
- `createOrder(amount, symbol, fromAddress)` → uses `GoatX402Client.createOrder()` which returns full order with `tokenContract`, `payToAddress`, `amountWei`
- `verifyOrder(orderId)` → uses `GoatX402Client.getOrderStatus()` with status mapping (`PAYMENT_CONFIRMED` → `paid`)
- Read `fromAddress` from `X-Wallet-Address` request header in `server.ts`

### 2. Frontend Types (`src/lib/types.ts`)

Replace simplified `Order`:
```typescript
interface Order {
  orderId: string
  flow: string
  tokenSymbol: string
  tokenContract: string
  payToAddress: string
  chainId: number
  amountWei: string
  expiresAt: number
}
```

Update `OrderStatus` to reflect SDK status values.

### 3. InferencePanel (`src/components/InferencePanel.tsx`)

- Lazy wallet connection: `connectWallet()` calls `window.ethereum.request({ method: 'eth_requestAccounts' })`
- On "Send": connect wallet first, get address, send as `X-Wallet-Address` header
- On 402: display payment card with amount, token symbol, chain
- On "Pay with Wallet": `new PaymentHelper(signer).pay(order)` triggers MetaMask
- New payment phases: `paying` (MetaMask open), `awaiting_confirmation` (tx submitted, polling), `payment_failed`
- After backend confirms: retry inference with `X-Goat-Order-Id`

### 4. Payment State Machine

```
null → payment_required → paying → awaiting_confirmation → payment_confirmed → null
                                   └→ payment_failed
```

- `paying`: MetaMask popup open, waiting for approval
- `awaiting_confirmation`: tx submitted on-chain, polling backend
- `payment_failed`: tx rejected or insufficient balance

## Decisions

- **Wallet connection**: Direct MetaMask via ethers.js (no wagmi/RainbowKit)
- **Connect location**: Inline in InferencePanel, connect-on-demand (no header button)
- **Fallback**: No external payment URL fallback — in-app wallet only
- **Dependencies**: ethers.js (already bundled with goatx402-sdk)

## Unchanged

- Provider registration, model detection, SSE streaming, store/DB layer
