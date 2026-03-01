# In-App Wallet Payments Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the external payment URL flow with in-app MetaMask wallet payments using the goatx402-sdk.

**Architecture:** The sidecar creates orders via `GoatX402Client` (server SDK), returning full order data. The frontend uses `PaymentHelper` (client SDK) with ethers.js `BrowserProvider` to execute ERC20 transfers directly in-browser via MetaMask.

**Tech Stack:** goatx402-sdk (frontend), goatx402-sdk-server (backend), ethers.js v6, Next.js 16, Express.js

---

### Task 1: Update Frontend Types

**Files:**
- Modify: `src/lib/types.ts`

**Step 1: Replace Order and OrderStatus types**

Replace the entire `Order` interface and `OrderStatus` interface with SDK-compatible shapes:

```typescript
export interface Order {
  orderId: string;
  flow: string;
  tokenSymbol: string;
  tokenContract: string;
  payToAddress: string;
  chainId: number;
  amountWei: string;
  expiresAt: number;
}

export interface OrderStatus {
  orderId: string;
  status: "CHECKOUT_VERIFIED" | "PAYMENT_CONFIRMED" | "INVOICED" | "FAILED" | "EXPIRED" | "CANCELLED";
  txHash?: string;
  confirmedAt?: string;
}
```

**Step 2: Verify no compile errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors in InferencePanel.tsx and sidecar (expected — we'll fix those in later tasks).

**Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: update Order/OrderStatus types for SDK compatibility"
```

---

### Task 2: Upgrade Sidecar x402 Client

**Files:**
- Modify: `provider-sidecar/x402-client.ts`

**Step 1: Rewrite x402-client.ts to use GoatX402Client**

Replace the entire file. The new version uses `GoatX402Client` from the server SDK:

```typescript
import crypto from 'node:crypto'
import { GoatX402Client } from 'goatx402-sdk-server'
import type { Order, OrderProof, OrderStatus } from 'goatx402-sdk-server'

let client: GoatX402Client | null = null

function getClient(): GoatX402Client {
  if (!client) {
    client = new GoatX402Client({
      baseUrl: process.env.GOATX402_API_URL ?? '',
      apiKey: process.env.GOATX402_API_KEY ?? '',
      apiSecret: process.env.GOATX402_API_SECRET ?? '',
    })
  }
  return client
}

export function isMockMode(): boolean {
  return process.env.MOCK_PAYMENTS === 'true'
}

export async function createOrder(
  amount: string,
  symbol: string,
  fromAddress: string
): Promise<Order> {
  const c = getClient()
  return c.createOrder({
    dappOrderId: crypto.randomUUID(),
    chainId: 48816,
    tokenSymbol: symbol,
    amountWei: amount,
    fromAddress,
  })
}

export async function verifyOrder(orderId: string): Promise<OrderProof> {
  const c = getClient()
  return c.getOrderStatus(orderId)
}
```

Key changes:
- `createOrder` now takes `fromAddress` parameter (third arg)
- Returns the full SDK `Order` (with `tokenContract`, `payToAddress`, `amountWei`, `flow`, `expiresAt`)
- `verifyOrder` returns `OrderProof` with SDK status values (`PAYMENT_CONFIRMED` etc.)
- Uses singleton `GoatX402Client` instance

**Step 2: Commit**

```bash
git add provider-sidecar/x402-client.ts
git commit -m "feat: upgrade sidecar to use GoatX402Client SDK"
```

---

### Task 3: Update Sidecar Server to Pass Wallet Address

**Files:**
- Modify: `provider-sidecar/server.ts`

**Step 1: Update the POST /v1/chat/completions handler**

Read `X-Wallet-Address` header and pass it to `createOrder`. Update the 402 response to return the full SDK order. Update status checking to use SDK status values.

Changes to the handler (line 16–72 of server.ts):

1. In the "no orderId" branch (~line 31), read wallet address and pass to `createOrder`:
```typescript
const walletAddress = req.headers['x-wallet-address'] as string | undefined
if (!walletAddress) {
  res.status(400).json({
    error: 'wallet_address_required',
    message: 'X-Wallet-Address header is required for payment',
  })
  return
}
const order = await createOrder(amount, symbol, walletAddress)
```

2. In the "verify payment" branch (~line 53), update status check from `status.status === 'paid'` to `status.status === 'PAYMENT_CONFIRMED'`:
```typescript
if (status.status === 'PAYMENT_CONFIRMED' || status.status === 'INVOICED') {
```

**Step 2: Update the GET /api/orders/:orderId/status handler**

Update mock mode response to use SDK status values:
```typescript
res.json({ orderId, status: 'PAYMENT_CONFIRMED', confirmedAt: new Date().toISOString(), txHash: '0xmock' })
```

**Step 3: Commit**

```bash
git add provider-sidecar/server.ts
git commit -m "feat: pass wallet address to order creation, use SDK status values"
```

---

### Task 4: Add Ethereum Window Type Declaration

**Files:**
- Create: `src/types/ethereum.d.ts`

**Step 1: Create the type declaration**

```typescript
interface EthereumProvider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
```

**Step 2: Commit**

```bash
git add src/types/ethereum.d.ts
git commit -m "feat: add window.ethereum type declaration"
```

---

### Task 5: Rewrite InferencePanel with In-App Wallet Payment

**Files:**
- Modify: `src/components/InferencePanel.tsx`

This is the core change. The new component:
1. Connects to MetaMask on "Send" (lazy, on-demand)
2. Sends wallet address as `X-Wallet-Address` header
3. On 402, shows payment card with order details
4. On "Pay with Wallet", uses `PaymentHelper.pay(order)` — MetaMask popup
5. After tx, polls backend for confirmation
6. Retries inference with `X-Goat-Order-Id`

**Step 1: Rewrite InferencePanel.tsx**

Replace the entire file with:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Provider, Order, OrderStatus } from "@/lib/types";
import { ethers } from "ethers";
import { PaymentHelper, formatUnits } from "goatx402-sdk";

type PaymentPhase =
  | null
  | "payment_required"
  | "paying"
  | "awaiting_confirmation"
  | "payment_confirmed"
  | "payment_failed"
  | "payment_expired";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;

export function InferencePanel({
  provider,
  open,
  onOpenChange,
}: {
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentPhase, setPaymentPhase] = useState<PaymentPhase>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const abortRef = useRef<AbortController>(null);
  const pollStartRef = useRef<number>(0);
  const signerRef = useRef<ethers.Signer | null>(null);

  const connectWallet = useCallback(async (): Promise<ethers.Signer | null> => {
    if (signerRef.current) return signerRef.current;

    if (!window.ethereum) {
      setPaymentError("MetaMask not detected. Please install MetaMask.");
      return null;
    }

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    await browserProvider.send("eth_requestAccounts", []);
    const signer = await browserProvider.getSigner();
    const address = await signer.getAddress();
    signerRef.current = signer;
    setWalletAddress(address);
    return signer;
  }, []);

  const streamResponse = useCallback(async (res: Response) => {
    if (!res.body) return;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") break;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            setOutput((prev) => prev + token);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!prompt.trim() || loading) return;

    setOutput("");
    setLoading(true);
    setPaymentPhase(null);
    setOrder(null);
    setPaymentError(null);
    setTxHash(null);

    // Connect wallet to get address for order creation
    const signer = await connectWallet();
    if (!signer) {
      setLoading(false);
      return;
    }

    const address = await signer.getAddress();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${provider.endpoint}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": address,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          stream: true,
        }),
        signal: controller.signal,
      });

      if (res.status === 402) {
        try {
          const json = await res.json();
          const orderData: Order = json.order;
          if (!orderData?.orderId) {
            setOutput("Error: 402 Payment Required but no order returned");
            setLoading(false);
            return;
          }
          setOrder(orderData);
          setPaymentPhase("payment_required");
        } catch {
          setOutput("Error: 402 Payment Required (malformed response)");
        }
        setLoading(false);
        return;
      }

      if (!res.ok || !res.body) {
        setOutput(`Error: ${res.status} ${res.statusText}`);
        setLoading(false);
        return;
      }

      await streamResponse(res);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setOutput((prev) => prev + `\n\nError: ${(err as Error).message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, provider, streamResponse, connectWallet]);

  const handlePay = useCallback(async () => {
    if (!order || !signerRef.current) return;

    setPaymentPhase("paying");
    setPaymentError(null);

    try {
      const payment = new PaymentHelper(signerRef.current);
      const result = await payment.pay(order);

      if (!result.success) {
        setPaymentPhase("payment_failed");
        setPaymentError(result.error ?? "Payment failed");
        return;
      }

      setTxHash(result.txHash ?? null);
      setPaymentPhase("awaiting_confirmation");
      pollStartRef.current = Date.now();
    } catch (err) {
      setPaymentPhase("payment_failed");
      setPaymentError((err as Error).message);
    }
  }, [order]);

  const retryWithOrder = useCallback(
    async (orderId: string) => {
      setOutput("");
      setLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`${provider.endpoint}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goat-Order-Id": orderId,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: "user", content: prompt }],
            stream: true,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          setOutput(`Error: ${res.status} ${res.statusText}`);
          setLoading(false);
          setPaymentPhase(null);
          return;
        }

        setPaymentPhase(null);
        await streamResponse(res);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setOutput((prev) => prev + `\n\nError: ${(err as Error).message}`);
        }
        setPaymentPhase(null);
      } finally {
        setLoading(false);
      }
    },
    [prompt, provider, streamResponse]
  );

  // Poll for payment confirmation
  useEffect(() => {
    if (paymentPhase !== "awaiting_confirmation" || !order) return;

    const interval = setInterval(async () => {
      if (Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        setPaymentPhase("payment_expired");
        setPaymentError("Payment confirmation timed out");
        return;
      }

      try {
        const res = await fetch(
          `${provider.endpoint}/api/orders/${order.orderId}/status`
        );
        if (!res.ok) return;

        const data: OrderStatus = await res.json();

        if (data.status === "PAYMENT_CONFIRMED" || data.status === "INVOICED") {
          setPaymentPhase("payment_confirmed");
          retryWithOrder(order.orderId);
        } else if (data.status === "FAILED" || data.status === "EXPIRED" || data.status === "CANCELLED") {
          setPaymentPhase("payment_expired");
          setPaymentError(`Order ${data.status.toLowerCase()}`);
        }
      } catch {
        // Silently retry on network errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [paymentPhase, order, provider.endpoint, retryWithOrder]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (abortRef.current) abortRef.current.abort();
      setPaymentPhase(null);
      setOrder(null);
      setPaymentError(null);
      setTxHash(null);
      setOutput("");
    }
    onOpenChange(nextOpen);
  };

  const handleTryAgain = () => {
    setPaymentPhase(null);
    setOrder(null);
    setPaymentError(null);
    setTxHash(null);
  };

  const formatAmount = (amountWei: string) => {
    try {
      return formatUnits(BigInt(amountWei), 6);
    } catch {
      return amountWei;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Inference — {provider.model} ({provider.name})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment card */}
          {paymentPhase && order && (
            <Card className="border-amber-500">
              <CardContent className="space-y-3">
                {paymentPhase === "payment_required" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        Payment Required
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="text-muted-foreground">Amount:</span>{" "}
                        <span className="font-semibold">{formatAmount(order.amountWei)} {order.tokenSymbol}</span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Chain ID:</span>{" "}
                        {order.chainId}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Order:</span>{" "}
                        <code className="text-xs">{order.orderId.slice(0, 12)}…</code>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handlePay}>Pay with Wallet</Button>
                      <Button variant="outline" onClick={handleTryAgain}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}

                {paymentPhase === "paying" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-amber-500 text-amber-600">
                        Confirm in Wallet
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Please confirm the transaction in MetaMask…
                    </p>
                    <Button disabled>Waiting for wallet…</Button>
                  </>
                )}

                {paymentPhase === "awaiting_confirmation" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-blue-500 text-blue-600">
                        Transaction Submitted
                      </Badge>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">
                        Waiting for on-chain confirmation…
                      </p>
                      {txHash && (
                        <p>
                          <span className="text-muted-foreground">Tx:</span>{" "}
                          <code className="text-xs">{txHash.slice(0, 12)}…</code>
                        </p>
                      )}
                    </div>
                    <Button disabled>Confirming…</Button>
                  </>
                )}

                {paymentPhase === "payment_confirmed" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-600">Paid</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Starting inference…
                    </p>
                  </>
                )}

                {paymentPhase === "payment_failed" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Failed</Badge>
                    </div>
                    <p className="text-sm text-destructive">
                      {paymentError ?? "Payment failed."}
                    </p>
                    <Button variant="outline" onClick={handleTryAgain}>
                      Try Again
                    </Button>
                  </>
                )}

                {paymentPhase === "payment_expired" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Expired</Badge>
                    </div>
                    <p className="text-sm text-destructive">
                      {paymentError ?? "Payment order has expired."}
                    </p>
                    <Button variant="outline" onClick={handleTryAgain}>
                      Try Again
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Wallet connection error (no MetaMask) */}
          {!paymentPhase && paymentError && (
            <Card className="border-destructive">
              <CardContent>
                <p className="text-sm text-destructive">{paymentError}</p>
              </CardContent>
            </Card>
          )}

          {/* Input area — hidden while payment flow is active */}
          {!paymentPhase && (
            <>
              <Textarea
                placeholder="Enter your prompt…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />

              <div className="flex items-center gap-3">
                <Button onClick={handleSend} disabled={loading || !prompt.trim()}>
                  {loading ? "Streaming…" : "Send"}
                </Button>
                {walletAddress && (
                  <span className="text-xs text-muted-foreground">
                    Wallet: {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                  </span>
                )}
              </div>
            </>
          )}

          {output && (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-muted p-4 font-mono text-sm whitespace-pre-wrap">
              {output}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify the app builds**

Run: `cd /Users/weitu/Desktop/BUILD/goat-openclaw-hack && npx next build 2>&1 | tail -20`

**Step 3: Commit**

```bash
git add src/components/InferencePanel.tsx
git commit -m "feat: in-app wallet payment via goatx402-sdk PaymentHelper"
```

---

### Task 6: Update skills/client/infer.ts for New Order Shape

**Files:**
- Modify: `skills/client/infer.ts`

**Step 1: Update the CLI client to handle new Order type**

The CLI client currently expects `order.amount`, `order.symbol`, `order.paymentUrl`. Update references to match the new SDK Order shape: `order.amountWei`, `order.tokenSymbol`. Remove `paymentUrl` references.

Specific changes:
- Replace `order.amount` → `order.amountWei`
- Replace `order.symbol` → `order.tokenSymbol`
- Remove any `order.paymentUrl` references
- Update status check from `'paid'` to `'PAYMENT_CONFIRMED'`
- Add `X-Wallet-Address` header to inference requests

**Step 2: Commit**

```bash
git add skills/client/infer.ts
git commit -m "feat: update CLI client for new SDK order shape"
```

---

### Task 7: Smoke Test and Final Commit

**Step 1: Verify sidecar compiles**

Run: `cd /Users/weitu/Desktop/BUILD/goat-openclaw-hack/provider-sidecar && npx tsc --noEmit 2>&1 | head -20`

**Step 2: Verify Next.js builds**

Run: `cd /Users/weitu/Desktop/BUILD/goat-openclaw-hack && npx next build 2>&1 | tail -20`

**Step 3: Fix any compilation errors found**

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve compilation issues from payment integration"
```
