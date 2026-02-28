# GOAT x402 SDK Details

## Overview

x402 is a pay-per-use HTTP payment standard for APIs on GOAT Testnet3 (chain 48816). The SDK has two packages — a frontend for payment execution and a backend for order management. Settlement is handled by the GoatX402 Core API, not direct agent-to-agent transfers.

## Packages

### Frontend: `goatx402-sdk`

Handles wallet signing and token transfers on EVM chains. Depends on `ethers.js`.

```bash
pnpm install goatx402-sdk ethers
```

**Key Methods:**

| Method | Description |
|---|---|
| `payment.signCalldata(order)` | Signs calldata when `calldataSignRequest` is present in order |
| `payment.pay(order)` | Executes token transfer to `payToAddress` provided by Core |

The signer comes from a wallet provider (e.g. MetaMask or `ethers.Wallet`):

```js
const signer = await provider.getSigner()
```

### Backend: `goatx402-sdk-server`

Order management and proof retrieval. Authenticates via HMAC using API key + secret to talk to GoatX402 Core API.

```bash
pnpm install goatx402-sdk-server
```

**Key Methods:**

| Method | Description |
|---|---|
| `createOrder(params)` | Creates a payment order; returns 402 status with order details |
| `submitCalldataSignature(orderId, signature)` | Submits user's calldata signature |
| `getOrderStatus(orderId)` | Polls order state (e.g. `PAYMENT_CONFIRMED`) |
| `getOrderProof(orderId)` | Retrieves on-chain proof after confirmation |
| `cancelOrder(orderId)` | Cancels order if in `CHECKOUT_VERIFIED` state |

**Environment Variables:**

```bash
GOATX402_API_URL=https://x402-api-lx58aabp0r.testnet3.goat.network
GOATX402_API_KEY=...        # backend only
GOATX402_API_SECRET=...     # backend only, never expose
GOATX402_MERCHANT_ID=...
```

## Payment Flow

```
1. Backend calls createOrder() → Core API returns order details
                                  (+ optional calldataSignRequest)

2. If calldataSignRequest exists →
      Frontend signs via payment.signCalldata(order)
      Backend submits signature via submitCalldataSignature()

3. Frontend calls payment.pay(order) →
      Transfers tokens (USDC/USDT) to payToAddress from Core

4. Backend polls getOrderStatus() →
      Waits for PAYMENT_CONFIRMED

5. Backend calls getOrderProof() →
      Gets on-chain proof (txHash, etc.)
```

> The user/agent transfers tokens to a `payToAddress` provided by the Core API. `ERC20_3009/APPROVE_XFER` is Core's settlement mechanism — you don't need to handle that directly.

## Wallet Requirements

| Role | What you need |
|---|---|
| **Provider** (selling a service) | Merchant credentials from `@goathackbot` (API key, secret, merchant ID). Your wallet receives payments. |
| **Client** (paying for a service) | A connected wallet (signer) with test USDC/USDT to call `payment.pay()`. |
| **Autonomous agent** (no browser) | Create an `ethers.Wallet` from a private key and use it as the signer. The SDK doesn't prescribe this — it's your implementation choice. |

## Simplified Middleware (from hackathon guide)

The hackathon guide shows a simplified Express middleware abstraction:

```js
import { GoatX402 } from 'goatx402-sdk-server'

const x402 = new GoatX402({
  apiUrl: process.env.GOATX402_API_URL,
  apiKey: process.env.GOATX402_API_KEY,
  apiSecret: process.env.GOATX402_API_SECRET,
  merchantId: process.env.GOATX402_MERCHANT_ID,
})

// Gate any route behind x402 payment
app.use('/api/generate', x402.middleware({ amount: '0.1', symbol: 'USDC' }))
```

Under the hood, this middleware handles `createOrder` + status polling + proof retrieval automatically. The actual SDK is more granular if you need custom flow control.

## Linking to ERC-8004 Identity

To build on-chain reputation from payments, include `proofOfPayment` in feedback:

```json
{
  "proofOfPayment": {
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "chainId": 48816,
    "txHash": "0x..."
  }
}
```

## References

- [x402 SDK repo](https://github.com/GOATNetwork/x402)
- [DEVELOPER_FAST.md](https://github.com/GOATNetwork/x402/blob/main/DEVELOPER_FAST.md)
- [EIP-8004 spec](https://eips.ethereum.org/EIPS/eip-8004)
